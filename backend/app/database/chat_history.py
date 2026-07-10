"""
database/chat_history.py - In-memory + JSON-persisted conversation history.

WHY CHAT HISTORY?
Multi-turn conversation requires the LLM to remember previous exchanges.
We store messages per session_id and inject the last N turns into the prompt.
This gives the model "memory" without exceeding the context window.

STORAGE: JSON file per session in vectorstore/sessions/
This is simple and sufficient for a single-server deployment.
For production scale, swap to Redis or PostgreSQL.
"""

import json
from pathlib import Path
from datetime import datetime
from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

SESSIONS_DIR = Path(settings.VECTORSTORE_DIR) / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

MAX_HISTORY_TURNS = 10   # keep last 10 user+assistant pairs = 20 messages


def _session_path(session_id: str) -> Path:
    # Sanitize session_id to prevent path traversal
    safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
    return SESSIONS_DIR / f"{safe_id}.json"


def load_history(session_id: str) -> list[dict]:
    """Load conversation history for a session. Returns [] if not found."""
    path = _session_path(session_id)
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_message(session_id: str, role: str, content: str) -> None:
    """Append a message to the session history and persist to disk."""
    history = load_history(session_id)
    history.append({
        "role": role,
        "content": content,
        "created_at": datetime.utcnow().isoformat(),
    })
    # Store first user message as session title
    if role == "user" and not any(m["role"] == "user" for m in history[:-1]):
        history[0]["_title"] = content[:60]
    path = _session_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def get_recent_history(session_id: str, max_turns: int = MAX_HISTORY_TURNS) -> list[dict]:
    """
    Returns the last max_turns pairs (user + assistant) as LangChain-compatible
    message dicts: [{"role": "user"|"assistant", "content": "..."}]
    """
    history = load_history(session_id)
    # Each turn = 1 user + 1 assistant message = 2 entries
    recent = history[-(max_turns * 2):]
    return [{"role": m["role"], "content": m["content"]} for m in recent]


def clear_history(session_id: str) -> None:
    """Delete the session history file."""
    path = _session_path(session_id)
    if path.exists():
        path.unlink()
        logger.info(f"Cleared history for session={session_id}")


def list_sessions() -> list[dict]:
    """Return all sessions with metadata for the history panel."""
    sessions = []
    for p in sorted(SESSIONS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            with open(p, "r", encoding="utf-8") as f:
                messages = json.load(f)
            if not messages:
                continue
            first_user = next((m for m in messages if m["role"] == "user"), None)
            title = messages[0].get("_title") or (first_user["content"][:60] if first_user else "New Chat")
            sessions.append({
                "session_id": p.stem,
                "title": title,
                "message_count": len([m for m in messages if not m.get("_title")]),
                "created_at": messages[0].get("created_at", datetime.utcnow().isoformat()),
                "updated_at": messages[-1].get("created_at", datetime.utcnow().isoformat()),
            })
        except Exception:
            continue
    return sessions
