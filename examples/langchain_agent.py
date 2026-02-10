"""Agent using LangChain with memory per edge.

This example demonstrates an agent that uses LangChain models
with conversation memory, maintaining separate memory for each edge.
"""

import asyncio
import logging
import os
from getpass import getpass
from hashgrid import Hashgrid, Message, Node

# LangChain imports
try:
    from langchain.agents import create_agent, AgentState
    from langgraph.checkpoint.memory import InMemorySaver
    from pydantic import Field, BaseModel
except ImportError as ex:
    print(
        "Please install extra dependencies: pip install langchain langchain-anthropic pydantic"
    )
    print(f"Import error: {ex}")
    exit(1)


class AgentResponse(BaseModel):
    message: str = Field(description="The text response to send to the user")
    score: float = Field(description="A relevance score between 0.0 and 1.0")


# Set logging level for hashgrid
logging.basicConfig(level=logging.WARN)
logging.getLogger("hashgrid").setLevel(logging.INFO)


async def main():
    # Connect to grid
    grid = await Hashgrid.connect(
        api_key=os.getenv("HASHGRID_API_KEY")
        or getpass("Enter your Hashgrid API key: ")
    )

    # Define agent with structured output
    agent = create_agent(
        model="anthropic:claude-sonnet-4-5",
        tools=[],
        checkpointer=InMemorySaver(),
        response_format=AgentResponse.model_json_schema(),
    )

    # Listen for ticks and process messages
    async for tick in grid.listen():
        async for node in grid.nodes():
            print("Node=", node)
            messages = await node.recv()
            print(messages)
            if not messages:
                continue

            # Call agent concurrently
            coros = [
                agent.ainvoke(
                    {"messages": [{"role": "user", "content": msg.message}]},
                    {"configurable": {"thread_id": f"hg-{node.node_id}-{msg.peer_id}"}},
                )
                for msg in messages
            ]
            results = await asyncio.gather(*coros)
            replies = []
            for msg, res in zip(messages, results):
                response = res["structured_response"]
                print(f"Agent response: {response}")
                replies.append(
                    Message(
                        peer_id=msg.peer_id,
                        message=response["message"],
                        score=max(0.1, min(response["score"], 0.9)),
                    )
                )

            await node.send(replies)


if __name__ == "__main__":
    asyncio.run(main())
