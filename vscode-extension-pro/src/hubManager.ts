import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import axios from 'axios';

export class GreenArrowHubManager {
    private static hubProcess: cp.ChildProcess | null = null;
    public static readonly outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("GreenArrow Hub");
    private static isStarting: boolean = false;

    public static async startHub(context: vscode.ExtensionContext) {
        const config = vscode.workspace.getConfiguration('greenarrow.hub');
        const autoStart = config.get<boolean>('autoStart', true);
        const port = config.get<number>('port', 8000);

        if (!autoStart || this.isStarting) return;
        this.isStarting = true;

        // Check if hub is already running
        try {
            const res = await axios.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 });
            if (res.status === 200) {
                this.outputChannel.appendLine("GreenArrow Hub is already running.");
                this.isStarting = false;
                return;
            }
        } catch (e) {
            // Not running or error, proceed
        }

        this.outputChannel.appendLine("Starting GreenArrow Hub...");

        // Path to the bundled hub script
        const hubPath = path.join(context.extensionPath, 'hub', 'main.py');
        const pythonPath = 'python'; 

        this.outputChannel.appendLine(`[HUB DEBUG] Hub Path: ${hubPath}`);
        this.outputChannel.appendLine(`[HUB DEBUG] Python Path: ${pythonPath}`);

        this.hubProcess = cp.spawn(pythonPath, [hubPath, 'api', '--port', port.toString()], {
            cwd: path.dirname(hubPath),
            env: { ...process.env, PYTHONPATH: path.dirname(hubPath), PYTHONUNBUFFERED: "1" }
        });

        this.hubProcess.on('error', (err) => {
            this.outputChannel.appendLine(`[HUB FATAL] Failed to start process: ${err.message}`);
        });

        this.hubProcess.stdout?.on('data', (data) => {
            this.outputChannel.append(data.toString());
        });

        this.hubProcess.stderr?.on('data', (data) => {
            this.outputChannel.append(`[HUB ERROR] ${data.toString()}`);
        });

        this.hubProcess.on('close', (code) => {
            this.outputChannel.appendLine(`Hub process exited with code ${code}`);
            this.hubProcess = null;
        });

        // Wait for it to be ready
        let attempts = 0;
        while (attempts < 15) {
            try {
                const res = await axios.get(`http://127.0.0.1:${port}/health`, { timeout: 1000 });
                if (res.status === 200) {
                    vscode.window.setStatusBarMessage("$(check) GreenArrow Hub: Online", 5000);
                    this.isStarting = false;
                    return;
                }
            } catch (e) {
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        this.isStarting = false;
        vscode.window.showErrorMessage("Failed to start GreenArrow Hub. Check output logs.");
    }

    public static stopHub() {
        if (this.hubProcess) {
            this.outputChannel.appendLine("Stopping GreenArrow Hub...");
            this.hubProcess.kill();
            this.hubProcess = null;
        }
    }
}
