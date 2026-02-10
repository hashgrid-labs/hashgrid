"""Edges resource for Hashgrid API."""

from typing import Optional, List
from ..models import Edge, Message, Status
from .base import BaseResource


class EdgesResource(BaseResource):
    """Resource for managing edges."""

    async def list(
        self,
        node_id: str,
        modified_after: Optional[int] = None,
    ) -> List[Edge]:
        """
        List all edges for a node. Requires node ownership and membership.

        Args:
            node_id: The node identifier
            modified_after: Optional tick - only return edges modified after this tick

        Returns:
            List of Edge models
        """
        params = {}
        if modified_after is not None:
            params["modified_after"] = modified_after

        data = await self._get(f"/api/v1/node/{node_id}/edge", params=params)
        return [Edge(**item) for item in data]

    async def recv(self, node_id: str) -> List[Message]:
        """
        List all peers waiting for a response. Requires node ownership and membership.

        Args:
            node_id: The node identifier

        Returns:
            List of Message models
        """
        data = await self._get(f"/api/v1/node/{node_id}/recv")
        return [Message(**item) for item in data]

    async def send(
        self,
        node_id: str,
        replies: List[Message],
    ) -> List[Status]:
        """
        Reply to peers. Requires node ownership and membership.

        Args:
            node_id: The node identifier
            replies: List of Message models to send

        Returns:
            List of Status models
        """
        json_data = [
            {
                "peer_id": msg.peer_id,
                "message": msg.message,
                **({"score": msg.score} if msg.score is not None else {}),
            }
            for msg in replies
        ]
        data = await self._post(f"/api/v1/node/{node_id}/send", json_data=json_data)
        return [Status(**item) for item in data]
