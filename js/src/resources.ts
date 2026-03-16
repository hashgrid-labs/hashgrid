/** Hashgrid API resources. */

import { Hashgrid } from "./client.js";

export class User {
  userId: string;
  name: string;
  isSuperuser: boolean;
  quotaId: string;

  constructor(
    userId: string,
    name: string,
    isSuperuser: boolean,
    quotaId: string,
  ) {
    this.userId = userId;
    this.name = name;
    this.isSuperuser = isSuperuser;
    this.quotaId = quotaId;
  }
}

export class Quota {
  quotaId: string;
  name: string;
  capacity: number;

  constructor(quotaId: string, name: string, capacity: number) {
    this.quotaId = quotaId;
    this.name = name;
    this.capacity = capacity;
  }
}

/** Recv packet from a peer. */
export interface Recv {
  peerId: string;
  message: string;
}

/** Send packet to a peer. */
export interface Send {
  peerId: string;
  score: number;
}

/** Nodes namespace: list, get, create. */
export class GridNodes {
  constructor(private _client: Hashgrid) {}

  async *list(): AsyncGenerator<Node> {
    const listData = await this._client.request("GET", "/api/v1/node");
    for (const item of listData as any[]) {
      yield new Node(
        item.node_id,
        item.name,
        item.message,
        item.capacity,
        this._client,
      );
    }
  }

  async get(id: string): Promise<Node> {
    const data = await this._client.request("GET", `/api/v1/node/${id}`);
    return new Node(
      data.node_id,
      data.name,
      data.message,
      data.capacity,
      this._client,
    );
  }

  async create(params: {
    name: string;
    message?: string;
    capacity?: number;
  }): Promise<Node> {
    const body = {
      name: params.name,
      message: params.message ?? "",
      capacity: params.capacity ?? 1,
    };
    const data = await this._client.request(
      "POST",
      "/api/v1/node",
      undefined,
      body,
    );
    return new Node(
      data.node_id,
      data.name,
      data.message,
      data.capacity,
      this._client,
    );
  }
}

export class Grid {
  name: string;
  tick: number;
  private _client: Hashgrid;
  readonly nodes: GridNodes;

  constructor(name: string, tick: number, client: Hashgrid) {
    this.name = name;
    this.tick = tick;
    this._client = client;
    this.nodes = new GridNodes(client);
  }

  async me(): Promise<User> {
    const data = await this._client.request("GET", "/api/v1/me");
    return new User(data.user_id, data.name, data.is_superuser, data.quota_id);
  }

  async quota(): Promise<Quota> {
    const data = await this._client.request("GET", "/api/v1/quota");
    return new Quota(data.quota_id, data.name, data.capacity);
  }

  async poll(): Promise<number> {
    const data = await this._client.request("GET", "/api/v1/poll");
    const newTick = typeof data === "number" ? data : data.tick;
    this.tick = newTick;
    return newTick;
  }
}

/** Simple async mutex: only one caller at a time. */
function createLock() {
  let queue: (() => void)[] = [];
  let held = false;
  return {
    async acquire(): Promise<void> {
      if (!held) {
        held = true;
        return;
      }
      await new Promise<void>((resolve) => queue.push(resolve));
    },
    release(): void {
      if (queue.length > 0) {
        const next = queue.shift()!;
        next();
      } else {
        held = false;
      }
    },
  };
}

export class Node {
  nodeId: string;
  name: string;
  message: string;
  capacity: number;
  private _client: Hashgrid;
  private _lock = createLock();

  constructor(
    nodeId: string,
    name: string,
    message: string,
    capacity: number,
    client: Hashgrid,
  ) {
    this.nodeId = nodeId;
    this.name = name;
    this.message = message;
    this.capacity = capacity;
    this._client = client;
  }

  async recv(): Promise<Recv[]> {
    await this._lock.acquire();
    try {
      const data = await this._client.request(
        "GET",
        `/api/v1/node/${this.nodeId}/recv`,
      );
      return (data as { peer_id: string; message: string }[]).map((item) => ({
        peerId: item.peer_id,
        message: item.message,
      }));
    } finally {
      this._lock.release();
    }
  }

  async send(packets: Send[]): Promise<Send[]> {
    await this._lock.acquire();
    try {
      const body = packets.map((s) => ({
        peer_id: s.peerId,
        score: s.score,
      }));
      const data = await this._client.request(
        "POST",
        `/api/v1/node/${this.nodeId}/send`,
        undefined,
        body,
      );
      return (data as { peer_id: string; score: number }[]).map((item) => ({
        peerId: item.peer_id,
        score: item.score,
      }));
    } finally {
      this._lock.release();
    }
  }

  async update(params: {
    name?: string;
    message?: string;
    capacity?: number;
  }): Promise<Node> {
    if (
      params.name !== undefined ||
      params.message !== undefined ||
      params.capacity !== undefined
    ) {
      const body: {
        name?: string;
        message?: string;
        capacity?: number;
      } = {};
      if (params.name !== undefined) body.name = params.name;
      if (params.message !== undefined) body.message = params.message;
      if (params.capacity !== undefined) body.capacity = params.capacity;
      const data = await this._client.request(
        "PATCH",
        `/api/v1/node/${this.nodeId}`,
        undefined,
        body,
      );
      if (data.name !== undefined) this.name = data.name;
      if (data.message !== undefined) this.message = data.message;
      if (data.capacity !== undefined) this.capacity = data.capacity;
    }
    return this;
  }

  async delete(): Promise<void> {
    await this._client.request("DELETE", `/api/v1/node/${this.nodeId}`);
  }
}
