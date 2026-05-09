import * as vscode from 'vscode';
import axios from 'axios';
import { GreenArrowHubManager } from './hubManager';

// --- TYPES ---
interface ChatSession {
    session_id: string;
    source: string;
    snippet: string;
    captured_at: string;
    snapshot?: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('GreenArrow Pro: Initializing...');

    // 1. Start the Local Hub
    GreenArrowHubManager.startHub(context);

    // 2. Register UI Provider
    const provider = new GreenArrowProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GreenArrowProvider.viewType, provider)
    );

    // 3. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('greenarrow.refresh', () => provider.update()),
        vscode.commands.registerCommand('greenarrow.setup', async () => {
            const config = vscode.workspace.getConfiguration('contextbridge');
            let apiKey = config.get<string>('apiKey');
            if (!apiKey) {
                apiKey = 'cb_' + Math.random().toString(36).substring(2, 15);
                await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
            }
            vscode.window.showInformationMessage(`Your Pairing Key: ${apiKey}`, 'Copy').then(c => {
                if (c === 'Copy') vscode.env.clipboard.writeText(apiKey!);
            });
            provider.update();
        }),
        vscode.commands.registerCommand('greenarrow.bridgeFile', async () => {
            const fileUri = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'Text': ['md', 'txt', 'json', 'py', 'js', 'ts'] }});
            if (!fileUri || fileUri.length === 0) return;
            const content = (await vscode.workspace.fs.readFile(fileUri[0])).toString();
            const config = vscode.workspace.getConfiguration('greenarrow.hub');
            const port = config.get<number>('port', 8000);
            const apiKey = vscode.workspace.getConfiguration('contextbridge').get<string>('apiKey', 'default_key');
            
            try {
                await axios.post(`http://127.0.0.1:${port}/v1/relay/push`, {
                    source: "file-bridge",
                    snippet: `File: ${fileUri[0].path.split('/').pop()}\n${content.slice(0, 100)}...`,
                    content: content
                }, { headers: { 'x-api-key': apiKey }});
                provider.update();
                vscode.window.showInformationMessage("File Bridged!");
            } catch (e) {
                vscode.window.showErrorMessage("File bridge failed.");
            }
        }),
        vscode.commands.registerCommand('greenarrow.copySnapshot', (snapshot: string) => {
            vscode.env.clipboard.writeText(snapshot);
            vscode.window.showInformationMessage("Snapshot copied to clipboard!");
        }),
        vscode.commands.registerCommand('greenarrow.generateSnapshot', async (session: ChatSession) => {
            const config = vscode.workspace.getConfiguration('greenarrow.hub');
            const port = config.get<number>('port', 8000);
            const apiKey = vscode.workspace.getConfiguration('contextbridge').get<string>('apiKey', 'default_key');

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Optimizing Context...",
                cancellable: false
            }, async () => {
                try {
                    const res = await axios.post(`http://127.0.0.1:${port}/v1/handoff/generate`, {
                        session_id: session.session_id,
                        messages: [{role: "user", content: session.snippet}], // Simplified for prototype
                        source: session.source
                    }, {
                        headers: { 'x-api-key': apiKey }
                    });
                    
                    provider.update();
                    vscode.window.showInformationMessage("Handoff Ready!", "Copy").then(c => {
                        if (c === 'Copy') vscode.env.clipboard.writeText(res.data.snapshot);
                    });
                } catch (e) {
                    vscode.window.showErrorMessage("Optimization failed.");
                }
            });
        })
    );

    // 4. Polling for new context
    const poll = setInterval(async () => {
        const config = vscode.workspace.getConfiguration('greenarrow.hub');
        const port = config.get<number>('port', 8000);
        const apiKey = vscode.workspace.getConfiguration('contextbridge').get<string>('apiKey', 'default_key');

        try {
            const res = await axios.get(`http://127.0.0.1:${port}/v1/relay/pull`, {
                headers: { 'x-api-key': apiKey }
            });
            if (res.data.chats && res.data.chats.length > 0) {
                provider.update();
                vscode.window.setStatusBarMessage("$(sync) GreenArrow: New Context!", 3000);
            } else if (provider.isError) {
                // Recover from startup failure if hub is now online
                provider.update();
            }
        } catch (e) {
            // Silence background polling errors
        }
    }, 5000);

    context.subscriptions.push({ dispose: () => clearInterval(poll) });
}

