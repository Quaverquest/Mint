let files = [];
let activeId = null;
let isSplit = false;

window.onload = () => {
    const saved = localStorage.getItem('mint-os-v9');
    if (saved) {
        files = JSON.parse(saved);
    } else {
        files = [
            { id: 'f1', name: 'index.html', type: 'html', content: '<h1>Mint OS v9</h1>\n<p>Try pasting a YouTube link!</p>' },
            { id: 'f2', name: 'style.css',  type: 'css',  content: 'body { background: #111; color: #fff; font-family: sans-serif; }' },
            { id: 'f3', name: 'script.js',  type: 'js',   content: 'console.log("Mirror Protocol Active");' }
        ];
    }
    renderSidebar();
    if (files.length) switchFile(files[0].id);
};

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
        omni.value = file.originalUrl || file.url || '';
        openBtn.style.display = 'inline-block';
        loadBrowser(file);
    } else {
        editor.style.display  = 'flex';
        preview.style.display = isSplit ? 'block' : 'none';
        if (isSplit) preview.style.flex = '1';
        omni.value = file.name;
        input.value = file.content;
        openBtn.style.display = 'none';
        if (isSplit) runProject();
    }
    updateStatus();
}

function handleNavigation() {
    const val  = document.getElementById('omni-bar').value.trim();
    const file = files.find(f => f.id === activeId);

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

// ─── MIRROR ENGINE v9.1 ────────────────────────────────────────────────────
function processUrl(input) {
    let url = input.trim();

    // 1. Plain search query → Google
    if (!url.includes('.') || url.includes(' ')) {
        return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    if (!url.startsWith('http')) url = 'https://' + url;

    // 2. YouTube → Invidious mirror (yewtu.be allows embedding)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }
        if (videoId) {
            return `https://yewtu.be/embed/${videoId}?autoplay=1`;
        }
        // YouTube homepage → Invidious
        return 'https://yewtu.be';
    }

    // 3. TikTok → ProxiTok
    if (url.includes('tiktok.com')) {
        return `https://proxitok.pabloferreiro.es/${url.split('tiktok.com')[1]}`;
    }

    // 4. Reddit → Redlib (Libreddit is dead)
    if (url.includes('reddit.com')) {
        return url.replace('reddit.com', 'redlib.seasi.dev');
    }

    // 5. Twitter/X → Nitter
    if (url.includes('twitter.com') || url.includes('x.com')) {
        return url.replace(/twitter\.com|x\.com/, 'nitter.poast.org');
    }

    return url;
}

// ─── BROWSER LOADER ────────────────────────────────────────────────────────
async function loadBrowser(file) {
    const frame   = document.getElementById('web-frame');
    const stealth = document.getElementById('stealth-mode').checked;
    const overlay = document.getElementById('blocked-overlay');

    // Reset state
    frame.removeAttribute('srcdoc');
    overlay.style.display = 'none';
    frame.style.display   = 'block';

    // Mirror services always work in direct mode
    const isMirror = file.url.includes('yewtu.be') ||
                     file.url.includes('proxitok')  ||
                     file.url.includes('redlib')    ||
                     file.url.includes('nitter');

    if (isMirror) {
        frame.src = file.url;
        setStatus('Mirror Active ✓');
        return;
    }

    if (stealth) {
        await loadViaProxy(file.url, frame);
    } else {
        // Direct load + detect X-Frame-Options block
        setStatus('Connecting…');
        frame.src = file.url;
        attachFrameErrorDetection(frame, file.url);
    }
}

function attachFrameErrorDetection(frame, url) {
    const overlay = document.getElementById('blocked-overlay');

    // Browsers don't expose a reliable "X-Frame-Options blocked" event,
    // but the frame fires load with a blank/inaccessible document when blocked.
    const timer = setTimeout(() => {
        // If we can't read contentDocument it's cross-origin (normal).
        // If the src is still set but load never fired it likely was blocked.
        // Show a softer status instead of a hard error.
        setStatus('Direct Connection (some sites may block frames)');
    }, 5000);

    frame.onload = () => {
        clearTimeout(timer);
        try {
            // Same-origin pages: we can read location
            const loc = frame.contentWindow.location.href;
            setStatus(`Loaded: ${loc}`);
        } catch {
            // Cross-origin loaded fine
            setStatus('Direct Connection ✓');
        }
    };

    frame.onerror = () => {
        clearTimeout(timer);
        frame.style.display   = 'none';
        overlay.style.display = 'flex';
        setStatus('Blocked by site — try Stealth Mode ↗');
    };
}

async function loadViaProxy(url, frame) {
    setStatus('Connecting via proxy…');
    const overlay = document.getElementById('blocked-overlay');

    // corsproxy.io is more reliable than allorigins.win
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let html = await res.text();

        // Inject a base tag so relative links resolve to the origin
        const baseUrl = new URL(url).origin;
        html = html.replace(/(<head[^>]*>)/i, `$1<base href="${baseUrl}/">`);

        // Rewrite absolute links to go through proxy too
        html = html.replace(/href="(https?:\/\/[^"]+)"/g,
            (_, href) => `href="javascript:void(0)" onclick="parent.proxyNavigate('${href}')"`);

        frame.srcdoc = html;
        frame.style.display = 'block';
        overlay.style.display = 'none';
        setStatus('Stealth Mode: ON ✓');
    } catch (e) {
        frame.style.display   = 'none';
        overlay.style.display = 'flex';
        setStatus(`Proxy failed: ${e.message}`);
    }
}

// Called by rewritten links inside proxy pages
window.proxyNavigate = function(url) {
    const file = files.find(f => f.id === activeId);
    if (file && file.type === 'browser') {
        file.originalUrl = url;
        file.url = processUrl(url);
        document.getElementById('omni-bar').value = url;
        loadBrowser(file);
        save();
    }
};

function retryWithStealth() {
    document.getElementById('stealth-mode').checked = true;
    const file = files.find(f => f.id === activeId);
    if (file) loadBrowser(file);
}

function openCurrentInTab() {
    const file = files.find(f => f.id === activeId);
    const url  = file?.originalUrl || file?.url || document.getElementById('omni-bar').value;
    if (url) window.open(url, '_blank');
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
    const htmlFile = files.find(f => f.name.endsWith('.html')) || files.find(f => f.type !== 'browser');
    if (!htmlFile) return;

    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const jsFiles  = files.filter(f => f.name.endsWith('.js'));

    let finalHtml = htmlFile.content;
    cssFiles.forEach(css => { finalHtml += `<style>\n${css.content}</style>`; });
    jsFiles.forEach(js   => { finalHtml += `<script>\ntry{ ${js.content} }catch(e){console.log(e)}<\/script>`; });

    frame.srcdoc = finalHtml;
}

function updateFile() {
    const file = files.find(f => f.id === activeId);
    if (file) { file.content = document.getElementById('code-input').value; save(); }
}

function toggleSplit() { isSplit = !isSplit; switchFile(activeId); }
function showNewFile()  { document.getElementById('modal-new').style.display = 'flex'; }
function closeModal()   { document.getElementById('modal-new').style.display = 'none'; }

function confirmNewFile() {
    const name = document.getElementById('new-filename').value.trim();
    if (!name) return;
    const ext = name.split('.').pop();
    files.push({ id: 'f' + Date.now(), name, type: ext, content: '' });
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
        const icon = f.type === 'browser' ? '🌐' : '📄';
        el.innerHTML = `<span>${icon}</span> ${f.name}`;
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
