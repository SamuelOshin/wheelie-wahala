"""A local stand-in for start.ng's live room (startng-be app/live.py), for testing live races.

    uv pip install --python .venv websockets
    .venv/Scripts/python tools/live-mock.py          # listens on ws://localhost:8770

Then open the game twice with  ?live=ws://localhost:8770&as=Ada  and  ...&as=Bola
Same messages and limits as the real room: positions clamped to ±60 m, angle wrapped to 0–2π,
chat echoed to everyone (sender too) with a server time, 25 moves a second at most.
"""
import asyncio
import itertools
import json
import math
import time
from urllib.parse import parse_qs, urlparse

import websockets

WORLD = 60.0
MOVE_EVERY = 0.04
CHAT_EVERY = 0.7
STYLES = [
    {"body": "female", "primaryColor": "#a55eea", "secondaryColor": "#0c6e5a", "skinColor": "#8d5524", "hairColor": "#17120f", "hair": "braids", "hat": "crown", "accessory": "earrings"},
    {"body": "male", "primaryColor": "#4b7bec", "secondaryColor": "#2b2f4a", "skinColor": "#e0ac69", "hairColor": "#6b3e1f", "hair": "afro", "hat": "cap", "accessory": "glasses"},
]
players = {}  # id -> dict(ws, name, style, x, z, ry, moving, last_move, last_chat)
ids = itertools.count(1)


def public(pid, p):
    return {"id": pid, "name": p["name"], "style": p["style"], "seat": None, "x": p["x"], "z": p["z"], "ry": p["ry"], "moving": p["moving"]}


async def broadcast(msg, skip=None):
    data = json.dumps(msg)
    for pid, p in list(players.items()):
        if pid != skip:
            try:
                await p["ws"].send(data)
            except Exception:
                pass


async def handler(ws):
    query = parse_qs(urlparse(ws.request.path).query)
    ticket = query.get("ticket", [""])[0]
    if not ticket.startswith("dev-"):
        await ws.close(4401, "bad ticket")
        return
    pid = next(ids)
    name = ticket[4:][:20] or f"Rider {pid}"
    me = {"ws": ws, "name": name, "style": STYLES[pid % len(STYLES)], "x": None, "z": None, "ry": 0.0, "moving": False, "last_move": 0.0, "last_chat": 0.0}
    players[pid] = me
    await ws.send(json.dumps({"type": "welcome", "you": pid, "players": [public(i, p) for i, p in players.items()], "seats": [], "chat": []}))
    await broadcast({"type": "join", "player": public(pid, me)}, skip=pid)
    print(f"+ {name} ({pid}), {len(players)} in the room")
    try:
        async for text in ws:
            if len(text) > 512:
                continue
            try:
                msg = json.loads(text)
            except ValueError:
                continue
            now = time.monotonic()
            if msg.get("type") == "move":
                x, z, ry = msg.get("x"), msg.get("z"), msg.get("ry")
                if not all(isinstance(v, (int, float)) for v in (x, z, ry)) or now - me["last_move"] < MOVE_EVERY:
                    continue
                me["last_move"] = now
                me["x"], me["z"] = max(-WORLD, min(WORLD, x)), max(-WORLD, min(WORLD, z))
                me["ry"] = ry % (2 * math.pi)
                me["moving"] = msg.get("moving") is True
                await broadcast({"type": "move", "id": pid, "x": me["x"], "z": me["z"], "ry": me["ry"], "moving": me["moving"]}, skip=pid)
            elif msg.get("type") == "chat":
                t = str(msg.get("text", "")).strip()[:200]
                if not t or now - me["last_chat"] < CHAT_EVERY:
                    continue
                me["last_chat"] = now
                await broadcast({"type": "chat", "id": pid, "name": name, "text": t, "at": int(time.time() * 1000)})
    finally:
        players.pop(pid, None)
        await broadcast({"type": "leave", "id": pid, "seat": None})
        print(f"- {name} ({pid}), {len(players)} in the room")


async def main():
    async with websockets.serve(handler, "localhost", 8770):
        print("live mock on ws://localhost:8770")
        await asyncio.Future()


asyncio.run(main())
