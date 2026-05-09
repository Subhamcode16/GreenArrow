# ContextBridge One-Click MCP Installer (Windows)
$ErrorActionPreference = "Stop"

echo "=================================================="
echo "      CONTEXTBRIDGE ZERO-CONFIG INSTALLER"
echo "=================================================="

# Get the directory where the script is located, then go up one level to the project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = (Get-Item $ScriptDir).Parent.FullName
$ServerScript = Join-Path $ProjectRoot "app\mcp\server.py"

# Find absolute path to python
$PythonPath = (Get-Command python.exe).Source

# Ensure dependencies are installed
echo "[INFO] Verifying libraries before registration..."
& $PythonPath -m pip install mcp motor pydantic-settings httpx celery redis cryptography tiktoken pymongo --quiet

# The MCP Config Block
$McpConfig = @{
    "command" = $PythonPath
    "args" = @($ServerScript)
    "env" = @{
        "PYTHONPATH" = $ProjectRoot
        "MONGO_URI" = "mongodb://localhost:27017"
        "LLM_PROVIDER" = "openrouter"
    }
}

# 1. Claude Desktop Integration
$ClaudeConfigPath = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
if (Test-Path $ClaudeConfigPath) {
    echo "[INFO] Found Claude Desktop. Registering ContextBridge..."
    $Config = Get-Content $ClaudeConfigPath | ConvertFrom-Json
    if (-not $Config.mcpServers) { $Config | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value @{} }
    $Config.mcpServers | Add-Member -MemberType NoteProperty -Name "context-bridge" -Value $McpConfig -Force
    $Config | ConvertTo-Json -Depth 10 | Set-Content $ClaudeConfigPath
    echo "[SUCCESS] Registered in Claude Desktop."
}

# 2. Cursor Integration (Standard MCP)
$CursorConfigPath = Join-Path $env:APPDATA "Cursor\User\settings.json"
if (Test-Path $CursorConfigPath) {
    echo "[INFO] Found Cursor. Please note: Cursor usually requires manual MCP addition in UI."
    echo "[HINT] Go to: Settings -> Cursor Settings -> MCP -> Add New Server"
    echo "Name: ContextBridge"
    echo "Type: command"
    echo "Command: python `"$ServerScript`""
}

echo "--------------------------------------------------"
echo "Installation Complete!"
echo "Please restart your IDE/Claude Desktop to see the new tools."
echo "--------------------------------------------------"
pause
