"""Main Hashgrid client class."""

import json
import logging
from typing import Optional, Dict, Any
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

from .exceptions import (
    HashgridAPIError,
    HashgridAuthenticationError,
    HashgridNotFoundError,
    HashgridValidationError,
)
from .resources import Grid


class Hashgrid:
    """Main client for HTTP requests."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://dna.hashgrid.ai",
        timeout: int = 30,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(timeout=self.timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an HTTP request to the API."""
        if not self._client:
            raise HashgridAPIError(
                "Client not initialized. Use async context manager or await connect()"
            )

        url = urljoin(self.base_url, endpoint.lstrip("/"))
        headers = self._get_headers()

        try:
            response = await self._client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_data,
            )
            return await self._handle_response(response)
        except httpx.RequestError as e:
            raise HashgridAPIError(f"Request failed: {str(e)}")

    async def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Handle API response and raise appropriate exceptions."""
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError:
            if response.status_code == 401:
                raise HashgridAuthenticationError(
                    "Authentication failed. Check your API key.",
                    status_code=response.status_code,
                    response=response,
                )
            elif response.status_code == 404:
                raise HashgridNotFoundError(
                    "Resource not found",
                    status_code=response.status_code,
                    response=response,
                )
            elif response.status_code == 422:
                error_data = response.json() if response.content else {}
                raise HashgridValidationError(
                    error_data.get("message", "Validation error"),
                    status_code=response.status_code,
                    response=response,
                )
            else:
                error_data = response.json() if response.content else {}
                raise HashgridAPIError(
                    error_data.get("message", f"API error: {response.status_code}"),
                    status_code=response.status_code,
                    response=response,
                )

        if not response.content:
            return {}

        try:
            return response.json()
        except json.JSONDecodeError:
            return {"content": response.text}

    @classmethod
    async def connect(
        cls,
        api_key: Optional[str] = None,
        base_url: str = "https://hgp.hashgrid.ai",
        timeout: int = 30,
    ) -> Grid:
        """Connect to a Hashgrid grid and return a Grid."""
        logger.info(f"Connecting to grid at {base_url}")
        client = cls(api_key=api_key, base_url=base_url, timeout=timeout)
        await client.__aenter__()
        data = await client._request("GET", "/api/v1")
        grid = Grid(name=data["name"], tick=data["tick"], client=client)
        logger.info(f"Connected to grid '{grid.name}' at tick {grid.tick}")
        return grid
