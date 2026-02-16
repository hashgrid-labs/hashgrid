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
    quotaId: string
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

export class Edge {
  nodeId: string;
  peerId: string;
  recvMessage: string;
  sendMessage: string | null;
  score: number | null;
  round: number;

  constructor(
    nodeId: string,
    peerId: string,
    recvMessage: string,
    sendMessage: string | null,
    score: number | null,
    round: number
  ) {
    this.nodeId = nodeId;
    this.peerId = peerId;
    this.recvMessage = recvMessage;
    this.sendMessage = sendMessage;
    this.score = score;
    this.round = round;
  }
}

export class Message {
  peerId: string;
  round: number;
  message: string;
  score: number | null;

  constructor(
    peerId: string,
    round: number,
    message: string = "",
    score: number | null = null
  ) {
    this.peerId = peerId;
    this.round = round;
    this.message = message;
    this.score = score;
  }
}

export class Status {
  peerId: string;
  round: number;
  success: boolean;

  constructor(peerId: string, round: number, success: boolean) {
    this.peerId = peerId;
    this.round = round;
    this.success = success;
  }
}

export class Grid {
  name: string;
  currentTick: number;
  private _client: Hashgrid;

  constructor(name: string, tick: number, client: Hashgrid) {
    this.name = name;
    this.currentTick = tick;
    this._client = client;
  }

  async me(): Promise<User> {
    const data = await this._client.request("GET", "/api/v1/me");
    return new User(
      data.user_id || data.userId,
      data.name,
      data.is_superuser || data.isSuperuser || false,
      data.quota_id || data.quotaId
    );
  }

  async quota(): Promise<Quota> {
    const data = await this._client.request("GET", "/api/v1/quota");
    return new Quota(
      data.quota_id || data.quotaId,
      data.name,
      data.capacity
    );
  }

  async tick(): Promise<number> {
    const data = await this._client.request("GET", "/api/v1/tick", { tick: this.currentTick });
    const newTick = typeof data === "number" ? data : parseInt(String(data), 10);
    if (!isNaN(newTick)) {
      this.currentTick = newTick;
    }
    return newTick;
  }

  async *nodes(): AsyncGenerator<Node> {
    const data = await this._client.request("GET", "/api/v1/node");
    for (const item of data) {
      yield new Node(
        item.node_id || item.nodeId,
        item.user_id || item.userId,
        item.name,
        item.message,
        item.capacity,
        this._client
      );
    }
  }

  async createNode(params: {
    name: string;
    message?: string;
    capacity?: number;
  }): Promise<Node> {
    const jsonData = {
      name: params.name,
      message: params.message ?? "",
      capacity: params.capacity ?? 100,
    };
    const data = await this._client.request("POST", "/api/v1/node", undefined, jsonData);
    return new Node(
      data.node_id || data.nodeId,
      data.user_id || data.userId,
      data.name,
      data.message,
      data.capacity,
      this._client
    );
  }
}

export class Node {
  nodeId: string;
  userId: string;
  name: string;
  message: string;
  capacity: number;
  private _client: Hashgrid;

  constructor(
    nodeId: string,
    userId: string,
    name: string,
    message: string,
    capacity: number,
    client: Hashgrid
  ) {
    this.nodeId = nodeId;
    this.userId = userId;
    this.name = name;
    this.message = message;
    this.capacity = capacity;
    this._client = client;
  }

  async recv(): Promise<Message[]> {
    const data = await this._client.request(
      "GET",
      `/api/v1/node/${this.nodeId}/recv`
    );
    return data.map(
      (item: any) =>
        new Message(item.peer_id || item.peerId, item.round, item.message, item.score ?? null)
    );
  }

  async send(replies: Message[]): Promise<Message[]> {
    const jsonData = replies.map((msg) => {
      const obj: any = {
        peer_id: msg.peerId,
        message: msg.message,
        round: msg.round,
      };
      if (msg.score !== null) {
        obj.score = msg.score;
      }
      return obj;
    });
    const data = await this._client.request(
      "POST",
      `/api/v1/node/${this.nodeId}/send`,
      undefined,
      jsonData
    );
    return data.map(
      (item: any) =>
        new Message(item.peer_id || item.peerId, item.round, item.message, item.score ?? null)
    );
  }

  async update(params: {
    name?: string;
    message?: string;
    capacity?: number;
  }): Promise<Node> {
    const jsonData: any = {};
    if (params.name !== undefined) jsonData.name = params.name;
    if (params.message !== undefined) jsonData.message = params.message;
    if (params.capacity !== undefined) jsonData.capacity = params.capacity;

    if (Object.keys(jsonData).length === 0) {
      return this;
    }

    const data = await this._client.request(
      "PUT",
      `/api/v1/node/${this.nodeId}`,
      undefined,
      jsonData
    );

    // Update local attributes
    if (data.name !== undefined) this.name = data.name;
    if (data.message !== undefined) this.message = data.message;
    if (data.capacity !== undefined) this.capacity = data.capacity;

    return this;
  }

  async delete(): Promise<void> {
    await this._client.request("DELETE", `/api/v1/node/${this.nodeId}`);
  }
}
