let files = [];
let activeId = null;
let isSplit  = false;

// ─── RELAY STATE ───────────────────────────────────────────────────────────
let relay = {
    ws:            null,
    connected:     false,
    authenticated: false,
    url:           localStorage.getItem('relay-url')  || '',
    key:           localStorage.getItem('relay-key')  || '',
    pending:       {},   // id → { resolve, reject }
};

// ─── BOOT ──────────────────────────────────────────────────────────────────
window.onload = () => {
    const saved = localStorage.getItem('mint-os-v9');
    files = saved ? JSON.parse(saved) : [
        { id: 'f1', name: 'index.html', type: 'html', content: '<h1>Mint OS v9</h1>\n<p>Open a browser tab and enter a URL!</p>' },
        { id: 'f2', name: 'style.css',  type: 'css',  content: 'body { background: #111; color: #fff; font-family: sans-serif; }' },
        { id: 'f3', name: 'script.js',  type: 'js',   content: 'console.log("Mint OS Ready");' }
    ];
    renderSidebar();
    if (files.length) switchFile(files[0].id);

    // Auto-connect relay if credentials were saved
    if (relay.url && relay.key) connectRelay(relay.url, relay.key);

    updateRelayBadge();
};

// ─── RELAY CONNECTION ──────────────────────────────────────────────────────
function connectRelay(wsUrl, key) {
    relay.url = wsUrl;
    relay.key = key;
    localStorage.setItem('relay-url', wsUrl);
    localStorage.setItem('relay-key', key);

    setStatus('Connecting to relay…');

    // Close existing socket if any
    if (relay.ws) { try { relay.ws.close(); } catch(_) {} }

    relay.ws            = new WebSocket(wsUrl);
    relay.connected     = false;
    relay.authenticated = false;

    relay.ws.onopen = () => {
        relay.connected = true;
        // Send auth immediately
        relay.ws.send(JSON.stringify({ type: 'auth', key }));
        setStatus('Authenticating relay…');
    };

    relay.ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }

        if (msg.type === 'auth_ok') {
            relay.authenticated = true;
            updateRelayBadge();
            setStatus('Relay connected ✓');
            console.log('[Relay] Authenticated ✓');
            return;
        }

        if (msg.type === 'error' && !relay.authenticated) {
            setStatus('Relay auth failed — check your key');
            relay.ws.close();
            updateRelayBadge();
            return;
        }

        // Resolve pending fetch
        const pending = relay.pending[msg.id];
        if (pending) {
            delete relay.pending[msg.id];
            if (msg.type === 'page' || msg.type === 'redirect') {
                pending.resolve(msg);
            } else {
                pending.reject(new Error(msg.body || 'Relay error'));
            }
        }
    };

    relay.ws.onclose = () => {
        relay.connected     = false;
        relay.authenticated = false;
        updateRelayBadge();
        setStatus('Relay disconnected');
        // Reject all pending requests
        Object.values(relay.pending).forEach(p => p.reject(new Error('Relay disconnected')));
        relay.pending = {};
    };

    relay.ws.onerror = () => {
        setStatus('Relay connection error');
        updateRelayBadge();
    };
}

function disconnectRelay() {
    if (relay.ws) relay.ws.close();
    relay.url = '';
    relay.key = '';
    localStorage.removeItem('relay-url');
    localStorage.removeItem('relay-key');
    updateRelayBadge();
    setStatus('Relay disconnected');
}

// Send a fetch request through relay, returns a Promise
function relayFetch(url) {
    return new Promise((resolve, reject) => {
        if (!relay.authenticated) return reject(new Error('Not connected'));
        const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
        relay.pending[id] = { resolve, reject };
        relay.ws.send(JSON.stringify({ type: 'fetch', id, url }));
        // Timeout after 20s
        setTimeout(() => {
            if (relay.pending[id]) {
                delete relay.pending[id];
                reject(new Error('Request timed out'));
            }
        }, 20000);
    });
}

