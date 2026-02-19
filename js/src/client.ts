/** Main Hashgrid client class. */

import {
  HashgridAPIError,
  HashgridAuthenticationError,
  HashgridNotFoundError,
  HashgridValidationError,
} from "./exceptions";
import { Grid } from "./resources";

export class Hashgrid {
  private apiKey?: string;
  private baseUrl: string;
  private timeout: number;

  constructor(
    apiKey?: string,
    baseUrl: string = "https://dna.hashgrid.ai",
    timeout: number = 30000,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeout = timeout;
  }

  private _getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async request(
    method: string,
    endpoint: string,
    params?: Record<string, any>,
    jsonData?: any,
  ): Promise<any> {
    let url: string;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      url = endpoint;
    } else {
      const base = this.baseUrl.endsWith("/")
        ? this.baseUrl.slice(0, -1)
        : this.baseUrl;
      const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      url = `${base}${path}`;
    }

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    const headers = this._getHeaders();
    const controller = new AbortController();
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      this.timeout,
    );

    const options: {
      method: string;
      headers: Record<string, string>;
      signal: AbortSignal;
      body?: string;
    } = {
      method,
      headers,
      signal: controller.signal,
    };

    if (jsonData !== undefined) {
      options.body = JSON.stringify(jsonData);
    }

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      return await this._handleResponse(response);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new HashgridAPIError(`Request timeout after ${this.timeout}ms`);
      }
      throw new HashgridAPIError(`Request failed: ${error.message}`);
    }
  }

  async _handleResponse(response: Response): Promise<any> {
    try {
      if (!response.ok) {
        if (response.status === 401) {
          throw new HashgridAuthenticationError(
            "Authentication failed. Check your API key.",
            response.status,
            response,
          );
        } else if (response.status === 404) {
          throw new HashgridNotFoundError(
            "Resource not found",
            response.status,
            response,
          );
        } else if (response.status === 422) {
          const errorData = response.headers
            .get("content-type")
            ?.includes("application/json")
            ? await response.json().catch(() => ({}))
            : {};
          throw new HashgridValidationError(
            errorData.message || "Validation error",
            response.status,
            response,
          );
        } else {
          const errorData = response.headers
            .get("content-type")
            ?.includes("application/json")
            ? await response.json().catch(() => ({}))
            : {};
          throw new HashgridAPIError(
            errorData.message || `API error: ${response.status}`,
            response.status,
            response,
          );
        }
      }

      // Check Content-Type instead of response.body (response.body is undefined in React Native)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        try {
          const json = await response.json();
          return json ?? {};
        } catch (err) {
          // If JSON parsing fails, return empty object
          return {};
        }
      } else if (contentType) {
        // Non-JSON content type, return as text
        try {
          const text = await response.text();
          return { content: text };
        } catch (err) {
          return { content: "" };
        }
      } else {
        // No content type, try to parse as JSON, fallback to empty object
        try {
          const json = await response.json();
          return json ?? {};
        } catch (err) {
          return {};
        }
      }
    } catch (error) {
      if (
        error instanceof HashgridAPIError ||
        error instanceof HashgridAuthenticationError ||
        error instanceof HashgridNotFoundError ||
        error instanceof HashgridValidationError
      ) {
        throw error;
      }
      throw new HashgridAPIError(`Response handling failed: ${error}`);
    }
  }

  async *stream(
    method: string,
    endpoint: string,
    params?: Record<string, any>,
    jsonData?: any,
  ): AsyncGenerator<string> {
    const base = this.baseUrl.endsWith("/")
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    let url = `${base}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    const headers = this._getHeaders();
    headers["Accept"] = "text/event-stream";

    const options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method,
      headers,
    };

    if (jsonData !== undefined) {
      options.body = JSON.stringify(jsonData);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new HashgridAPIError(`SSE connection failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) {
      throw new HashgridAPIError("Response body is not readable");
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            yield line.slice(6).trim();
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  static async connect(
    apiKey?: string,
    baseUrl: string = "https://dna.hashgrid.ai",
    timeout: number = 30000,
  ): Promise<Grid> {
    const client = new Hashgrid(apiKey, baseUrl, timeout);
    const data = await client.request("GET", "/api/v1/");
    const grid = new Grid(data.name, data.tick, client);
    return grid;
  }
}
