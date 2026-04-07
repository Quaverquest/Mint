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
            { id: 'f2', name: 'style.css', type: 'css', content: 'body { background: #111; color: #fff; font-family: sans-serif; }' },
            { id: 'f3', name: 'script.js', type: 'js', content: 'console.log("Mirror Protocol Active");' }
        ];
    }
    renderSidebar();
    if (files.length) switchFile(files[0].id);
};

// --- CORE FUNCTIONS ---

function switchFile(id) {
    activeId = id;
    const file = files.find(f => f.id === id);
    renderSidebar();
    
    const editor = document.getElementById('pane-editor');
    const preview = document.getElementById('pane-preview');
    const omni = document.getElementById('omni-bar');
    const input = document.getElementById('code-input');

    if (file.type === 'browser') {
        editor.style.display = 'none';
        preview.style.display = 'block';
        preview.style.flex = '1';
        omni.value = file.originalUrl || file.url || ''; 
        loadBrowser(file);
    } else {
        editor.style.display = 'flex';
        preview.style.display = isSplit ? 'block' : 'none';
        if (isSplit) preview.style.flex = '1';
        omni.value = file.name;
        input.value = file.content;
        if (isSplit) runProject(); 
    }
    updateStatus();
}

function handleNavigation() {
    const val = document.getElementById('omni-bar').value;
    const file = files.find(f => f.id === activeId);
    
    if (file.type === 'browser') {
        file.originalUrl = val;
        file.url = processUrl(val); // Runs the new Mirror Engine
        file.name = "Browser"; 
        
        renderSidebar();
        loadBrowser(file);
        save();
    } else {
        file.name = val;
        renderSidebar();
        save();
    }
}

// --- THE MIRROR ENGINE (v9.0) ---
function processUrl(input) {
    let url = input.trim();
    
    // 1. Handle Search Queries
    if (!url.includes('.') || url.includes(' ')) {
        return `https://www.bing.com/search?q=${encodeURIComponent(url)}`;
    }

    if (!url.startsWith('http')) url = 'https://' + url;

    // 2. YOUTUBE UNBLOCKER (Invidious Mirroring)
    // Instead of youtube.com, we use 'yewtu.be' (Invidious).
    // This domain is often Uncategorized/Unblocked by filters.
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1];
        }
        
        if (videoId) {
            // Use 'yewtu.be' - A reliable public Invidious instance
            return `https://yewtu.be/embed/${videoId}?autoplay=1`;
        }
    }

    // 3. TIKTOK UNBLOCKER (ProxiTok)
    if (url.includes('tiktok.com')) {
        // Redirects to ProxiTok instance
        return `https://proxitok.pabloferreiro.es/${url.split('tiktok.com')[1]}`;
    }

    // 4. REDDIT UNBLOCKER (Libreddit)
    if (url.includes('reddit.com')) {
        return url.replace('reddit.com', 'libreddit.kavin.rocks');
    }

    return url;
}

async function loadBrowser(file) {
    const frame = document.getElementById('web-frame');
    const stealth = document.getElementById('stealth-mode').checked;
    
    frame.removeAttribute('srcdoc');
    
    // If we detected a video mirror (yewtu.be), FORCE standard mode.
    // Stealth mode breaks video players.
    if (file.url.includes('yewtu.be') || file.url.includes('proxitok')) {
        frame.src = file.url;
        document.getElementById('status').innerText = "Mirror Active (Unblocked)";
        return;
    }

    if (stealth) {
        // Proxy Mode for Text Sites (Wikipedia, Articles)
        document.getElementById('status').innerText = "Connecting via Proxy...";
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(file.url);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Blocked');
            
            let html = await response.text();
            const baseUrl = new URL(file.url).origin;
            html = html.replace('<head>', `<head><base href="${baseUrl}/">`);
            
            frame.srcdoc = html;
            document.getElementById('status').innerText = "Stealth Mode: ON";
        } catch (e) {
            frame.srcdoc = `<div style="color:#fff;background:#000;height:100vh;display:flex;align-items:center;justify-content:center;"><h2>Proxy Failed</h2></div>`;
        }
    } else {
        frame.src = file.url;
        document.getElementById('status').innerText = "Direct Connection";
    }
}

// --- STANDARD FUNCTIONS ---

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
    
    const frame = document.getElementById('web-frame');
    const htmlFile = files.find(f => f.name.endsWith('.html')) || files.find(f => f.type !== 'browser');
    if (!htmlFile) return;

    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const jsFiles = files.filter(f => f.name.endsWith('.js'));

    let finalHtml = htmlFile.content;
    cssFiles.forEach(css => { finalHtml += `<style>\n${css.content}</style>`; });
    jsFiles.forEach(js => { finalHtml += `<script>\ntry{ ${js.content} }catch(e){console.log(e)}<\/script>`; });

    frame.srcdoc = finalHtml;
}

function updateFile() {
    const file = files.find(f => f.id === activeId);
    if (file) {
        file.content = document.getElementById('code-input').value;
        save();
    }
}

function toggleSplit() { isSplit = !isSplit; switchFile(activeId); }
function showNewFile() { document.getElementById('modal-new').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-new').style.display = 'none'; }

function confirmNewFile() {
    const name = document.getElementById('new-filename').value;
    const ext = name.split('.').pop();
    files.push({ id: 'f'+Date.now(), name, type: ext, content: '' });
    closeModal();
    renderSidebar();
    switchFile(files[files.length-1].id);
    save();
}

function renderSidebar() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    files.forEach(f => {
        const el = document.createElement('div');
        el.className = `file-item ${f.id === activeId ? 'active' : ''}`;
        el.onclick = () => switchFile(f.id);
        let icon = f.type === 'browser' ? '🌐' : '📄';
        el.innerHTML = `<span>${icon}</span> ${f.name}`;
        list.appendChild(el);
    });
}

function updateStatus() {
    const size = new Blob([JSON.stringify(files)]).size;
    document.getElementById('mem-usage').innerText = (size/1024).toFixed(2) + ' KB';
}

function save() { localStorage.setItem('mint-os-v9', JSON.stringify(files)); updateStatus(); }
function resetOS() { if(confirm("Reset OS?")) { localStorage.clear(); location.reload(); } }