function updateRelayBadge() {
    const badge = document.getElementById('relay-badge');
    if (!badge) return;
    if (relay.authenticated) {
        badge.textContent = '🟢 Relay';
        badge.title = `Connected to ${relay.url}`;
    } else if (relay.connected) {
        badge.textContent = '🟡 Relay';
        badge.title = 'Authenticating…';
    } else {
        badge.textContent = '⚪ Relay';
        badge.title = 'Not connected — click to configure';
    }
}

// ─── CORE FUNCTIONS ────────────────────────────────────────────────────────
function switchFile(id) {
    activeId = id;
    const file = files.find(f => f.id === id);
    renderSidebar();

    const editor  = document.getElementById('pane-editor');
    const preview = document.getElementById('pane-preview');
    const omni    = document.getElementById('omni-bar');
    const input   = document.getElementById('code-input');
    const openBtn = document.getElementById('btn-open-tab');

    if (file.type === 'browser') {
        editor.style.display  = 'none';
        preview.style.display = 'block';
        preview.style.flex    = '1';
        omni.value = file.originalUrl || '';
        openBtn.style.display = 'inline-block';
        if (file.url) loadBrowser(file);
    } else {
        editor.style.display  = 'flex';
        preview.style.display = isSplit ? 'block' : 'none';
        if (isSplit) preview.style.flex = '1';
        omni.value  = file.name;
        input.value = file.content;
        openBtn.style.display = 'none';
        if (isSplit) runProject();
    }
    updateStatus();
}

function handleNavigation() {
    const val  = document.getElementById('omni-bar').value.trim();
    const file = files.find(f => f.id === activeId);
    if (!val) return;

    if (file.type === 'browser') {
        file.originalUrl = val;
        file.url  = processUrl(val);
        file.name = 'Browser';
        renderSidebar();
        loadBrowser(file);
        save();
    } else {
        file.name = val;
        renderSidebar();
        save();
    }
}

// ─── URL PROCESSING ────────────────────────────────────────────────────────
function processUrl(input) {
    let url = input.trim();

    // Plain search → Google
    if (!url.includes('.') || url.includes(' ')) {
        return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    if (!url.startsWith('http')) url = 'https://' + url;

    // YouTube → Invidious embed
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = '';
        if (url.includes('v='))        vid = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) vid = url.split('youtu.be/')[1].split('?')[0];
        return vid ? `https://yewtu.be/embed/${vid}?autoplay=1` : 'https://yewtu.be';
    }

    // TikTok → ProxiTok
    if (url.includes('tiktok.com')) return `https://proxitok.pabloferreiro.es/${url.split('tiktok.com')[1]}`;

    // Reddit → Redlib
    if (url.includes('reddit.com')) return url.replace('reddit.com', 'redlib.seasi.dev');

    // Twitter → Nitter
    if (url.includes('twitter.com') || url.includes('x.com'))
        return url.replace(/twitter\.com|x\.com/, 'nitter.poast.org');

    return url;
}

// ─── BROWSER LOADER ────────────────────────────────────────────────────────
async function loadBrowser(file) {
    const frame   = document.getElementById('web-frame');
    const overlay = document.getElementById('blocked-overlay');

    frame.removeAttribute('srcdoc');
    overlay.style.display = 'none';
    frame.style.display   = 'block';

    // Mirror services always embed fine
    const isMirror = /yewtu\.be|proxitok|redlib|nitter/.test(file.url);
    if (isMirror) {
        frame.src = file.url;
        setStatus('Mirror active ✓');
        return;
    }

    // ── Use relay if connected, otherwise direct/proxy fallback ────────────
    if (relay.authenticated) {
        setStatus('Fetching via relay…');
        try {
            const result = await relayFetch(file.url);
            if (result.type === 'redirect') {
                // Non-HTML resource — open directly
                frame.src = result.finalUrl;
            } else {
                frame.srcdoc = result.html;
            }
            setStatus(`Relay ✓  ${result.finalUrl || file.url}`);
        } catch (e) {
            setStatus(`Relay error: ${e.message}`);
            frame.style.display   = 'none';
            overlay.style.display = 'flex';
        }
    } else {
        // Fallback: direct iframe
        setStatus('No relay — direct connection');
        frame.src = file.url;
        attachFrameErrorDetection(frame);
    }
}

