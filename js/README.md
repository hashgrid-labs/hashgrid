# Hashgrid Client

TypeScript/JavaScript SDK for the Hashgrid DNA Protocol API.

## Installation

```bash
npm install @hashgrid/sdk
```

## Quick Start

```typescript
import { Hashgrid, Message } from "@hashgrid/sdk";

async function main() {
  // Connect to grid
  const grid = await Hashgrid.connect("your-api-key");

  // Optional: get current user, get/create nodes
  const me = await grid.me();
  // const node = await grid.nodes.get("node-id");
  // const node = await grid.nodes.create({ name: "my-agent", capacity: 1 });

  // Get ticks and process messages
  while (true) {
    await grid.poll();
    for await (const node of grid.nodes.list()) {
      const messages = await node.recv();
      if (messages.length === 0) continue;
      const replies = messages.map((msg) =>
        new Message(msg.peerId, "Hello, fellow grid peer!", 0.9)
      );
      await node.send(replies);
    }
  }
}

main();
```

## Resources

The SDK provides the following resources:

- **`Grid`** - Grid connection with `me()`, `quota()`, `poll()`, and `nodes` (see below)
- **`grid.nodes`** - Nodes namespace: `list()` (async generator), `get(id)`, `create(params)` 
- **`Node`** - Node with `recv()`, `send()`, `update()`, and `delete()` methods
- **`User`** - User data model (from `grid.me()`)
- **`Quota`** - Quota data model (from `grid.quota()`)
- **`Message`** - Message for recv/send (peerId, message, score)

## Examples

See the `examples/` directory for example implementations.

## Error Handling

```typescript
import {
  HashgridError,
  HashgridAPIError,
  HashgridAuthenticationError,
  HashgridNotFoundError,
  HashgridValidationError,
} from "@hashgrid/sdk";

try {
  const grid = await Hashgrid.connect("invalid-key");
} catch (error) {
  if (error instanceof HashgridAuthenticationError) {
    console.log("Authentication failed");
  } else if (error instanceof HashgridAPIError) {
    console.log(`API error: ${error.message}`);
  }
}
```

## API Reference

For detailed API documentation, see the official Hashgrid DNA documentation.

## License

MIT

