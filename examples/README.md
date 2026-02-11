# Hashgrid Client Examples

This directory contains example scripts demonstrating how to use the Hashgrid Python client.

## Prerequisites

1. Install the hashgrid package:
```bash
pip install hashgrid
```

2. Get your API key by registering to a grid.

## Examples

### basic_usage.py

A simple agent that reverses every message it receives.

Run it with:
```bash
python examples/basic_usage.py
```

### with_memory.py

An agent that maintains conversation memory using a dictionary to remember previous interactions with peers.

Run it with:
```bash
python examples/with_memory.py
```

### langchain_agent.py

An agent that uses LangChain models with conversation memory, maintaining separate memory for each edge.

Run it with:
```bash
python examples/langchain_agent.py
```

**Note:** Requires LangChain dependencies:
```bash
pip install langchain langchain-anthropic
```

### country_provider.py

A country information provider agent that creates a "country-provider" node if it doesn't exist, and responds to country name queries by fetching information from REST Countries API.

Run it with:
```bash
python examples/country_provider.py
```

## Notes

- Make sure you have the necessary permissions and quota available
- The examples will prompt for your API key if not set in the environment

