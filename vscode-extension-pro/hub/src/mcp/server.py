import asyncio
import os
import json
from mcp.server.models import InitializationOptions
from mcp.server import Notification, Server
from mcp.server.stdio import stdio_server
import mcp.types as types
from ..core.database import GreenArrowDB

server = Server("greenarrow-hub")

@server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    """Lists available bridged chat sessions as resources."""
    # Note: For the MCP server to know which pairing key to use, 
    # we might need to store a 'default' or 'active' key in settings.
    # For now, we list the most recent sessions.
    
    # Placeholder: In a real implementation, we'd fetch from SQLite
    return [
        types.Resource(
            uri=f"greenarrow://sessions/latest",
            name="Latest Bridged Context",
            description="The most recent context bridged from your browser.",
            mimeType="application/xml"
        )
    ]

@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Reads the content of a bridged session."""
    if uri.startswith("greenarrow://sessions/"):
        # Fetch the latest snapshot from SQLite
        # We'll use a generic key for now or fetch the last one touched
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT snapshot FROM sessions ORDER BY captured_at DESC LIMIT 1") as cursor:
                row = await cursor.fetchone()
                if row:
                    return row[0]
    
    raise ValueError(f"Resource not found: {uri}")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available tools for context management."""
    return [
        types.Tool(
            name="get_last_bridge",
            description="Retrieve the last context snapshot bridged from the browser.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    """Handle tool calls for fetching context."""
    if name == "get_last_bridge":
        # Implementation to fetch from SQLite
        return [types.TextContent(type="text", text="<xml>Placeholder Context</xml>")]
    
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="greenarrow-hub",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=Notification(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
