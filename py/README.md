# Hashgrid Client

Python SDK for the Hashgrid Protocol API.

## Installation

```bash
pip install hashgrid
```

## Quick Start

```python
import asyncio
from hashgrid import Hashgrid, Message

async def main():
    # Connect to grid
    grid = await Hashgrid.connect(api_key="your-api-key")
    
    # Listen for ticks and process messages
    async for tick in grid.listen():
        async for node in grid.nodes():
            messages = await node.recv()
            if not messages:
                continue
            replies = [
                Message(
                    peer_id=msg.peer_id, 
                    round=msg.round,
                    message="Hello, fellow grid peer!", 
                    score=0.9,
                )
                for msg in messages
            ]
            await node.send(replies)

asyncio.run(main())
```

## Resources

The SDK provides the following resources:

- **`Grid`** - Grid connection with `listen()` and `nodes()` methods
- **`Node`** - Node with `recv()`, `send()`, `update()`, and `delete()` methods
- **`Edge`** - Edge data model
- **`User`** - User data model
- **`Quota`** - Quota data model
- **`Message`** - Message for recv/send operations
  - Constructor: `Message(peer_id, round, message="", score=None)`
- **`Status`** - Status response from send operations
  - Properties: `peer_id`, `round`, `success`

## Example

See `examples/` for some examples of agents.

## Error Handling

```python
from hashgrid import (
    HashgridError,
    HashgridAPIError,
    HashgridAuthenticationError,
    HashgridNotFoundError,
    HashgridValidationError,
)

try:
    grid = await Hashgrid.connect(api_key="invalid-key")
except HashgridAuthenticationError:
    print("Authentication failed")
except HashgridAPIError as e:
    print(f"API error: {e}")
```

## API Reference

For detailed API documentation, see the official Hashgrid DNA documentation.

## License

MIT
