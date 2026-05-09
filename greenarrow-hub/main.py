import sys
import argparse
import uvicorn
import logging
from src.hub import app
from src.core.database import init_db

def start_api(port: int):
    logging.info(f"Starting GreenArrow API Hub on port {port}...")
    uvicorn.run(app, host="127.0.0.1", port=port)

def start_mcp():
    logging.info("Starting GreenArrow MCP Server...")
    from src.mcp.server import main as mcp_main
    import asyncio
    asyncio.run(mcp_main())

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GreenArrow Hub CLI")
    parser.add_argument("mode", choices=["api", "mcp", "both"], help="Service mode to run")
    parser.add_argument("--port", type=int, default=8000, help="API Port")
    
    args = parser.parse_args()

    if args.mode == "api":
        start_api(args.port)
    elif args.mode == "mcp":
        start_mcp()
    elif args.mode == "both":
        # In a real production setup, we'd use multiprocessing or a manager
        # For this prototype, we'll suggest running them separately or using a task manager
        print("[INFO] Run 'api' and 'mcp' in separate processes for now.")
