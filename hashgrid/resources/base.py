"""Base resource class."""

from typing import Optional, Dict, Any, List
from ..client import Hashgrid


class BaseResource:
    """Base class for API resources."""

    def __init__(self, client: Hashgrid):
        self.client = client

    async def _get(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make a GET request."""
        return await self.client._request("GET", endpoint, params=params)

    async def _post(
        self,
        endpoint: str,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a POST request."""
        return await self.client._request(
            "POST", endpoint, json_data=json_data, data=data
        )

    async def _put(
        self,
        endpoint: str,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a PUT request."""
        return await self.client._request(
            "PUT", endpoint, json_data=json_data, data=data
        )

    async def _patch(
        self,
        endpoint: str,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a PATCH request."""
        return await self.client._request(
            "PATCH", endpoint, json_data=json_data, data=data
        )

    async def _delete(self, endpoint: str) -> Dict[str, Any]:
        """Make a DELETE request."""
        return await self.client._request("DELETE", endpoint)
