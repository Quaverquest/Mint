let files = [];
let activeId = null;
let isSplit  = false;

// ─── BOOT ──────────────────────────────────────────────────────────────────
window.onload = () => {
    const saved = localStorage.getItem('mint-os-v9');
    files = saved ? JSON.parse(saved) : [
        { id: 'f1', name: 'index.html', type: 'html', content: '<h1>Mint OS v9</h1>\n<p>Welcome! Open a browser tab or a remote desktop session.</p>' },
        { id: 'f2', name: 'style.css',  type: 'css',  content: 'body { background: #111; color: #fff; font-family: sans-serif; }' },
        { id: 'f3', name: 'script.js',  type: 'js',   content: 'console.log("Mint OS Ready");' }
    ];
    renderSidebar();
    if (files.length) switchFile(files[0].id);
};

// ─── CORE ──────────────────────────────────────────────────────────────────
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

    } else if (file.type === 'remote') {
        editor.style.display  = 'none';
        preview.style.display = 'block';
        preview.style.flex    = '1';
        omni.value = '🖥 Remote Desktop';
        openBtn.style.display = 'none';
        loadRemote();

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
    if (!val || file.type === 'remote') return;

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

// ─── REMOTE DESKTOP ────────────────────────────────────────────────────────
function createRemoteTab() {
    const existing = files.find(f => f.type === 'remote');
    if (existing) { switchFile(existing.id); return; }
    const id = 'rd' + Date.now();
    files.push({ id, name: '🖥 Remote', type: 'remote', url: '', content: '' });
    renderSidebar();
    switchFile(id);
    save();
}

function loadRemote() {
    const frame   = document.getElementById('web-frame');
    const overlay = document.getElementById('blocked-overlay');
    overlay.style.display = 'none';
    frame.style.display   = 'block';
    frame.removeAttribute('srcdoc');
    frame.src = 'remote.html';
    setStatus('Remote Desktop loaded — enter host and connect');
}

// ─── URL PROCESSING ────────────────────────────────────────────────────────
function processUrl(input) {
    let url = input.trim();
    if (!url.includes('.') || url.includes(' '))
        return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    if (!url.startsWith('http')) url = 'https://' + url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = '';
        if (url.includes('v='))             vid = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) vid = url.split('youtu.be/')[1].split('?')[0];
        return vid ? `https://yewtu.be/embed/${vid}?autoplay=1` : 'https://yewtu.be';
    }
    if (url.includes('tiktok.com'))
        return `https://proxitok.pabloferreiro.es/${url.split('tiktok.com')[1]}`;
    if (url.includes('reddit.com'))
        return url.replace('reddit.com', 'redlib.seasi.dev');
    if (url.includes('twitter.com') || url.includes('x.com'))
        return url.replace(/twitter\.com|x\.com/, 'nitter.poast.org');
    return url;
}

// ─── BROWSER LOADER ────────────────────────────────────────────────────────
function loadBrowser(file) {
    const frame   = document.getElementById('web-frame');
    const overlay = document.getElementById('blocked-overlay');
    frame.removeAttribute('srcdoc');
    overlay.style.display = 'none';
    frame.style.display   = 'block';
    const isMirror = /yewtu\.be|proxitok|redlib|nitter/.test(file.url);
    frame.src = file.url;
    setStatus(isMirror ? 'Mirror active ✓' : 'Loading…');
    frame.onload  = () => setStatus('Loaded');
    frame.onerror = () => {
        frame.style.display   = 'none';
        overlay.style.display = 'flex';
        setStatus('Blocked — try opening in a new tab ↗');
    };
}

function openCurrentInTab() {
    const file = files.find(f => f.id === activeId);
    const url  = file?.originalUrl || document.getElementById('omni-bar').value;
    if (url) window.open(url, '_blank');
}

// ─── STANDARD ──────────────────────────────────────────────────────────────
function createBrowserTab() {
    const id = 'b' + Date.now();
    files.push({ id, name: 'New Tab', type: 'browser', url: '', content: '' });
    renderSidebar();
    switchFile(id);
}

function runProject() {
    const file = files.find(f => f.id === activeId);
    if (!file || file.type === 'browser' || file.type === 'remote') return;
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
function showNewFile()  { document.getElementById('modal-new').style.display = 'flex'; }
function closeModal()   { document.getElementById('modal-new').style.display = 'none'; }

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
        const icon = f.type === 'browser' ? '🌐' : f.type === 'remote' ? '🖥' : '📄';
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
