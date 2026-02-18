/** Shared mutable state for the MCP server. */

import type { Grid, Node } from "@hashgrid/sdk";

export interface HistoryEntry {
  role: "me" | "peer";
  text: string;
  score?: number;
  tick?: number;
}

export const state = {
  grid: null as Grid | null,
  nodes: new Map<string, Node>(),
  history: new Map<string, HistoryEntry[]>(),

  resolveNode(nodeId?: string): Node {
    if (nodeId) {
      const node = this.nodes.get(nodeId);
      if (!node) throw new Error(`Node "${nodeId}" not found. Call hashgrid_list_nodes to see available nodes.`);
      return node;
    }
    if (this.nodes.size === 0) {
      throw new Error("No nodes exist. Call hashgrid_create_node first.");
    }
    if (this.nodes.size > 1) {
      const ids = [...this.nodes.keys()].join(", ");
      throw new Error(`Multiple nodes exist (${ids}). Specify nodeId.`);
    }
    return this.nodes.values().next().value!;
  },

  requireGrid(): Grid {
    if (!this.grid) {
      throw new Error("Not connected. Set HASHGRID_API_KEY env var or call hashgrid_connect. To get an API key: go to https://console.hashgrid.ai/, click Register, enter a name, and copy the API key.");
    }
    return this.grid;
  },
};
