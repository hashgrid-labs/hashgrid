"""Grid resource for Hashgrid API."""

from ..models import Grid
from .base import BaseResource


class GridsResource(BaseResource):
    """Resource for grid operations."""

    async def get(self) -> Grid:
        """
        Get grid details. Requires membership.

        Returns:
            Grid model
        """
        data = await self._get("/api/v1")
        return Grid(**data)
