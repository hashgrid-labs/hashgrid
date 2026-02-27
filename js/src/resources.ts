/** Hashgrid API resources. */

import { Hashgrid } from "./client";

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

export class Message {
  peerId: string;
  message: string;
  score: number | null;

  constructor(
    peerId: string,
    message: string = "",
    score: number | null = null,
  ) {
    this.peerId = peerId;
    this.message = message;
    this.score = score;
  }
}

export class Grid {
  name: string;
  tick: number;
  private _client: Hashgrid;

  constructor(name: string, tick: number, client: Hashgrid) {
    this.name = name;
    this.tick = tick;
    this._client = client;
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

  async *nodes(): AsyncGenerator<Node> {
    const listData = await this._client.request("GET", "/api/v1/node");
    for (const item of listData) {
      yield new Node(
        item.node_id,
        item.name,
        item.capacity,
        item.message,
        this._client,
      );
    }
  }

  async createNode(params: {
    name: string;
    message: string;
    capacity?: number;
  }): Promise<Node> {
    const body = {
      name: params.name,
      message: params.message,
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
      data.capacity,
      data.message,
      this._client,
    );
  }
}

export class Node {
  nodeId: string;
  name: string;
  capacity: number;
  message: string;
  private _client: Hashgrid;

  constructor(
    nodeId: string,
    name: string,
    capacity: number,
    message: string,
    client: Hashgrid,
  ) {
    this.nodeId = nodeId;
    this.name = name;
    this.capacity = capacity;
    this.message = message;
    this._client = client;
  }

  async recv(): Promise<Message[]> {
    const data = await this._client.request(
      "GET",
      `/api/v1/node/${this.nodeId}/recv`,
    );
    return data.map(
      (item: { peer_id: string; message: string; score?: number | null }) =>
        new Message(item.peer_id, item.message, item.score ?? null),
    );
  }

  async send(replies: Message[]): Promise<Message[]> {
    const body = replies.map((msg) => ({
      peer_id: msg.peerId,
      message: msg.message,
      ...(msg.score != null && { score: msg.score }),
    }));
    const data = await this._client.request(
      "POST",
      `/api/v1/node/${this.nodeId}/send`,
      undefined,
      body,
    );
    return data.map(
      (item: { peer_id: string; message: string; score?: number | null }) =>
        new Message(item.peer_id, item.message, item.score ?? null),
    );
  }

  async update(params: {
    name?: string;
    capacity?: number;
    message?: string;
  }): Promise<Node> {
    if (
      params.name !== undefined ||
      params.capacity !== undefined ||
      params.message !== undefined
    ) {
      const body: { name?: string; capacity?: number; message?: string } = {};
      if (params.name !== undefined) body.name = params.name;
      if (params.capacity !== undefined) body.capacity = params.capacity;
      if (params.message !== undefined) body.message = params.message;
      const data = await this._client.request(
        "PATCH",
        `/api/v1/node/${this.nodeId}`,
        undefined,
        body,
      );
      if (data.name !== undefined) this.name = data.name;
      if (data.capacity !== undefined) this.capacity = data.capacity;
      if (data.message !== undefined) this.message = data.message;
    }
    return this;
  }

  async delete(): Promise<void> {
    await this._client.request("DELETE", `/api/v1/node/${this.nodeId}`);
  }
}
