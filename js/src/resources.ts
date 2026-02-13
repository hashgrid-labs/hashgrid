/** Hashgrid API resources. */

import { Hashgrid } from "./client";

export class User {
  user_id: string;
  name: string;
  is_superuser: boolean;
  quota_id: string;

  constructor(
    user_id: string,
    name: string,
    is_superuser: boolean,
    quota_id: string
  ) {
    this.user_id = user_id;
    this.name = name;
    this.is_superuser = is_superuser;
    this.quota_id = quota_id;
  }
}

export class Quota {
  quota_id: string;
  name: string;
  capacity: number;

  constructor(quota_id: string, name: string, capacity: number) {
    this.quota_id = quota_id;
    this.name = name;
    this.capacity = capacity;
  }
}

export class Edge {
  node_id: string;
  peer_id: string;
  recv_message: string;
  send_message: string | null;
  score: number | null;
  round: number;

  constructor(
    node_id: string,
    peer_id: string,
    recv_message: string,
    send_message: string | null,
    score: number | null,
    round: number
  ) {
    this.node_id = node_id;
    this.peer_id = peer_id;
    this.recv_message = recv_message;
    this.send_message = send_message;
    this.score = score;
    this.round = round;
  }
}

export class Message {
  peer_id: string;
  round: number;
  message: string;
  score: number | null;

  constructor(
    peer_id: string,
    round: number,
    message: string = "",
    score: number | null = null
  ) {
    this.peer_id = peer_id;
    this.round = round;
    this.message = message;
    this.score = score;
  }
}

export class Status {
  peer_id: string;
  round: number;
  success: boolean;

  constructor(peer_id: string, round: number, success: boolean) {
    this.peer_id = peer_id;
    this.round = round;
    this.success = success;
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

  async *listen(poll_interval: number = 30000): AsyncGenerator<number> {
    let last_tick = -1;
    while (true) {
      try {
        const data = await this._client._request("GET", "/api/v1");
        this.name = data.name;
        this.tick = data.tick;
        const current_tick = this.tick;

        if (current_tick !== last_tick) {
          yield current_tick;
          last_tick = current_tick;
        }

        await new Promise((resolve) => setTimeout(resolve, poll_interval));
      } catch (error) {
        console.warn(`Error while listening for ticks: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, poll_interval * 2));
      }
    }
  }

  async *nodes(): AsyncGenerator<Node> {
    const data = await this._client._request("GET", "/api/v1/node");
    for (const item of data) {
      yield new Node(
        item.node_id,
        item.owner_id,
        item.name,
        item.message,
        item.capacity,
        this._client
      );
    }
  }

  async create_node(
    name: string,
    message: string = "",
    capacity: number = 100
  ): Promise<Node> {
    const json_data = { name, message, capacity };
    const data = await this._client._request("POST", "/api/v1/node", undefined, json_data);
    return new Node(
      data.node_id,
      data.owner_id,
      data.name,
      data.message,
      data.capacity,
      this._client
    );
  }
}

export class Node {
  node_id: string;
  owner_id: string;
  name: string;
  message: string;
  capacity: number;
  private _client: Hashgrid;

  constructor(
    node_id: string,
    owner_id: string,
    name: string,
    message: string,
    capacity: number,
    client: Hashgrid
  ) {
    this.node_id = node_id;
    this.owner_id = owner_id;
    this.name = name;
    this.message = message;
    this.capacity = capacity;
    this._client = client;
  }

  async recv(): Promise<Message[]> {
    const data = await this._client._request(
      "GET",
      `/api/v1/node/${this.node_id}/recv`
    );
    return data.map(
      (item: any) =>
        new Message(item.peer_id, item.round, item.message, item.score ?? null)
    );
  }

  async send(replies: Message[]): Promise<Status[]> {
    const json_data = replies.map((msg) => {
      const obj: any = {
        peer_id: msg.peer_id,
        message: msg.message,
        round: msg.round,
      };
      if (msg.score !== null) {
        obj.score = msg.score;
      }
      return obj;
    });
    const data = await this._client._request(
      "POST",
      `/api/v1/node/${this.node_id}/send`,
      undefined,
      json_data
    );
    return data.map((item: any) => new Status(item.peer_id, item.round, item.success));
  }

  async update(
    name?: string,
    message?: string,
    capacity?: number
  ): Promise<Node> {
    const json_data: any = {};
    if (name !== undefined) json_data.name = name;
    if (message !== undefined) json_data.message = message;
    if (capacity !== undefined) json_data.capacity = capacity;

    if (Object.keys(json_data).length === 0) {
      return this;
    }

    const data = await this._client._request(
      "PUT",
      `/api/v1/node/${this.node_id}`,
      undefined,
      json_data
    );

    // Update local attributes
    if (data.name !== undefined) this.name = data.name;
    if (data.message !== undefined) this.message = data.message;
    if (data.capacity !== undefined) this.capacity = data.capacity;

    return this;
  }

  async delete(): Promise<void> {
    await this._client._request("DELETE", `/api/v1/node/${this.node_id}`);
  }
}

