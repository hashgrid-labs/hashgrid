"""Hashgrid API resources."""

from dataclasses import dataclass
from typing import Optional, List, AsyncIterator, TYPE_CHECKING
import asyncio
import logging

if TYPE_CHECKING:
    from .client import Hashgrid

logger = logging.getLogger(__name__)


class GridNodes:
    """Nodes namespace: list, get, create."""

    def __init__(self, client: "Hashgrid"):
        self._client = client

    async def list(self) -> AsyncIterator["Node"]:
        """Iterate over all nodes owned by the authenticated user (async generator)."""
        list_data = await self._client.request("GET", "/api/v1/node")
        for item in list_data:
            yield Node(
                node_id=str(item["node_id"]),
                name=item["name"],
                message=item.get("message", ""),
                capacity=item["capacity"],
                client=self._client,
            )

    async def get(self, id: str) -> "Node":
        """Get a node by id."""
        data = await self._client.request("GET", f"/api/v1/node/{id}")
        return Node(
            node_id=str(data["node_id"]),
            name=data["name"],
            message=data.get("message", ""),
            capacity=data["capacity"],
            client=self._client,
        )

    async def create(
        self, *, name: str, message: str = "", capacity: int = 1
    ) -> "Node":
        """Create a new node. name (required), message (optional), capacity (optional, default 1)."""
        body = {"name": name, "message": message, "capacity": capacity}
        data = await self._client.request("POST", "/api/v1/node", json_data=body)
        logger.info(f"Created node '{name}' (ID: {data['node_id']})")
        return Node(
            node_id=str(data["node_id"]),
            name=data["name"],
            message=data.get("message", ""),
            capacity=data["capacity"],
            client=self._client,
        )


@dataclass
class User:
    """User resource."""

    user_id: str
    name: str
    is_superuser: bool
    quota_id: str


@dataclass
class Quota:
    """Quota resource."""

    quota_id: str
    name: str
    capacity: int


@dataclass
class Recv:
    """Recv packet from a peer."""

    peer_id: str
    message: str


@dataclass
class Send:
    """Send packet to a peer."""

    peer_id: str
    score: float


class Grid:
    """Grid resource with methods."""

    def __init__(self, name: str, tick: int, client: "Hashgrid"):
        self.name = name
        self.tick = tick
        self._client = client
        self.nodes = GridNodes(client)

    async def me(self) -> User:
        """Get the authenticated user's information."""
        logger.info("Fetching user information")
        data = await self._client.request("GET", "/api/v1/me")
        user = User(
            user_id=data["user_id"],
            name=data["name"],
            is_superuser=data.get("is_superuser", False),
            quota_id=data["quota_id"],
        )
        logger.info(f"Fetched user '{user.name}' (ID: {user.user_id})")
        return user

    async def quota(self) -> Quota:
        """Get the authenticated user's quota information."""
        logger.info("Fetching quota information")
        data = await self._client.request("GET", "/api/v1/quota")
        quota = Quota(
            quota_id=data["quota_id"],
            name=data["name"],
            capacity=data["capacity"],
        )
        logger.info(f"Fetched quota '{quota.name}' with capacity {quota.capacity}")
        return quota

    async def poll(self) -> int:
        """Poll for the next tick update. Returns the new tick value."""
        data = await self._client.request("GET", "/api/v1/poll")
        new_tick = (
            int(data) if isinstance(data, (int, str)) else data.get("tick", self.tick)
        )
        logger.info(f"Tick updated: {self.tick} -> {new_tick}")
        self.tick = new_tick
        return new_tick


class Node:
    """Node resource with recv/send methods."""

    def __init__(
        self,
        node_id: str,
        name: str,
        message: str,
        capacity: int,
        client: "Hashgrid",
    ):
        self.node_id = node_id
        self.name = name
        self.message = message
        self.capacity = capacity
        self._client = client
        self._lock = asyncio.Lock()

    async def recv(self) -> List[Recv]:
        """Receive packets from matched peers."""
        async with self._lock:
            data = await self._client.request(
                "GET", f"/api/v1/node/{self.node_id}/recv"
            )
            packets = [
                Recv(peer_id=str(item["peer_id"]), message=item["message"])
                for item in data
            ]
            if packets:
                logger.info(
                    f"Node '{self.name}' received {len(packets)} packet(s) from peers"
                )
            return packets

    async def send(self, packets: List[Send]) -> List[Send]:
        """Send packets to peers. Returns the sends that were accepted."""
        async with self._lock:
            logger.info(
                f"Node '{self.name}' sending {len(packets)} packet(s) to peer(s)"
            )
            body = [{"peer_id": msg.peer_id, "score": msg.score} for msg in packets]
            data = await self._client.request(
                "POST", f"/api/v1/node/{self.node_id}/send", json_data=body
            )
            result = [
                Send(peer_id=str(item["peer_id"]), score=item["score"]) for item in data
            ]
            logger.info(f"Node '{self.name}' sent {len(result)} packet(s) successfully")
            return result

    async def update(
        self,
        name: Optional[str] = None,
        message: Optional[str] = None,
        capacity: Optional[int] = None,
    ) -> "Node":
        """Update this node's name, message, and/or capacity."""
        if name is not None or message is not None or capacity is not None:
            payload = {}
            if name is not None:
                payload["name"] = name
            if message is not None:
                payload["message"] = message
            if capacity is not None:
                payload["capacity"] = capacity
            logger.info(f"Updating node '{self.name}' (ID: {self.node_id})")
            data = await self._client.request(
                "PATCH", f"/api/v1/node/{self.node_id}", json_data=payload
            )
            self.name = data.get("name", self.name)
            self.message = data.get("message", self.message)
            self.capacity = data.get("capacity", self.capacity)
            logger.info(f"Node '{self.name}' updated successfully")
        return self

    async def delete(self) -> None:
        """Delete this node."""
        logger.info(f"Deleting node '{self.name}' (ID: {self.node_id})")
        await self._client.request("DELETE", f"/api/v1/node/{self.node_id}")
        logger.info(f"Node '{self.name}' deleted successfully")
