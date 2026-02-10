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
    capacity: int


@dataclass
class Edge:
    """Edge resource."""

    node_id: str
    peer_id: str
    recv_message: str
    send_message: Optional[str]
    score: Optional[float]
    modified_tick: int
    created_tick: int


@dataclass
class Message:
    """Message resource."""

    peer_id: str
    message: str
    score: Optional[float]


@dataclass
class Status:
    """Status resource."""

    peer_id: str
    success: bool


class Grid:
    """Grid resource with methods."""

    def __init__(self, name: str, tick: int, client: "Hashgrid"):
        self.name = name
        self.tick = tick
        self._client = client

    async def listen(self, poll_interval: float = 30.0) -> AsyncIterator[int]:
        """Listen for tick updates. Yields when the tick changes."""
        logger.info(f"Starting to listen for ticks on grid '{self.name}'")
        last_tick = -1
        while True:
            try:
                data = await self._client._request("GET", "/api/v1")
                self.name = data["name"]
                self.tick = data["tick"]
                current_tick = self.tick

                if current_tick != last_tick:
                    logger.info(f"Tick updated: {last_tick} -> {current_tick}")
                    yield current_tick
                    last_tick = current_tick

                await asyncio.sleep(poll_interval)
            except Exception as e:
                logger.warning(f"Error while listening for ticks: {e}")
                await asyncio.sleep(poll_interval * 2)

    async def nodes(self) -> AsyncIterator["Node"]:
        """Iterate over all nodes owned by the authenticated user."""
        data = await self._client._request("GET", "/api/v1/node")
        for item in data:
            node = Node(**item, client=self._client)
            yield node


class Node:
    """Node resource with recv/send methods."""

    def __init__(
        self,
        node_id: str,
        owner_id: str,
        name: str,
        message: str,
        capacity: int,
        client: "Hashgrid",
    ):
        self.node_id = node_id
        self.owner_id = owner_id
        self.name = name
        self.message = message
        self.capacity = capacity
        self._client = client

    async def recv(self) -> List[Message]:
        """Get peers waiting for a response."""
        data = await self._client._request("GET", f"/api/v1/node/{self.node_id}/recv")
        messages = [Message(**item) for item in data]
        if messages:
            logger.info(
                f"Node '{self.name}' received {len(messages)} message(s) from peers"
            )
        return messages

    async def send(self, replies: List[Message]) -> List[Status]:
        """Send replies to peers."""
        logger.info(
            f"Node '{self.name}' sending {len(replies)} reply/replies to peer(s)"
        )
        json_data = [
            {
                "peer_id": msg.peer_id,
                "message": msg.message,
                **({"score": msg.score} if msg.score is not None else {}),
            }
            for msg in replies
        ]
        data = await self._client._request(
            "POST", f"/api/v1/node/{self.node_id}/send", json_data=json_data
        )
        statuses = [Status(**item) for item in data]
        successful = sum(1 for s in statuses if s.success)
        logger.info(
            f"Node '{self.name}' sent {successful}/{len(statuses)} reply/replies successfully"
        )
        return statuses