function attachFrameErrorDetection(frame) {
    frame.onload  = () => setStatus('Loaded (some sites block frames — connect relay for full access)');
    frame.onerror = () => {
        frame.style.display = 'none';
        document.getElementById('blocked-overlay').style.display = 'flex';
        setStatus('Blocked — connect relay for full access');
    };
}

function retryWithRelay() { showRelayModal(); }

function openCurrentInTab() {
    const file = files.find(f => f.id === activeId);
    const url  = file?.originalUrl || document.getElementById('omni-bar').value;
    if (url) window.open(url, '_blank');
}

// ─── RELAY MODAL ───────────────────────────────────────────────────────────
function showRelayModal() {
    document.getElementById('relay-url-input').value = relay.url;
    document.getElementById('relay-key-input').value = relay.key;
    document.getElementById('modal-relay').style.display = 'flex';
}

function confirmRelay() {
    const url = document.getElementById('relay-url-input').value.trim();
    const key = document.getElementById('relay-key-input').value.trim();
    if (!url || !key) return;
    closeModal('modal-relay');
    connectRelay(url, key);
}

// ─── STANDARD FUNCTIONS ────────────────────────────────────────────────────
function createBrowserTab() {
    const id = 'b' + Date.now();
    files.push({ id, name: 'New Tab', type: 'browser', url: '', content: '' });
    renderSidebar();
    switchFile(id);
}

function runProject() {
    if (files.find(f => f.id === activeId).type === 'browser') return;
    isSplit = true;
    document.getElementById('pane-preview').style.display = 'block';
    const frame    = document.getElementById('web-frame');
    const htmlFile = files.find(f => f.name.endsWith('.html')) || files[0];
    if (!htmlFile) return;
    let finalHtml = htmlFile.content;
    files.filter(f => f.name.endsWith('.css')).forEach(c => { finalHtml += `<style>\n${c.content}</style>`; });
    files.filter(f => f.name.endsWith('.js') && f.type !== 'browser').forEach(j => { finalHtml += `<script>\ntry{${j.content}}catch(e){console.log(e)}<\/script>`; });
    frame.srcdoc = finalHtml;
}

function updateFile() {
    const file = files.find(f => f.id === activeId);
    if (file) { file.content = document.getElementById('code-input').value; save(); }
}

function toggleSplit() { isSplit = !isSplit; switchFile(activeId); }

function showNewFile() { document.getElementById('modal-new').style.display = 'flex'; }

function closeModal(id = 'modal-new') { document.getElementById(id).style.display = 'none'; }

function confirmNewFile() {
    const name = document.getElementById('new-filename').value.trim();
    if (!name) return;
    files.push({ id: 'f' + Date.now(), name, type: name.split('.').pop(), content: '' });
    closeModal();
    renderSidebar();
    switchFile(files[files.length - 1].id);
    save();
}

function renderSidebar() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    files.forEach(f => {
        const el = document.createElement('div');
        el.className = `file-item ${f.id === activeId ? 'active' : ''}`;
        el.onclick = () => switchFile(f.id);
        el.innerHTML = `<span>${f.type === 'browser' ? '🌐' : '📄'}</span> ${f.name}`;
        list.appendChild(el);
    });
}

function updateStatus() {
    const size = new Blob([JSON.stringify(files)]).size;
    document.getElementById('mem-usage').innerText = (size / 1024).toFixed(2) + ' KB';
}

function setStatus(msg) { document.getElementById('status').innerText = msg; }
function save()    { localStorage.setItem('mint-os-v9', JSON.stringify(files)); updateStatus(); }
function resetOS() { if (confirm('Reset OS?')) { localStorage.clear(); location.reload(); } }
