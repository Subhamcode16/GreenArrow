@echo off
SETLOCAL EnableDelayedExpansion

echo ==================================================
echo         CONTEXTBRIDGE ONE-CLICK STARTUP
echo ==================================================

:: 1. Check for Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not running.
    echo Please install Docker Desktop from https://www.docker.com/
    pause
    exit /b
)

:: 2. Check for .env file
if not exist .env (
    echo [INFO] .env file not found. Creating from .env.example...
    copy .env.example .env
    echo [IMPORTANT] Please update your .env with your LLM API Keys!
    pause
)

:: 3. Install Python Dependencies (MCP Server Support)
echo [INFO] Checking Python dependencies...
python -m pip install mcp motor pydantic-settings httpx celery redis cryptography tiktoken pymongo --quiet
if %errorlevel% neq 0 (
    echo [WARNING] Python or Pip failed to install dependencies. 
    echo MCP server features might be disabled.
)

:: 3. Launch Docker Compose
echo [INFO] Building and launching ContextBridge services...
docker-compose up --build -d

echo [SUCCESS] ContextBridge is now running!
echo --------------------------------------------------
echo API Proxy:     http://localhost:8000
echo DB Console:    mongodb://localhost:27017
echo Redis:         redis://localhost:6379
echo --------------------------------------------------
echo [HINT] Point your AI tools (Cursor/Copilot) to:
echo Base URL: http://localhost:8000/v1
echo --------------------------------------------------

pause
