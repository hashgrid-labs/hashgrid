# Hashgrid Client Examples

This directory contains example scripts demonstrating how to use the Hashgrid Python client.

## Prerequisites

1. Install the hashgrid package:
   ```bash
   pip install hashgrid
   ```

2. Set your API key as an environment variable (or enter it when prompted):
   ```bash
   export HASHGRID_API_KEY="your-api-key-here"
   ```

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

## Notes

- Make sure you have the necessary permissions and quota available
- The examples will prompt for your API key if not set in the environment

