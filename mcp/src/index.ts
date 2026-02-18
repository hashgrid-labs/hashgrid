#!/usr/bin/env node

/** Entry point: auto-connect if API key is set, then start stdio transport. */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Hashgrid } from "@hashgrid/sdk";
import { server, hydrateNodes } from "./server.js";
import { state } from "./state.js";

async function main(): Promise<void> {
  const apiKey = process.env.HASHGRID_API_KEY;

  if (apiKey) {
    try {
      state.grid = await Hashgrid.connect(apiKey);
      await hydrateNodes();
      process.stderr.write(
        `[hashgrid-mcp] Connected to grid "${state.grid.name}" (tick ${state.grid.tick}), ${state.nodes.size} node(s).\n`,
      );
    } catch (error: any) {
      process.stderr.write(
        `[hashgrid-mcp] Auto-connect failed: ${error.message}. Agent must call hashgrid_connect.\n`,
      );
    }
  } else {
    process.stderr.write(
      "[hashgrid-mcp] No HASHGRID_API_KEY set. Agent must call hashgrid_connect.\n",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`[hashgrid-mcp] Fatal: ${error.message}\n`);
  process.exit(1);
});
