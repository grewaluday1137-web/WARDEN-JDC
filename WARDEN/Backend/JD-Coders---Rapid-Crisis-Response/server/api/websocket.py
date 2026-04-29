import asyncio
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] New connection. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WS] Client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast to all active connections. Dead connections are pruned automatically."""
        if not self.active_connections:
            return

        dead: list[WebSocket] = []
        # Snapshot the list to avoid mutation-during-iteration issues
        targets = list(self.active_connections)

        results = await asyncio.gather(
            *[conn.send_json(message) for conn in targets],
            return_exceptions=True,
        )

        for conn, result in zip(targets, results):
            if isinstance(result, Exception):
                print(f"[WS] Pruning dead connection: {result}")
                dead.append(conn)

        for conn in dead:
            self.disconnect(conn)

        if targets:
            print(f"[WS] Broadcast sent to {len(targets) - len(dead)}/{len(targets)} clients")


manager = ConnectionManager()