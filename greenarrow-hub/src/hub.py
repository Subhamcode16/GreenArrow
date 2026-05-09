import uvicorn
import os
import uuid
import logging
from fastapi import FastAPI, HTTPException, Header, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from .core.database import init_db, GreenArrowDB

# Setup Logging
import sys
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("GreenArrowHub")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    await init_db()
    logger.info("GreenArrow Hub Core is ready.")
    yield
    # Shutdown logic (optional)

app = FastAPI(
    title="GreenArrow Hub", 
    version="2.0.0",
    lifespan=lifespan
)

# CORS for Browser Extension & IDE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "online", "mode": "standalone", "db": "sqlite"}

# --- RELAY API (Browser -> Hub -> IDE) ---

@app.post("/v1/relay/push")
async def push_to_relay(payload: Dict[str, Any], x_api_key: str = Header(...)):
    """Receives data from browser extension and buffers it in SQLite."""
    session_id = payload.get("session_id", str(uuid.uuid4()))
    payload["session_id"] = session_id
    
    await GreenArrowDB.push_relay(x_api_key, payload)
    await GreenArrowDB.save_session(session_id, x_api_key, payload)
    
    logger.info(f"Relay: Synced session from {payload.get('source')} (Key: {x_api_key[:8]}...)")
    
    return {"status": "buffered", "session_id": session_id}

# --- Audit/Memory Guard Compatibility ---
audit_router = APIRouter(prefix="/v1/audit", tags=["audit"])

@audit_router.get("/latest")
async def get_latest_audit():
    """Returns a dummy audit report to satisfy legacy polling."""
    return {
        "status": "healthy",
        "usage_percent": 0,
        "is_alert": False,
        "message": "Memory Guard active"
    }

app.include_router(audit_router)

@app.get("/v1/relay/pull")
async def pull_from_relay(x_api_key: str = Header(...)):
    """Retrieves buffered data for the IDE."""
    chats = await GreenArrowDB.pull_relay(x_api_key)
    if chats:
        logger.info(f"Relay PULL for {x_api_key[:8]}: Found {len(chats)} chats.")
    return {"chats": chats}

# --- HANDOFF & SESSIONS ---

@app.get("/v1/sessions")
async def get_sessions(x_api_key: str = Header(...)):
    """Returns persistent session history."""
    sessions = await GreenArrowDB.get_sessions(x_api_key)
    logger.info(f"Sessions FETCH for {x_api_key[:8]}: Returning {len(sessions)} records.")
    return {"sessions": sessions}

@app.post("/v1/handoff/generate")
async def generate_handoff(payload: Dict[str, Any], x_api_key: str = Header(...)):
    """
    Generates a High-Density XML Handoff.
    Note: In production version, we use a local summarization strategy or direct mapping.
    """
    messages = payload.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="No content to bridge")

    # Simple high-density snapshot generation (Stateless)
    # TODO: Add local Gemini integration if key is available
    
    content_preview = "\n".join([f"{m.get('role')}: {m.get('content', '')[:100]}" for m in messages])
    
    xml_snapshot = f"""<greenarrow_snapshot version="2.0">
  <metadata>
    <captured_at>{uuid.uuid4()}</captured_at>
    <source>{payload.get('source', 'web')}</source>
  </metadata>
  <content>
    <![CDATA[
    {content_preview}
    ]]>
  </content>
</greenarrow_snapshot>"""

    # Save to persistent history
    session_id = payload.get("session_id", str(uuid.uuid4()))
    await GreenArrowDB.save_session(session_id, x_api_key, {
        "source": payload.get("source"),
        "messages": messages,
        "snapshot": xml_snapshot
    })

    return {"snapshot": xml_snapshot}

if __name__ == "__main__":
    # In a real production build, this would be triggered via the CLI entrypoint
    uvicorn.run(app, host="127.0.0.1", port=8000)
