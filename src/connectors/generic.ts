import axios, { AxiosInstance, Method } from "axios";

export type AuthType = "basic" | "bearer" | "api_key" | "none";

export interface GenericErpConfig {
  baseUrl: string;
  auth: {
    type: AuthType;
    username?: string;      // for basic
    password?: string;      // for basic
    token?: string;         // for bearer
    apiKey?: string;        // for api_key
    apiKeyHeader?: string;  // header name for api_key, default "X-API-Key"
  };
  defaultHeaders?: Record<string, string>;
}

export interface GenericRequestOptions {
  method: Method;
  path: string;             // e.g. "/api/v1/sales-orders"
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
}

export class GenericErpConnector {
  private client: AxiosInstance;

  constructor(private config: GenericErpConfig) {
    const authHeaders: Record<string, string> = {};

    if (config.auth.type === "bearer" && config.auth.token) {
      authHeaders["Authorization"] = `Bearer ${config.auth.token}`;
    } else if (config.auth.type === "api_key" && config.auth.apiKey) {
      const headerName = config.auth.apiKeyHeader ?? "X-API-Key";
      authHeaders[headerName] = config.auth.apiKey;
    }

    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeaders,
        ...(config.defaultHeaders ?? {}),
      },
      auth:
        config.auth.type === "basic" &&
        config.auth.username &&
        config.auth.password
          ? { username: config.auth.username, password: config.auth.password }
          : undefined,
    });
  }

  async request(options: GenericRequestOptions): Promise<unknown> {
    const response = await this.client.request({
      method: options.method,
      url: options.path,
      params: options.params,
      data: options.body,
      headers: options.headers,
    });
    return response.data;
  }

  async get(path: string, params?: Record<string, string | number | boolean>): Promise<unknown> {
    return this.request({ method: "GET", path, params });
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.request({ method: "POST", path, body });
  }

  async put(path: string, body: unknown): Promise<unknown> {
    return this.request({ method: "PUT", path, body });
  }

  async patch(path: string, body: unknown): Promise<unknown> {
    return this.request({ method: "PATCH", path, body });
  }

  async delete(path: string): Promise<unknown> {
    return this.request({ method: "DELETE", path });
  }
}
