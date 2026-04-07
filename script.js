let files = [];
let activeId = null;
let isSplit = false;

window.onload = () => {
    const saved = localStorage.getItem('mint-os-v8');
    if (saved) {
        files = JSON.parse(saved);
    } else {
        files = [
            { id: 'f1', name: 'index.html', type: 'html', content: '<h1>Welcome to Mint OS</h1>\n<p>Type a YouTube link above!</p>' },
            { id: 'f2', name: 'style.css', type: 'css', content: 'body { background: #111; color: #fff; font-family: sans-serif; }' },
            { id: 'f3', name: 'script.js', type: 'js', content: 'console.log("System Ready");' }
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
        omni.value = file.originalUrl || file.url || ''; // Show the "nice" URL, not the embed one
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
        file.originalUrl = val; // Save what the user typed
        file.url = processUrl(val); // Convert to embed/proxy format
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

// --- THE "SMART EMBED" ENGINE ---
// This fixes the "Refused to Connect" error by using allowed Embed APIs
function processUrl(input) {
    let url = input.trim();
    
    // 1. Handle Search Queries (if no dot is present)
    if (!url.includes('.') || url.includes(' ')) {
        return `https://www.bing.com/search?q=${encodeURIComponent(url)}`;
    }

    // 2. Ensure Protocol
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    // 3. YouTube Smart Embed
    // Converts "youtube.com/watch?v=XYZ" -> "youtube.com/embed/XYZ"
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        let videoId = '';
        if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1];
        }
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    }

    // 4. Twitch Smart Embed
    if (url.includes('twitch.tv/')) {
        const channel = url.split('twitch.tv/')[1];
        return `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}`;
    }

    // 5. Wikipedia (Mobile version works better in iframes)
    if (url.includes('wikipedia.org')) {
        return url.replace('wikipedia.org', 'm.wikipedia.org');
    }

    return url;
}

async function loadBrowser(file) {
    const frame = document.getElementById('web-frame');
    const stealth = document.getElementById('stealth-mode').checked;
    
    // Clear previous state
    frame.removeAttribute('srcdoc');
    
    if (stealth) {
        // Proxy Mode for basic text sites (Wikipedia, Docs, Articles)
        document.getElementById('status').innerText = "Attempting Proxy Connection...";
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(file.url);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Network Blocked');
            
            let html = await response.text();
            const baseUrl = new URL(file.url).origin;
            html = html.replace('<head>', `<head><base href="${baseUrl}/">`);
            
            frame.srcdoc = html;
            document.getElementById('status').innerText = "Proxy Loaded";
        } catch (e) {
            frame.srcdoc = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#111;color:#fff">
                    <h2 style="color:#ff5f57">Connection Blocked</h2>
                    <p>The network filter rejected this request.</p>
                    <p style="color:#888;font-size:12px">Try turning Stealth Mode OFF for YouTube/Embeds.</p>
                </div>`;
        }
    } else {
        // Direct Mode (Use this for YouTube Embeds)
        frame.src = file.url;
        document.getElementById('status').innerText = "Direct Connection";
    }
}

// --- STANDARD SYSTEM FUNCTIONS ---

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
    cssFiles.forEach(css => { finalHtml += `<style>/* ${css.name} */\n${css.content}</style>`; });
    jsFiles.forEach(js => { finalHtml += `<script>/* ${js.name} */\ntry{ ${js.content} }catch(e){console.error(e)}<\/script>`; });

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

function save() { localStorage.setItem('mint-os-v8', JSON.stringify(files)); updateStatus(); }
function resetOS() { if(confirm("Reset everything?")) { localStorage.clear(); location.reload(); } }
