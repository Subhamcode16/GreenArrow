import aiosqlite
import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "greenarrow.db")

async def init_db():
    """Initializes the SQLite database with required tables."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Table for the Relay Queue (Temporary buffer for extension data)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS relay_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pairing_key TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Table for Persistent Sessions (The Handoff History)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                pairing_key TEXT NOT NULL,
                source TEXT,
                snippet TEXT,
                full_content TEXT,
                snapshot TEXT,
                captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Table for Settings
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        await db.commit()
    logging.info(f"GreenArrow Database initialized at {DB_PATH}")

class GreenArrowDB:
    @staticmethod
    async def push_relay(pairing_key: str, data: Dict[str, Any]):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO relay_queue (pairing_key, data) VALUES (?, ?)",
                (pairing_key, json.dumps(data))
            )
            await db.commit()

    @staticmethod
    async def pull_relay(pairing_key: str) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(
                "SELECT id, data FROM relay_queue WHERE pairing_key = ? ORDER BY created_at ASC",
                (pairing_key,)
            ) as cursor:
                rows = await cursor.fetchall()
                
                results = []
                ids_to_delete = []
                for row_id, data_str in rows:
                    results.append(json.loads(data_str))
                    ids_to_delete.append(row_id)
                
                if ids_to_delete:
                    await db.execute(
                        f"DELETE FROM relay_queue WHERE id IN ({','.join('?' * len(ids_to_delete))})",
                        ids_to_delete
                    )
                    await db.commit()
                
                return results

    @staticmethod
    async def save_session(session_id: str, pairing_key: str, data: Dict[str, Any]):
        async with aiosqlite.connect(DB_PATH) as db:
            snippet = data.get("snippet")
            if not snippet:
                content = data.get("content", "")
                messages = data.get("messages", [])
                if messages:
                    snippet = messages[0].get("content", "")[:100]
                else:
                    snippet = content[:100]

            full_content = data.get("content") or json.dumps(data.get("messages", []))

            await db.execute("""
                INSERT OR REPLACE INTO sessions 
                (session_id, pairing_key, source, snippet, full_content, snapshot)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                session_id, 
                pairing_key, 
                data.get("source", "web"), 
                snippet,
                full_content,
                data.get("snapshot")
            ))
            await db.commit()

    @staticmethod
    async def get_sessions(pairing_key: str) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM sessions WHERE pairing_key = ? ORDER BY captured_at DESC",
                (pairing_key,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
