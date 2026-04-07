let files = [];
let activeId = null;
let isSplit = false;

window.onload = () => {
    const saved = localStorage.getItem('mint-os-v8');
    if (saved) {
        files = JSON.parse(saved);
    } else {
        files = [
            { id: 'f1', name: 'index.html', type: 'html', content: '<h1>Hello World</h1>\n<button id="btn">Click Me</button>' },
            { id: 'f2', name: 'style.css', type: 'css', content: 'body { background: #f0f0f0; font-family: sans-serif; }\nh1 { color: #28c87a; }' },
            { id: 'f3', name: 'script.js', type: 'js', content: 'document.getElementById("btn").onclick = () => alert("It Works!");' }
        ];
    }
    renderSidebar();
    if (files.length) switchFile(files[0].id);
};

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
        omni.value = file.url;
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

function createBrowserTab() {
    const id = 'b' + Date.now();
    files.push({ id, name: 'New Tab', type: 'browser', url: '', content: '' });
    renderSidebar();
    switchFile(id);
}

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

async function loadBrowser(file) {
    const frame = document.getElementById('web-frame');
    const stealth = document.getElementById('stealth-mode').checked;
    
    if (!file.url) {
        frame.srcdoc = '<body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5;font-family:sans-serif;color:#888"><h1>Mint Browser</h1></body>';
        return;
    }

    if (stealth) {
        document.getElementById('status').innerText = "Trying Stealth Connection...";
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(file.url);
            const response = await fetch(proxyUrl);
            let html = await response.text();
            const baseUrl = new URL(file.url).origin;
            html = html.replace('<head>', `<head><base href="${baseUrl}/">`);
            frame.srcdoc = html;
            document.getElementById('status').innerText = "Stealth Load Complete";
        } catch (e) {
            frame.srcdoc = `<div style="text-align:center;padding:50px;font-family:sans-serif"><h3>Connection Failed</h3><p>The stealth proxy could not reach this site.</p></div>`;
        }
    } else {
        frame.removeAttribute('srcdoc');
        frame.src = file.url;
    }
}

function handleNavigation() {
    const val = document.getElementById('omni-bar').value;
    const file = files.find(f => f.id === activeId);
    
    if (file.type === 'browser') {
        if (val.includes('.') && !val.includes(' ')) {
            file.url = val.startsWith('http') ? val : 'https://' + val;
        } else {
            file.url = `https://www.bing.com/search?q=${encodeURIComponent(val)}`;
        }
        file.name = new URL(file.url).hostname;
        renderSidebar();
        loadBrowser(file);
        save();
    } else {
        file.name = val;
        renderSidebar();
        save();
    }
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

function toggleSplit() {
    isSplit = !isSplit;
    switchFile(activeId); 
}

function renderSidebar() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    files.forEach(f => {
        const el = document.createElement('div');
        el.className = `file-item ${f.id === activeId ? 'active' : ''}`;
        el.onclick = () => switchFile(f.id);
        
        let icon = '📄';
        let cls = '';
        if(f.name.endsWith('.html')) { icon = '</>'; cls = 'icon-html'; }
        if(f.name.endsWith('.css')) { icon = '#'; cls = 'icon-css'; }
        if(f.name.endsWith('.js')) { icon = '{ }'; cls = 'icon-js'; }
        if(f.type === 'browser') { icon = '🌐'; cls = 'icon-web'; }

        el.innerHTML = `<span class="${cls}" style="width:20px;text-align:center;font-weight:bold">${icon}</span> ${f.name}`;
        list.appendChild(el);
    });
}

function updateStatus() {
    const size = new Blob([JSON.stringify(files)]).size;
    document.getElementById('mem-usage').innerText = (size/1024).toFixed(2) + ' KB';
}

function save() { localStorage.setItem('mint-os-v8', JSON.stringify(files)); updateStatus(); }
function resetOS() { if(confirm("Reset everything?")) { localStorage.clear(); location.reload(); } }