export function deactivate() {
    GreenArrowHubManager.stopHub();
}

class GreenArrowProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'greenarrow-hub-view';
    private _view?: vscode.WebviewView;
    private _startupTime: number = Date.now();
    public isError: boolean = false;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.update();

        webviewView.webview.onDidReceiveMessage(async msg => {
            switch (msg.type) {
                case 'refresh': this.update(); break;
                case 'generate': vscode.commands.executeCommand('greenarrow.generateSnapshot', msg.session); break;
                case 'copy': vscode.commands.executeCommand('greenarrow.copySnapshot', msg.snapshot); break;
                case 'setup': vscode.commands.executeCommand('greenarrow.setup'); break;
                case 'bridgeFile': vscode.commands.executeCommand('greenarrow.bridgeFile'); break;
                case 'copyKey': 
                    vscode.env.clipboard.writeText(msg.key); 
                    vscode.window.showInformationMessage("API Key copied to clipboard!");
                    break;
            }
        });
    }

    public async update() {
        if (!this._view) return;
        const config = vscode.workspace.getConfiguration('greenarrow.hub');
        const port = config.get<number>('port', 8000);
        const apiKey = vscode.workspace.getConfiguration('contextbridge').get<string>('apiKey', 'default_key');

        try {
            const res = await axios.get(`http://127.0.0.1:${port}/v1/sessions`, {
                headers: { 'x-api-key': apiKey },
                timeout: 3000
            });
            this.isError = false;
            this._view.webview.html = this._getHtml(res.data.sessions || []);
        } catch (e: any) {
            this.isError = true;
            this._view.webview.html = this._getErrorHtml();
            
            // Only log errors after a 5-second grace period (startup)
            if (Date.now() - this._startupTime > 5000) {
                const channel = GreenArrowHubManager.outputChannel;
                channel.appendLine(`[VIEW ERROR] Failed to fetch sessions: ${e.message}`);
            }
        }
    }

    private _getHtml(sessions: ChatSession[]) {
        const apiKey = vscode.workspace.getConfiguration('contextbridge').get<string>('apiKey', 'default_key');
        
        const cards = sessions.length === 0 
            ? `<div class="empty-state">
                <div class="icon">🛰️</div>
                Waiting for bridge signal...<br>
                <span>Click "Bridge Context" in your browser to begin.</span>
               </div>`
            : sessions.map(s => {
                let dateStr = "Recently";
                try {
                    const d = new Date(s.captured_at.replace(' ', 'T'));
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }
                } catch(e) {}

                return `
                <div class="card">
                    <div class="header">
                        <span class="badge">${s.source || 'web'}</span>
                        <span class="time">${dateStr}</span>
                    </div>
                    <div class="snippet">${s.snippet || 'No preview available'}</div>
                    <div class="actions">
                        ${s.snapshot ? 
                            `<button class="btn success" onclick="copy(\`${s.snapshot.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">📋 Copy Snapshot</button>` :
                            `<button class="btn primary" onclick="generate(${JSON.stringify(s).replace(/"/g, '&quot;')})">⚡ Optimize Snapshot</button>`
                        }
                    </div>
                </div>
                `;
            }).join('');

        return `
            <html>
            <head>
                <style>
                    :root { --accent: #10b981; --accent-dark: #059669; --bg: #0d1117; --card-bg: rgba(255, 255, 255, 0.04); }
                    body { padding: 16px; color: #e6edf3; font-family: 'Inter', -apple-system, sans-serif; background: transparent; margin: 0; }
                    .nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
                    .nav-title { font-size: 0.85em; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; margin: 0; }
                    .nav-actions { display: flex; gap: 14px; }
                    .nav-btn { background: none; border: none; color: #8b949e; cursor: pointer; font-size: 1.2em; transition: color 0.2s; padding: 0; }
                    .nav-btn:hover { color: var(--accent); }
                    
                    .status-pill { font-size: 0.7em; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 6px 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 0.2s; }
                    .status-pill:hover { background: rgba(16, 185, 129, 0.15); }
                    .status-dot { width: 6px; height: 6px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 8px var(--accent); }

                    .card { background: var(--card-bg); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; margin-bottom: 16px; backdrop-filter: blur(10px); transition: transform 0.2s, border-color 0.2s; }
                    .card:hover { transform: translateY(-2px); border-color: rgba(16, 185, 129, 0.3); }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                    .badge { font-size: 0.65em; font-weight: 600; text-transform: uppercase; color: var(--accent); background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px; }
                    .time { font-size: 0.7em; color: #8b949e; }
                    .snippet { font-size: 0.85em; line-height: 1.5; color: #c9d1d9; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
                    
                    .btn { width: 100%; padding: 8px; border-radius: 6px; font-size: 0.8em; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; }
                    .btn.primary { background: var(--accent); border: none; color: #000; }
                    .btn.primary:hover { background: #34d399; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
                    .btn.success { background: transparent; border: 1px solid var(--accent); color: var(--accent); }
                    .btn.success:hover { background: var(--accent); color: #000; }

                    .empty-state { text-align: center; padding: 60px 20px; color: #8b949e; font-size: 0.85em; line-height: 1.6; }
                    .empty-state .icon { font-size: 2.5em; margin-bottom: 16px; opacity: 0.5; }
                    .empty-state span { font-size: 0.8em; opacity: 0.7; }
                </style>
            </head>
            <body>
                <div class="nav-header">
                    <h3 class="nav-title">GreenArrow Pro</h3>
                    <div class="nav-actions">
                        <button class="nav-btn" onclick="bridgeFile()" title="Bridge File">📄</button>
                        <button class="nav-btn" onclick="refresh()" title="Sync">🔄</button>
                        <button class="nav-btn" onclick="setup()" title="Settings">⚙️</button>
                    </div>
                </div>

                <div class="status-pill" onclick="copyKey('${apiKey}')" title="Click to copy pairing key">
                    <div class="status-dot"></div>
                    <span>Relay Active: <b>${apiKey.slice(0, 8)}...</b></span>
                </div>

                <div id="list">${cards}</div>

                <script>
                    const vscode = acquireVsCodeApi();
                    function generate(s) { vscode.postMessage({type: 'generate', session: s}); }
                    function copy(snap) { vscode.postMessage({type: 'copy', snapshot: snap}); }
                    function refresh() { vscode.postMessage({type: 'refresh'}); }
                    function setup() { vscode.postMessage({type: 'setup'}); }
                    function bridgeFile() { vscode.postMessage({type: 'bridgeFile'}); }
                    function copyKey(key) { vscode.postMessage({type: 'copyKey', key: key}); }
                </script>
            </body>
            </html>
        `;
    }

    private _getErrorHtml() {
        return `
            <html>
            <head>
                <style>
                    body { padding: 32px; text-align: center; color: #8b949e; font-family: -apple-system, sans-serif; background: #0d1117; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .logo { color: #10b981; font-size: 1.8em; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
                    .spinner { width: 24px; height: 24px; border: 2px solid rgba(16, 185, 129, 0.2); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 20px 0; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .msg { font-size: 0.9em; margin-bottom: 24px; color: #c9d1d9; }
                    .hint { font-size: 0.75em; opacity: 0.6; line-height: 1.5; max-width: 200px; }
                    .btn-retry { margin-top: 30px; padding: 8px 24px; background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 6px; cursor: pointer; font-size: 0.85em; transition: all 0.2s; }
                    .btn-retry:hover { background: #30363d; border-color: #8b949e; }
                </style>
            </head>
            <body>
                <div class="logo">GreenArrow</div>
                <div class="spinner"></div>
                <div class="msg">Connecting to Hub Core...</div>
                <div class="hint">Ensure Python is installed and port 8000 is available for the memory relay.</div>
                <button class="btn-retry" onclick="refresh()">Retry Connection</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    function refresh() { vscode.postMessage({type: 'refresh'}); }
                </script>
            </body>
            </html>
        `;
    }
}
