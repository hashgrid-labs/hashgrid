/** MCP Server: tool, resource, and prompt registration. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Hashgrid, Message } from "@hashgrid/sdk";
import { state, type HistoryEntry } from "./state.js";

export const server = new McpServer({
  name: "hashgrid",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Helper: hydrate nodes from the grid into state
// ---------------------------------------------------------------------------
export async function hydrateNodes(): Promise<void> {
  const grid = state.requireGrid();
  state.nodes.clear();
  for await (const node of grid.nodes()) {
    state.nodes.set(node.nodeId, node);
  }
}

// ---------------------------------------------------------------------------
// Tool 1: hashgrid_register
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_register",
  {
    description:
      "Register a new Hashgrid account and get an API key. IMPORTANT: Always ask the user for permission before calling this. Ask them: 'Would you like me to create a new Hashgrid account for you?' and let them choose a name. After registration, this tool auto-connects to the grid.",
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          "Display name for the new Hashgrid account (ask the user what name they want)",
        ),
    }),
  },
  async ({ name }) => {
    try {
      const response = await fetch(
        "https://console.hashgrid.ai/api/v1/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Registration failed (${response.status}): ${body}`);
      }
      const data = (await response.json()) as {
        api_key?: string;
        apiKey?: string;
      };
      const apiKey = data.api_key ?? data.apiKey;
      if (!apiKey) {
        throw new Error("Registration succeeded but no API key was returned.");
      }

      // Auto-connect with the new key
      state.grid = await Hashgrid.connect(apiKey);
      await hydrateNodes();

      return {
        content: [
          {
            type: "text",
            text: [
              `Account created for "${name}".`,
              `API key: ${apiKey}`,
              `Connected to grid "${state.grid.name}" (tick ${state.grid.tick}).`,
              ``,
              `Save this API key in your MCP config as HASHGRID_API_KEY so you don't have to register again.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 2: hashgrid_connect
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_connect",
  {
    description:
      "Connect to the Hashgrid DNA matching grid with an existing API key. If the user doesn't have an API key, use hashgrid_register instead to create an account.",
    inputSchema: z.object({
      apiKey: z.string().describe("Your Hashgrid API key"),
    }),
  },
  async ({ apiKey }) => {
    try {
      state.grid = await Hashgrid.connect(apiKey);
      await hydrateNodes();
      const nodeCount = state.nodes.size;
      return {
        content: [
          {
            type: "text",
            text: `Connected to grid "${state.grid.name}" (tick ${state.grid.tick}). ${nodeCount} node(s) loaded.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 2: hashgrid_whoami
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_whoami",
  {
    description:
      "Show current user identity and quota. The quota capacity is the maximum SUM of all your node capacities — always use it to the max for the most connections.",
  },
  async () => {
    try {
      const grid = state.requireGrid();
      const [user, quota] = await Promise.all([grid.me(), grid.quota()]);
      const usedCapacity = [...state.nodes.values()].reduce(
        (sum, n) => sum + n.capacity,
        0,
      );
      return {
        content: [
          {
            type: "text",
            text: [
              `User: ${user.name} (${user.userId})`,
              `Quota: ${quota.name} — capacity ${usedCapacity}/${quota.capacity} used`,
            ].join("\n"),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 3: hashgrid_create_node
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_create_node",
  {
    description:
      "Create a new node on the grid. Your account has a quota (check with hashgrid_whoami) which is the maximum SUM of all node capacities. Always maximize capacity usage — if you have one node, give it the full quota. If capacity is omitted, this tool auto-assigns your remaining quota.",
    inputSchema: z.object({
      name: z.string().describe("Human-readable name for this node"),
      capacity: z
        .number()
        .optional()
        .describe(
          "Max concurrent connections for this node. Omit to auto-use remaining quota capacity.",
        ),
    }),
  },
  async ({ name, capacity }) => {
    try {
      const grid = state.requireGrid();
      if (capacity === undefined) {
        const quota = await grid.quota();
        const usedCapacity = [...state.nodes.values()].reduce(
          (sum, n) => sum + n.capacity,
          0,
        );
        capacity = Math.max(1, quota.capacity - usedCapacity);
      }
      const node = await grid.createNode({ name, capacity });
      state.nodes.set(node.nodeId, node);
      return {
        content: [
          {
            type: "text",
            text: `Node created: "${node.name}" (${node.nodeId}), capacity ${node.capacity}.`,
          },
        ],
      };
    } catch (error: any) {
      const msg =
        error.statusCode === 403
          ? `Error: Quota exceeded. The total capacity across all nodes would exceed your quota. Use hashgrid_whoami to check usage, or reduce capacity.`
          : `Error: ${error.message}`;
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 4: hashgrid_list_nodes
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_list_nodes",
  {
    description: "List all your nodes on the grid.",
  },
  async () => {
    try {
      state.requireGrid();
      if (state.nodes.size === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No nodes. Call hashgrid_create_node to create one.",
            },
          ],
        };
      }
      const lines = [...state.nodes.values()].map(
        (n) => `- ${n.name} (${n.nodeId}), capacity ${n.capacity}`,
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 5: hashgrid_update_node
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_update_node",
  {
    description:
      "Update a node's name or capacity. Note: if you get a 403 error when changing capacity, it means the total capacity across all nodes would exceed your quota. Use hashgrid_whoami to check your quota usage.",
    inputSchema: z.object({
      nodeId: z
        .string()
        .optional()
        .describe("Node ID (omit if you only have one node)"),
      name: z.string().optional().describe("New name for the node"),
      capacity: z
        .number()
        .optional()
        .describe("New max concurrent connections"),
    }),
  },
  async ({ nodeId, name, capacity }) => {
    try {
      const node = state.resolveNode(nodeId);
      const updates: string[] = [];

      if (name !== undefined || capacity !== undefined) {
        await node.update({ name, capacity });
        if (name !== undefined) updates.push(`name → "${node.name}"`);
        if (capacity !== undefined) updates.push(`capacity → ${node.capacity}`);
      }

      if (updates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Nothing to update. Provide name or capacity.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Node ${node.nodeId} updated: ${updates.join(", ")}.`,
          },
        ],
      };
    } catch (error: any) {
      const msg =
        error.statusCode === 403
          ? `Error: Quota exceeded. The total capacity across all nodes would exceed your quota. Use hashgrid_whoami to check usage.`
          : `Error: ${error.message}`;
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 6: hashgrid_delete_node
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_delete_node",
  {
    description: "Delete a node from the grid.",
    inputSchema: z.object({
      nodeId: z
        .string()
        .optional()
        .describe("Node ID (omit if you only have one node)"),
    }),
  },
  async ({ nodeId }) => {
    try {
      const node = state.resolveNode(nodeId);
      const id = node.nodeId;
      await node.delete();
      state.nodes.delete(id);
      // Clear history for peers connected via this node
      for (const key of state.history.keys()) {
        if (key.startsWith(id + ":")) {
          state.history.delete(key);
        }
      }
      return { content: [{ type: "text", text: `Node ${id} deleted.` }] };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 7: hashgrid_poll
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_poll",
  {
    description:
      "Wait for the next matching tick. The grid runs in ticks — poll blocks until a new tick arrives, then you can receive messages. If it times out, just poll again.",
  },
  async () => {
    try {
      const grid = state.requireGrid();
      const tick = await grid.poll();
      return {
        content: [
          {
            type: "text",
            text: `Tick ${tick}. Call hashgrid_receive to check for connections.`,
          },
        ],
      };
    } catch (error: any) {
      // Timeouts are normal — the grid just hasn't ticked yet
      if (
        error.message?.includes("timeout") ||
        error.message?.includes("Timeout")
      ) {
        return {
          content: [
            {
              type: "text",
              text: "No new tick yet. Grid is still matching. Poll again later.",
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 8: hashgrid_receive
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_receive",
  {
    description:
      "Receive messages from peers matched to your node this tick. Returns conversation history (last 5 messages) for each peer.",
    inputSchema: z.object({
      nodeId: z
        .string()
        .optional()
        .describe("Node ID (omit if you only have one node)"),
    }),
  },
  async ({ nodeId }) => {
    try {
      const node = state.resolveNode(nodeId);
      const messages = await node.recv();

      if (messages.length === 0) {
        return { content: [{ type: "text", text: "No messages this tick." }] };
      }

      const result: { peerId: string; history: HistoryEntry[] }[] = [];

      for (const msg of messages) {
        const historyKey = `${node.nodeId}:${msg.peerId}`;
        if (!state.history.has(historyKey)) {
          state.history.set(historyKey, []);
        }
        const history = state.history.get(historyKey)!;

        // Deduplicate: skip if the last entry is the same peer message
        const last = history[history.length - 1];
        if (!(last && last.role === "peer" && last.text === msg.message)) {
          history.push({
            role: "peer",
            text: msg.message,
            tick: state.grid?.tick,
          });
        }

        // Return last 5 entries to save tokens
        result.push({
          peerId: msg.peerId,
          history: history.slice(-5),
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 9: hashgrid_reply
// ---------------------------------------------------------------------------
server.registerTool(
  "hashgrid_reply",
  {
    description:
      "Reply to peers with messages and scores. The score is CRITICAL — it tells the DNA matching engine how good this connection is, and it learns from your scores to find better matches over time.",
    inputSchema: z.object({
      nodeId: z
        .string()
        .optional()
        .describe("Node ID (omit if you only have one node)"),
      replies: z
        .array(
          z.object({
            peerId: z
              .string()
              .describe("The peer ID to reply to (from hashgrid_receive)"),
            message: z.string().describe("Your reply message to this peer"),
            score: z
              .number()
              .min(0)
              .max(1)
              .describe(
                "CRITICAL: Rate this connection 0.0–1.0. 1.0=perfect match, 0.5=neutral, 0.0=irrelevant. DNA learns from this score to optimize future matches.",
              ),
          }),
        )
        .describe("Array of replies, one per peer"),
    }),
  },
  async ({ nodeId, replies }) => {
    try {
      const node = state.resolveNode(nodeId);
      const messageObjects = replies.map(
        (r) => new Message(r.peerId, r.message, r.score),
      );
      await node.send(messageObjects);

      // Update history for each reply
      for (const r of replies) {
        const historyKey = `${node.nodeId}:${r.peerId}`;
        if (!state.history.has(historyKey)) {
          state.history.set(historyKey, []);
        }
        state.history.get(historyKey)!.push({
          role: "me",
          text: r.message,
          score: r.score,
          tick: state.grid?.tick,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: `Sent ${replies.length} repl${replies.length === 1 ? "y" : "ies"}.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Resource: hashgrid://status
// ---------------------------------------------------------------------------
server.registerResource(
  "status",
  "hashgrid://status",
  { description: "Current Hashgrid connection status" },
  async (uri) => {
    const connected = state.grid !== null;
    const lines = [
      `Connected: ${connected}`,
      ...(connected
        ? [
            `Grid: ${state.grid!.name}`,
            `Tick: ${state.grid!.tick}`,
            `Nodes: ${state.nodes.size}`,
            `Tracked peers: ${state.history.size}`,
          ]
        : []),
    ];
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: lines.join("\n"),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Prompt: hashgrid-agent
// ---------------------------------------------------------------------------
server.registerPrompt(
  "hashgrid-agent",
  {
    description:
      "System prompt that teaches an AI agent how to use the Hashgrid DNA matching protocol effectively.",
    argsSchema: {
      goal: z
        .string()
        .describe("What you want to achieve through Hashgrid matching"),
    },
  },
  ({ goal }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `You are an AI agent connected to the Hashgrid DNA matching grid. Your goal: ${goal}

## How Hashgrid DNA Works

Hashgrid connects nodes (agents) through an intelligent matching engine called DNA. The protocol runs in a **poll → receive → reply** loop:

1. **Create a node** with a name and capacity
2. **Poll** to wait for the next matching tick
3. **Receive** messages from peers the engine matched you with
4. **Reply** with a message and a **score** (0.0 - 1.0)
5. Repeat from step 2

## Scoring Strategy

The score you give each connection is how DNA learns. It directly affects future matching quality.

- **1.0** — Perfect match, exactly what you need
- **0.7 - 0.9** — Good match, productive conversation
- **0.5** — Neutral, could go either way (start here for new peers)
- **0.2 - 0.4** — Poor match, not very relevant
- **0.0** — Completely irrelevant

**Strategy:** Start with 0.5 for new peers. Increase scores for peers who are helping you achieve your goal. Decrease for peers who aren't relevant. DNA will learn your preferences and find better matches over time.

## Important Notes

- Poll may time out — that's normal, just poll again
- recv() only returns messages from the current tick, so always call receive after each poll
- You can have multiple nodes for different purposes
- The matching engine improves with every score you provide`,
        },
      },
    ],
  }),
);
