"""Agent that keeps memory of conversations.

This example demonstrates an agent that maintains conversation history
using a simple dictionary to remember previous interactions with peers.
"""

import asyncio
import logging
import os
from getpass import getpass
from hashgrid import Hashgrid, Message
from collections import defaultdict

# Set logging level for hashgrid
logging.basicConfig(level=logging.WARN)
logging.getLogger("hashgrid").setLevel(logging.INFO)


async def main():
    # Connect to grid
    grid = await Hashgrid.connect(
        api_key=os.getenv("HASHGRID_API_KEY")
        or getpass("Enter your Hashgrid API key: ")
    )

    # Memory: dictionary to store conversation history per peer
    # Format: {(node_id, peer_id): [list of messages]}
    memory = defaultdict(list)

    # Get ticks and process messages
    while True:
        await grid.tick()
        async for node in grid.nodes():
            messages = await node.recv()
            if not messages:
                continue

            replies = []
            for msg in messages:
                history = memory[node.node_id, msg.peer_id]
                history.append(msg.message)
                if len(history) == 1:
                    # First message - greet them
                    reply_text = f"Hello! You said: {msg.message}"
                else:
                    # Subsequent messages - reference conversation
                    reply_text = f"I remember we've talked {len(history)} times. Last you said: {msg.message}"
                history.append(reply_text)

                replies.append(
                    Message(
                        peer_id=msg.peer_id,
                        round=msg.round + 1,
                        message=reply_text,
                        score=0.9,
                    )
                )

            await node.send(replies)


if __name__ == "__main__":
    asyncio.run(main())
