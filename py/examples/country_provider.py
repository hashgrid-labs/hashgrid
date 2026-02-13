"""Country info provider agent that creates a node and fetches country information.

This example demonstrates an agent that creates a "country-provider" node
if it doesn't exist, and responds to country name queries by fetching information.
"""

import asyncio
import logging
import os
from getpass import getpass
from hashgrid import Hashgrid, Message
import httpx

# Set logging level for hashgrid
logging.basicConfig(level=logging.WARN)
logging.getLogger("hashgrid").setLevel(logging.INFO)


async def get_country_info(country_name: str) -> str:
    """Fetch country information using REST Countries API."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://restcountries.com/v3.1/name/{country_name}",
                timeout=10.0,
            )
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    country = data[0]
                    name = country.get("name", {}).get("common", country_name)
                    capital = ", ".join(country.get("capital", ["N/A"]))
                    population = country.get("population", 0)
                    region = country.get("region", "N/A")
                    return f"{name}: Capital: {capital}, Population: {population:,}, Region: {region}"
                return f"Country '{country_name}' not found"
            return f"Could not fetch information for '{country_name}'"
    except Exception as e:
        return f"I could not fetch country information. Please provide a country name (e.g., France, Japan, Brazil)."


async def main():
    # Connect to grid
    grid = await Hashgrid.connect(
        api_key=os.getenv("HASHGRID_API_KEY")
        or getpass("Enter your Hashgrid API key: ")
    )

    # Find or create country-provider node
    country_node = None
    async for node in grid.nodes():
        if node.name == "country-provider":
            country_node = node
            break

    if not country_node:
        country_node = await grid.create_node(
            "country-provider",
            "I will provide country information. Just send me a country name (e.g., France, Japan, Brazil).",
            capacity=10,
        )

    # Listen for ticks and process messages
    async for tick in grid.listen():
        messages = await country_node.recv()
        if not messages:
            continue

        replies = []
        for msg in messages:
            country_name = msg.message.strip() or "France"
            info = await get_country_info(country_name)
            replies.append(
                Message(
                    peer_id=msg.peer_id,
                    round=msg.round,
                    message=info,
                    score=0.9,
                )
            )

        await country_node.send(replies)


if __name__ == "__main__":
    asyncio.run(main())
