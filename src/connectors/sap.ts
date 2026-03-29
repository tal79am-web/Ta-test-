import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export interface SapConfig {
  baseUrl: string;       // e.g. https://my-sap-host/sap/opu/odata/sap
  username: string;
  password: string;
  client?: string;       // SAP client/mandant, e.g. "100"
  language?: string;     // SAP logon language, e.g. "EN"
}

export interface ODataQueryOptions {
  service: string;       // OData service name, e.g. "ZMY_SERVICE_SRV"
  entitySet: string;     // Entity set name, e.g. "SalesOrderSet"
  filter?: string;       // $filter expression
  select?: string;       // $select fields
  expand?: string;       // $expand navigation properties
  top?: number;          // $top
  skip?: number;         // $skip
  orderby?: string;      // $orderby
  key?: string;          // Entity key for single record, e.g. "SalesOrderID='0001'"
}

export interface FunctionImportOptions {
  service: string;
  functionName: string;
  method?: "GET" | "POST";
  params?: Record<string, string | number | boolean>;
  body?: Record<string, unknown>;
}

export class SapConnector {
  private client: AxiosInstance;
  private config: SapConfig;

  constructor(config: SapConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(config.client ? { "sap-client": config.client } : {}),
        ...(config.language ? { "sap-language": config.language } : {}),
      },
    });
  }

  private buildODataUrl(options: ODataQueryOptions): string {
    const { service, entitySet, key } = options;
    let path = `/${service}/${entitySet}`;
    if (key) {
      path += `(${key})`;
    }

    const params = new URLSearchParams();
    if (options.filter) params.set("$filter", options.filter);
    if (options.select) params.set("$select", options.select);
    if (options.expand) params.set("$expand", options.expand);
    if (options.top !== undefined) params.set("$top", String(options.top));
    if (options.skip !== undefined) params.set("$skip", String(options.skip));
    if (options.orderby) params.set("$orderby", options.orderby);
    params.set("$format", "json");

    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  async readEntity(options: ODataQueryOptions): Promise<unknown> {
    const url = this.buildODataUrl(options);
    const response = await this.client.get(url);
    return response.data?.d ?? response.data;
  }

  async createEntity(
    options: Pick<ODataQueryOptions, "service" | "entitySet">,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const url = `/${options.service}/${options.entitySet}?$format=json`;
    // Fetch CSRF token first
    const tokenRes = await this.client.get(`/${options.service}`, {
      headers: { "X-CSRF-Token": "Fetch" },
    });
    const csrfToken = tokenRes.headers["x-csrf-token"] as string | undefined;

    const response = await this.client.post(url, payload, {
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    });
    return response.data?.d ?? response.data;
  }

  async updateEntity(
    options: ODataQueryOptions,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; status: number }> {
    const url = this.buildODataUrl(options);
    const tokenRes = await this.client.get(`/${options.service}`, {
      headers: { "X-CSRF-Token": "Fetch" },
    });
    const csrfToken = tokenRes.headers["x-csrf-token"] as string | undefined;

    const response = await this.client.patch(url, payload, {
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    });
    return { success: true, status: response.status };
  }

  async deleteEntity(
    options: ODataQueryOptions
  ): Promise<{ success: boolean; status: number }> {
    const url = this.buildODataUrl(options);
    const tokenRes = await this.client.get(`/${options.service}`, {
      headers: { "X-CSRF-Token": "Fetch" },
    });
    const csrfToken = tokenRes.headers["x-csrf-token"] as string | undefined;

    const response = await this.client.delete(url, {
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    });
    return { success: true, status: response.status };
  }

  async callFunctionImport(options: FunctionImportOptions): Promise<unknown> {
    const { service, functionName, method = "GET", params, body } = options;
    const urlParams = new URLSearchParams({ "$format": "json" });
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        urlParams.set(k, String(v));
      }
    }
    const url = `/${service}/${functionName}?${urlParams.toString()}`;

    let response;
    if (method === "POST") {
      const tokenRes = await this.client.get(`/${service}`, {
        headers: { "X-CSRF-Token": "Fetch" },
      });
      const csrfToken = tokenRes.headers["x-csrf-token"] as string | undefined;
      response = await this.client.post(url, body ?? {}, {
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
      });
    } else {
      response = await this.client.get(url);
    }
    return response.data?.d ?? response.data;
  }

  async listServices(): Promise<unknown> {
    const response = await this.client.get("/?$format=json");
    return response.data;
  }

  async getServiceMetadata(service: string): Promise<string> {
    const response = await this.client.get(`/${service}/$metadata`, {
      headers: { Accept: "application/xml" },
    });
    return response.data;
  }
}
