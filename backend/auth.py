import sqlite3
import os
import uuid
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager

import bcrypt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel


SECRET_KEY = os.getenv("JWT_SECRET_KEY", "suture-hackathon-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

DB_PATH = os.path.join(os.path.dirname(__file__), "suture.db")

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sutures (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                prompt TEXT,
                original_image_url TEXT,
                preprocessed_image_url TEXT,
                svg_url TEXT,
                dst_url TEXT,
                dst_id TEXT,
                stitch_count INTEGER DEFAULT 0,
                dimensions_mm TEXT,
                thread_colors TEXT,
                svg_reviewed INTEGER DEFAULT 0,
                dst_reviewed INTEGER DEFAULT 0,
                agent_feedback TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserOut(BaseModel):
    id: str
    email: str
    name: str


class SutureRecord(BaseModel):
    id: str
    prompt: str | None
    original_image_url: str | None
    preprocessed_image_url: str | None
    svg_url: str | None
    dst_url: str | None
    dst_id: str | None
    stitch_count: int
    dimensions_mm: list[float] | None
    thread_colors: list[dict] | None
    svg_reviewed: bool
    dst_reviewed: bool
    agent_feedback: str | None
    created_at: str


class SaveSutureRequest(BaseModel):
    prompt: str | None = None
    original_image_url: str | None = None
    preprocessed_image_url: str | None = None
    svg_url: str | None = None
    dst_url: str | None = None
    dst_id: str | None = None
    stitch_count: int = 0
    dimensions_mm: list[float] | None = None
    thread_colors: list[dict] | None = None
    svg_reviewed: bool = False
    dst_reviewed: bool = False
    agent_feedback: str | None = None


# ---------------------------------------------------------------------------
# JWT Helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    with get_db() as conn:
        row = conn.execute("SELECT id, email, name FROM users WHERE id = ?", (user_id,)).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    return {"id": row["id"], "email": row["email"], "name": row["name"]}


# ---------------------------------------------------------------------------
# Auth Route Handlers
# ---------------------------------------------------------------------------

def register_user(req: RegisterRequest) -> AuthResponse:
    if not req.email or not req.password or not req.name:
        raise HTTPException(status_code=400, detail="All fields are required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(req.password)
    now = datetime.now(timezone.utc).isoformat()

    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, req.email.lower().strip(), req.name.strip(), password_hash, now),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    token = create_access_token(user_id)
    return AuthResponse(
        token=token,
        user={"id": user_id, "email": req.email.lower().strip(), "name": req.name.strip()},
    )


def login_user(req: LoginRequest) -> AuthResponse:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, name, password_hash FROM users WHERE email = ?",
            (req.email.lower().strip(),),
        ).fetchone()

    if row is None or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(row["id"])
    return AuthResponse(
        token=token,
        user={"id": row["id"], "email": row["email"], "name": row["name"]},
    )


# ---------------------------------------------------------------------------
# Suture History Handlers
# ---------------------------------------------------------------------------

def save_suture(user_id: str, req: SaveSutureRequest) -> SutureRecord:
    import json as _json

    suture_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    dims_json = _json.dumps(req.dimensions_mm) if req.dimensions_mm else None
    colors_json = _json.dumps(req.thread_colors) if req.thread_colors else None

    with get_db() as conn:
        conn.execute(
            """INSERT INTO sutures
               (id, user_id, prompt, original_image_url, preprocessed_image_url,
                svg_url, dst_url, dst_id, stitch_count, dimensions_mm, thread_colors,
                svg_reviewed, dst_reviewed, agent_feedback, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                suture_id, user_id, req.prompt, req.original_image_url,
                req.preprocessed_image_url, req.svg_url, req.dst_url, req.dst_id,
                req.stitch_count, dims_json, colors_json,
                int(req.svg_reviewed), int(req.dst_reviewed),
                req.agent_feedback, now,
            ),
        )

    return _row_to_suture_record({
        "id": suture_id, "prompt": req.prompt,
        "original_image_url": req.original_image_url,
        "preprocessed_image_url": req.preprocessed_image_url,
        "svg_url": req.svg_url, "dst_url": req.dst_url, "dst_id": req.dst_id,
        "stitch_count": req.stitch_count, "dimensions_mm": dims_json,
        "thread_colors": colors_json, "svg_reviewed": int(req.svg_reviewed),
        "dst_reviewed": int(req.dst_reviewed), "agent_feedback": req.agent_feedback,
        "created_at": now,
    })


def get_user_sutures(user_id: str) -> list[SutureRecord]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM sutures WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()

    return [_row_to_suture_record(dict(r)) for r in rows]


def _row_to_suture_record(row: dict) -> SutureRecord:
    import json as _json

    dims = None
    if row.get("dimensions_mm"):
        try:
            dims = _json.loads(row["dimensions_mm"]) if isinstance(row["dimensions_mm"], str) else row["dimensions_mm"]
        except Exception:
            pass

    colors = None
    if row.get("thread_colors"):
        try:
            colors = _json.loads(row["thread_colors"]) if isinstance(row["thread_colors"], str) else row["thread_colors"]
        except Exception:
            pass

    return SutureRecord(
        id=row["id"],
        prompt=row.get("prompt"),
        original_image_url=row.get("original_image_url"),
        preprocessed_image_url=row.get("preprocessed_image_url"),
        svg_url=row.get("svg_url"),
        dst_url=row.get("dst_url"),
        dst_id=row.get("dst_id"),
        stitch_count=row.get("stitch_count", 0),
        dimensions_mm=dims,
        thread_colors=colors,
        svg_reviewed=bool(row.get("svg_reviewed")),
        dst_reviewed=bool(row.get("dst_reviewed")),
        agent_feedback=row.get("agent_feedback"),
        created_at=row["created_at"],
    )
