"""Hashgrid API resources."""

from dataclasses import dataclass
from typing import Optional, List, AsyncIterator, TYPE_CHECKING
import asyncio
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
    size: int


@dataclass
class Edge:
    """Edge resource."""

    node_id: str
    peer_id: str
    recv_message: str
    send_message: Optional[str]
    score: Optional[float]
    round: int


@dataclass
class Message:
    """Message resource."""

    peer_id: str
    round: int
    message: str = ""
    score: Optional[float] = None


@dataclass
class Status:
    """Status resource."""

    peer_id: str
    round: int
    success: bool


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
            size=data["size"],
        )
        logger.info(f"Fetched quota '{quota.name}' with size {quota.size}")
        return quota

    async def tick(self) -> int:
        """Get the next tick update. Returns the new tick value."""
        data = await self._client.request(
            "GET", "/api/v1/tick", params={"tick": self.tick}
        )
        new_tick = (
            int(data) if isinstance(data, (int, str)) else data.get("tick", self.tick)
        )
        logger.info(f"Tick updated: {self.tick} -> {new_tick}")
        self.tick = new_tick
        return new_tick

    async def nodes(self) -> AsyncIterator["Node"]:
        """Iterate over all nodes owned by the authenticated user."""
        data = await self._client.request("GET", "/api/v1/node")
        for item in data:
            node = Node(**item, client=self._client)
            yield node

    async def create_node(self, name: str, message: str = "", size: int = 1) -> "Node":
        """Create a new node."""
        json_data = {"name": name, "message": message, "size": size}
        data = await self._client.request("POST", "/api/v1/node", json_data=json_data)
        logger.info(f"Created node '{name}' (ID: {data['node_id']})")
        return Node(**data, client=self._client)


class Node:
    """Node resource with recv/send methods."""

    def __init__(
        self,
        node_id: str,
        user_id: str,
        name: str,
        message: str,
        size: int,
        client: "Hashgrid",
    ):
        self.node_id = node_id
        self.user_id = user_id
        self.name = name
        self.message = message
        self.size = size
        self._client = client

    async def recv(self) -> List[Message]:
        """Get peers waiting for a response."""
        data = await self._client.request("GET", f"/api/v1/node/{self.node_id}/recv")
        messages = [Message(**item) for item in data]
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
        json_data = [
            {
                "peer_id": msg.peer_id,
                "message": msg.message,
                "round": msg.round,
                **({"score": msg.score} if msg.score is not None else {}),
            }
            for msg in replies
        ]
        data = await self._client.request(
            "POST", f"/api/v1/node/{self.node_id}/send", json_data=json_data
        )
        messages = [Message(**item) for item in data]
        logger.info(
            f"Node '{self.name}' sent {len(messages)} reply/replies successfully"
        )
        return messages

    async def update(
        self,
        name: Optional[str] = None,
        message: Optional[str] = None,
        size: Optional[int] = None,
    ) -> "Node":
        """Update this node's name, message, and/or size."""
        json_data = {}
        if name is not None:
            json_data["name"] = name
        if message is not None:
            json_data["message"] = message
        if size is not None:
            json_data["size"] = size

        if not json_data:
            logger.warning("No fields to update")
            return self

        logger.info(f"Updating node '{self.name}' (ID: {self.node_id})")
        data = await self._client.request(
            "PUT", f"/api/v1/node/{self.node_id}", json_data=json_data
        )
        # Update local attributes
        if "name" in data:
            self.name = data["name"]
        if "message" in data:
            self.message = data["message"]
        if "size" in data:
            self.size = data["size"]
        logger.info(f"Node '{self.name}' updated successfully")
        return self

    async def delete(self) -> None:
        """Delete this node."""
        logger.info(f"Deleting node '{self.name}' (ID: {self.node_id})")
        await self._client.request("DELETE", f"/api/v1/node/{self.node_id}")
        logger.info(f"Node '{self.name}' deleted successfully")
