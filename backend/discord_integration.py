import httpx
import asyncio
import json
import os
from pathlib import Path

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_CHANNEL_ID = os.getenv("DISCORD_CHANNEL_ID", "")
AGENT_USER_ID = "1477635385608765440"

POLL_INTERVAL_SECONDS = 5
POLL_TIMEOUT_SECONDS = 300  # 5 minutes


async def send_files_to_agent(message: str, file_paths: list[str] | None = None) -> str | None:
    """Send a message + optional file attachments to Discord via webhook.

    Uses ``?wait=true`` so Discord returns the created message object,
    giving us the message ID we need for polling.

    Returns the sent message ID, or None on failure.
    """
    if not DISCORD_WEBHOOK_URL:
        return None

    payload = {"content": f"<@{AGENT_USER_ID}> {message}"}
    url = f"{DISCORD_WEBHOOK_URL}?wait=true"

    if not file_paths:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                return resp.json().get("id")
            return None
        except Exception:
            return None

    open_handles: list = []
    files_list: list[tuple] = []
    try:
        for i, fp in enumerate(file_paths):
            p = Path(fp)
            fh = open(p, "rb")
            open_handles.append(fh)
            files_list.append((f"files[{i}]", (p.name, fh, "application/octet-stream")))

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                data={"payload_json": json.dumps(payload)},
                files=files_list,
            )

        if resp.status_code == 200:
            return resp.json().get("id")
        return None
    finally:
        for fh in open_handles:
            fh.close()


async def poll_for_agent_response(
    after_message_id: str,
    timeout: int = POLL_TIMEOUT_SECONDS,
) -> dict | None:
    """Poll the Discord channel for the agent's reply after our message.

    Returns ``{"content": str, "attachment_urls": list[str]}`` when the
    agent responds, or ``None`` on timeout.
    """
    if not DISCORD_BOT_TOKEN or not DISCORD_CHANNEL_ID:
        return None

    headers = {"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
    api_url = f"https://discord.com/api/v10/channels/{DISCORD_CHANNEL_ID}/messages"

    elapsed = 0
    while elapsed < timeout:
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        elapsed += POLL_INTERVAL_SECONDS

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    api_url,
                    headers=headers,
                    params={"after": after_message_id, "limit": 20},
                )

            if resp.status_code != 200:
                continue

            messages = resp.json()
            for msg in messages:
                author_id = msg.get("author", {}).get("id")
                if author_id == AGENT_USER_ID:
                    attachments = msg.get("attachments", [])
                    return {
                        "content": msg.get("content", ""),
                        "attachment_urls": [att["url"] for att in attachments],
                    }
        except Exception:
            continue

    return None


async def download_file(url: str, save_path: str) -> bool:
    """Download a file from a URL and save it locally."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code == 200:
                Path(save_path).write_bytes(resp.content)
                return True
    except Exception:
        pass
    return False
