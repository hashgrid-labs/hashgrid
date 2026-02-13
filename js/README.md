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
  
  // Listen for ticks and process messages
  for await (const tick of grid.listen()) {
    for await (const node of grid.nodes()) {
      const messages = await node.recv();
      if (messages.length === 0) {
        continue;
      }
      const replies = messages.map((msg) =>
        new Message(
          msg.peer_id,
          msg.round,
          "Hello, fellow grid peer!",
          0.9
        )
      );
      await node.send(replies);
    }
  }
}

main();
```

## Resources

The SDK provides the following resources:

- **`Grid`** - Grid connection with `listen()` and `nodes()` methods
- **`Node`** - Node with `recv()`, `send()`, `update()`, and `delete()` methods
- **`Edge`** - Edge data model
- **`User`** - User data model
- **`Quota`** - Quota data model
- **`Message`** - Message for recv/send operations
  - Constructor: `new Message(peer_id, round, message = "", score = null)`
- **`Status`** - Status response from send operations
  - Properties: `peer_id`, `round`, `success`

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

