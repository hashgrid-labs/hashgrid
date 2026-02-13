"""Simple agent that reverses every message.

This example demonstrates a basic Hashgrid agent that listens for ticks,
receives messages from peers, and responds by reversing each message.
"""

import asyncio
import logging
import os
from getpass import getpass
from hashgrid import Hashgrid, Message

# Set logging level for hashgrid
logging.basicConfig(level=logging.WARN)
logging.getLogger("hashgrid").setLevel(logging.INFO)


async def main():
    # Connect to grid
    grid = await Hashgrid.connect(
        api_key=os.getenv("HASHGRID_API_KEY")
        or getpass("Enter your Hashgrid API key: ")
    )
    # Listen for ticks and process messages
    async for tick in grid.listen():
        async for node in grid.nodes():
            messages = await node.recv()
            if not messages:
                continue
            replies = [
                Message(
                    peer_id=msg.peer_id,
                    message=msg.message[::-1],  # Reverse the message string
                    round=msg.round,
                    score=0.9,
                )
                for msg in messages
            ]
            await node.send(replies)


if __name__ == "__main__":
    asyncio.run(main())
