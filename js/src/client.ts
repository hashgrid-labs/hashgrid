/** Main Hashgrid client class. */

import {
  HashgridAPIError,
  HashgridAuthenticationError,
  HashgridNotFoundError,
  HashgridValidationError,
} from "./exceptions";
import { Grid } from "./resources";

export class Hashgrid {
  private api_key?: string;
  private base_url: string;
  private timeout: number;

  constructor(
    api_key?: string,
    base_url: string = "https://dna.hashgrid.ai",
    timeout: number = 30000
  ) {
    this.api_key = api_key;
    this.base_url = base_url.replace(/\/$/, "");
    this.timeout = timeout;
  }

  private _getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.api_key) {
      headers["Authorization"] = `Bearer ${this.api_key}`;
    }
    return headers;
  }

  async _request(
    method: string,
    endpoint: string,
    params?: Record<string, any>,
    json_data?: any
  ): Promise<any> {
    let url: string;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      url = endpoint;
    } else {
      const base = this.base_url.endsWith("/") ? this.base_url.slice(0, -1) : this.base_url;
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
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), this.timeout);

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

    if (json_data !== undefined) {
      options.body = JSON.stringify(json_data);
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
            response
          );
        } else if (response.status === 404) {
          throw new HashgridNotFoundError(
            "Resource not found",
            response.status,
            response
          );
        } else if (response.status === 422) {
          const errorData = response.headers.get("content-type")?.includes("application/json")
            ? await response.json().catch(() => ({}))
            : {};
          throw new HashgridValidationError(
            errorData.message || "Validation error",
            response.status,
            response
          );
        } else {
          const errorData = response.headers.get("content-type")?.includes("application/json")
            ? await response.json().catch(() => ({}))
            : {};
          throw new HashgridAPIError(
            errorData.message || `API error: ${response.status}`,
            response.status,
            response
          );
        }
      }

      if (!response.body) {
        return {};
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      } else {
        return { content: await response.text() };
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

  static async connect(
    api_key?: string,
    base_url: string = "https://dna.hashgrid.ai",
    timeout: number = 30000
  ): Promise<Grid> {
    const client = new Hashgrid(api_key, base_url, timeout);
    const data = await client._request("GET", "/api/v1");
    const grid = new Grid(data.name, data.tick, client);
    return grid;
  }
}

