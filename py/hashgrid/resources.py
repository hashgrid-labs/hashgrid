"""Hashgrid API resources."""

from dataclasses import dataclass
from typing import Optional, List, AsyncIterator, TYPE_CHECKING
import logging

if TYPE_CHECKING:
    from .client import Hashgrid

logger = logging.getLogger(__name__)


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
class Message:
    """Message resource."""

    peer_id: str
    message: str
    score: float


class Grid:
    """Grid resource with methods."""

    def __init__(self, name: str, tick: int, client: "Hashgrid"):
        self.name = name
        self.tick = tick
        self._client = client

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

    async def nodes(self) -> AsyncIterator["Node"]:
        """Iterate over all nodes owned by the authenticated user."""
        list_data = await self._client.request("GET", "/api/v1/node")
        for item in list_data:
            yield Node(
                node_id=str(item["node_id"]),
                name=item["name"],
                capacity=item["capacity"],
                message=item["message"],
                client=self._client,
            )

    async def create_node(self, name: str, message: str, capacity: int = 1) -> "Node":
        """Create a new node."""
        body = {"name": name, "message": message, "capacity": capacity}
        data = await self._client.request("POST", "/api/v1/node", json_data=body)
        logger.info(f"Created node '{name}' (ID: {data['node_id']})")
        return Node(
            node_id=str(data["node_id"]),
            name=data["name"],
            capacity=data["capacity"],
            message=data["message"],
            client=self._client,
        )


class Node:
    """Node resource with recv/send methods."""

    def __init__(
        self,
        node_id: str,
        name: str,
        capacity: int,
        message: str,
        client: "Hashgrid",
    ):
        self.node_id = node_id
        self.name = name
        self.capacity = capacity
        self.message = message
        self._client = client

    async def recv(self) -> List[Message]:
        """Get peers waiting for a response."""
        data = await self._client.request("GET", f"/api/v1/node/{self.node_id}/recv")
        messages = [
            Message(
                peer_id=item["peer_id"],
                message=item["message"],
                score=item["score"],
            )
            for item in data
        ]
        if messages:
            logger.info(
                f"Node '{self.name}' received {len(messages)} message(s) from peers"
            )
        return messages

    async def send(self, replies: List[Message]) -> List[Message]:
        """Send replies to peers. Returns the updated messages that were sent."""
        logger.info(
            f"Node '{self.name}' sending {len(replies)} reply/replies to peer(s)"
        )
        body = [
            {
                "peer_id": msg.peer_id,
                "message": msg.message,
                "score": msg.score,
            }
            for msg in replies
        ]
        data = await self._client.request(
            "POST", f"/api/v1/node/{self.node_id}/send", json_data=body
        )
        messages = [
            Message(
                peer_id=item["peer_id"],
                message=item["message"],
                score=item["score"],
            )
            for item in data
        ]
        logger.info(
            f"Node '{self.name}' sent {len(messages)} reply/replies successfully"
        )
        return messages

    async def update(
        self,
        name: Optional[str] = None,
        capacity: Optional[int] = None,
        message: Optional[str] = None,
    ) -> "Node":
        """Update this node's name, capacity, and/or message."""
        if name is not None or capacity is not None or message is not None:
            payload = {}
            if name is not None:
                payload["name"] = name
            if capacity is not None:
                payload["capacity"] = capacity
            if message is not None:
                payload["message"] = message
            logger.info(f"Updating node '{self.name}' (ID: {self.node_id})")
            data = await self._client.request(
                "PATCH", f"/api/v1/node/{self.node_id}", json_data=payload
            )
            self.name = data.get("name", self.name)
            self.capacity = data.get("capacity", self.capacity)
            self.message = data.get("message", self.message)
            logger.info(f"Node '{self.name}' updated successfully")
        return self

    async def delete(self) -> None:
        """Delete this node."""
        logger.info(f"Deleting node '{self.name}' (ID: {self.node_id})")
        await self._client.request("DELETE", f"/api/v1/node/{self.node_id}")
        logger.info(f"Node '{self.name}' deleted successfully")
