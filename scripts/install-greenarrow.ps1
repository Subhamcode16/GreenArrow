# GreenArrow Suite: Universal One-Click Installer
# This script prepares your environment for the production-ready GreenArrow Hub.

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "         GREENARROW SUITE INSTALLER" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Check Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python is not installed. Please install it from python.org" -ForegroundColor Red
    exit
}

# 2. Create Data Directory
$ParentPath = Split-Path -Parent $PSScriptRoot
$HubPath = Join-Path $ParentPath "greenarrow-hub"
$DataPath = Join-Path $HubPath "data"

if (!(Test-Path $HubPath)) {
    Write-Host "[ERROR] GreenArrow Hub directory not found at $HubPath" -ForegroundColor Red
    exit
}

if (!(Test-Path $DataPath)) {
    New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
    Write-Host "[INFO] Created data directory at $DataPath" -ForegroundColor Green
}

# 3. Install Dependencies
Write-Host "[INFO] Installing Python dependencies (FastAPI, SQLite, MCP)..." -ForegroundColor Yellow
python -m pip install fastapi uvicorn aiosqlite mcp pydantic-settings httpx sse-starlette --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Pip failed to install some dependencies. Please check your internet connection." -ForegroundColor Yellow
}

# 4. Final Instructions
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " [SUCCESS] GreenArrow Hub is ready!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "HOW TO USE:"
Write-Host "1. Browser: Install the GreenArrow Extension."
Write-Host "2. VS Code: Install the GreenArrow Pro Extension."
Write-Host "3. Done: The Hub will start automatically when you open VS Code."
Write-Host ""
Write-Host "No Docker required. No manual terminal required."
Write-Host "================================================" -ForegroundColor Cyan

Pause
