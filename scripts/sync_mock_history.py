import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid

async def sync_history():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.context_bridge
    
    mock_chats = [
        {"title": "Fixing ContextBridge Archive UI", "time_offset": -2},
        {"title": "Updating ContextBridge Extension Code", "time_offset": -8},
        {"title": "Resolving ContextBridge Deployment Errors", "time_offset": -49},
        {"title": "Fixing Claude Desktop MCP Extension", "time_offset": -1440},
        {"title": "Validating ContextBridge Service Deployment", "time_offset": -1440},
        {"title": "Design an landing page for vision-rcp", "time_offset": -20160},
    ]
    
    for chat in mock_chats:
        session_id = str(uuid.uuid4())
        created_at = datetime.utcnow() + timedelta(minutes=chat["time_offset"])
        
        # Create a mock conversation document
        doc = {
            "_id": session_id,
            "user_id": "current_user",
            "platform": "antigravity",
            "messages": [
                {"role": "user", "content": f"Request: {chat['title']}"},
                {"role": "assistant", "content": f"Working on {chat['title']}... Here is the summary of progress."}
            ],
            "created_at": created_at,
            "snapshot": f"<CONTEXT_HANDOFF>\n  <GOAL>{chat['title']}</GOAL>\n  <STATE>In Progress</STATE>\n</CONTEXT_HANDOFF>"
        }
        
        await db.conversations.update_one(
            {"_id": session_id},
            {"$set": doc},
            upsert=True
        )
        print(f"Synced: {chat['title']}")

if __name__ == "__main__":
    asyncio.run(sync_history())
