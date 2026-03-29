#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { SapConnector, SapConfig } from "./connectors/sap.js";
import { GenericErpConnector, GenericErpConfig, AuthType } from "./connectors/generic.js";

// ─── SAP config from environment ───────────────────────────────────────────
function getSapConnector(): SapConnector | null {
  const baseUrl = process.env.SAP_BASE_URL;
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  if (!baseUrl || !username || !password) return null;
  const config: SapConfig = {
    baseUrl,
    username,
    password,
    client: process.env.SAP_CLIENT,
    language: process.env.SAP_LANGUAGE ?? "EN",
  };
  return new SapConnector(config);
}

// ─── Generic ERP config from environment ───────────────────────────────────
function getGenericConnector(): GenericErpConnector | null {
  const baseUrl = process.env.ERP_BASE_URL;
  if (!baseUrl) return null;
  const authType = (process.env.ERP_AUTH_TYPE ?? "none") as AuthType;
  const config: GenericErpConfig = {
    baseUrl,
    auth: {
      type: authType,
      username: process.env.ERP_USERNAME,
      password: process.env.ERP_PASSWORD,
      token: process.env.ERP_BEARER_TOKEN,
      apiKey: process.env.ERP_API_KEY,
      apiKeyHeader: process.env.ERP_API_KEY_HEADER,
    },
  };
  return new GenericErpConnector(config);
}

// ─── Tool definitions ───────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  // SAP tools
  {
    name: "sap_read_entity",
    description:
      "Read one or more records from an SAP OData entity set. Returns JSON results.",
    inputSchema: {
      type: "object",
      required: ["service", "entitySet"],
      properties: {
        service: { type: "string", description: "OData service name, e.g. 'ZMY_SERVICE_SRV'" },
        entitySet: { type: "string", description: "Entity set name, e.g. 'SalesOrderSet'" },
        key: { type: "string", description: "Entity key for single record, e.g. \"SalesOrderID='0001'\"" },
        filter: { type: "string", description: "$filter expression, e.g. \"Status eq 'A'\"" },
        select: { type: "string", description: "Comma-separated fields to return" },
        expand: { type: "string", description: "Navigation properties to expand" },
        top: { type: "number", description: "Max records to return" },
        skip: { type: "number", description: "Records to skip (pagination)" },
        orderby: { type: "string", description: "Order-by expression" },
      },
    },
  },
  {
    name: "sap_create_entity",
    description: "Create a new record in an SAP OData entity set.",
    inputSchema: {
      type: "object",
      required: ["service", "entitySet", "payload"],
      properties: {
        service: { type: "string" },
        entitySet: { type: "string" },
        payload: { type: "object", description: "Fields of the new entity" },
      },
    },
  },
  {
    name: "sap_update_entity",
    description: "Update an existing SAP OData entity (PATCH).",
    inputSchema: {
      type: "object",
      required: ["service", "entitySet", "key", "payload"],
      properties: {
        service: { type: "string" },
        entitySet: { type: "string" },
        key: { type: "string", description: "Entity key, e.g. \"SalesOrderID='0001'\"" },
        payload: { type: "object", description: "Fields to update" },
      },
    },
  },
  {
    name: "sap_delete_entity",
    description: "Delete an SAP OData entity.",
    inputSchema: {
      type: "object",
      required: ["service", "entitySet", "key"],
      properties: {
        service: { type: "string" },
        entitySet: { type: "string" },
        key: { type: "string" },
      },
    },
  },
  {
    name: "sap_function_import",
    description: "Call an SAP OData function import (RFC/BAPI wrapper).",
    inputSchema: {
      type: "object",
      required: ["service", "functionName"],
      properties: {
        service: { type: "string" },
        functionName: { type: "string", description: "Function import name" },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        params: { type: "object", description: "URL parameters for GET function imports" },
        body: { type: "object", description: "Body for POST function imports" },
      },
    },
  },
  {
    name: "sap_get_metadata",
    description: "Retrieve the $metadata XML document for an SAP OData service (shows all entity sets, properties, and relationships).",
    inputSchema: {
      type: "object",
      required: ["service"],
      properties: {
        service: { type: "string" },
      },
    },
  },
  // Generic ERP tools
  {
    name: "erp_get",
    description: "HTTP GET request to any configured ERP REST endpoint.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "API path, e.g. '/api/v1/invoices'" },
        params: {
          type: "object",
          description: "Query parameters",
          additionalProperties: { type: "string" },
        },
      },
    },
  },
  {
    name: "erp_post",
    description: "HTTP POST request to any configured ERP REST endpoint.",
    inputSchema: {
      type: "object",
      required: ["path", "body"],
      properties: {
        path: { type: "string" },
        body: { type: "object" },
      },
    },
  },
  {
    name: "erp_patch",
    description: "HTTP PATCH request to any configured ERP REST endpoint.",
    inputSchema: {
      type: "object",
      required: ["path", "body"],
      properties: {
        path: { type: "string" },
        body: { type: "object" },
      },
    },
  },
  {
    name: "erp_put",
    description: "HTTP PUT request to any configured ERP REST endpoint.",
    inputSchema: {
      type: "object",
      required: ["path", "body"],
      properties: {
        path: { type: "string" },
        body: { type: "object" },
      },
    },
  },
  {
    name: "erp_delete",
    description: "HTTP DELETE request to any configured ERP REST endpoint.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
  },
];

// ─── Input schemas (for runtime validation) ────────────────────────────────
const SapReadSchema = z.object({
  service: z.string(),
  entitySet: z.string(),
  key: z.string().optional(),
  filter: z.string().optional(),
  select: z.string().optional(),
  expand: z.string().optional(),
  top: z.number().optional(),
  skip: z.number().optional(),
  orderby: z.string().optional(),
});

const SapCreateSchema = z.object({
  service: z.string(),
  entitySet: z.string(),
  payload: z.record(z.unknown()),
});

const SapUpdateSchema = z.object({
  service: z.string(),
  entitySet: z.string(),
  key: z.string(),
  payload: z.record(z.unknown()),
});

const SapDeleteSchema = z.object({
  service: z.string(),
  entitySet: z.string(),
  key: z.string(),
});

const SapFunctionSchema = z.object({
  service: z.string(),
  functionName: z.string(),
  method: z.enum(["GET", "POST"]).default("GET"),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  body: z.record(z.unknown()).optional(),
});

const SapMetadataSchema = z.object({ service: z.string() });

const ErpGetSchema = z.object({
  path: z.string(),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const ErpBodySchema = z.object({
  path: z.string(),
  body: z.record(z.unknown()),
});

const ErpDeleteSchema = z.object({ path: z.string() });

// ─── Server setup ───────────────────────────────────────────────────────────
const server = new Server(
  { name: "erp-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── SAP tools ────────────────────────────────────────────────────────
      case "sap_read_entity": {
        const sap = getSapConnector();
        if (!sap) return missingConfig("SAP");
        const opts = SapReadSchema.parse(args);
        const result = await sap.readEntity(opts);
        return jsonResult(result);
      }

      case "sap_create_entity": {
        const sap = getSapConnector();
        if (!sap) return missingConfig("SAP");
        const opts = SapCreateSchema.parse(args);
        const result = await sap.createEntity(
          { service: opts.service, entitySet: opts.entitySet },
          opts.payload
        );
        return jsonResult(result);
      }

      case "sap_update_entity": {
        const sap = getSapConnector();
        if (!sap) return missingConfig("SAP");
        const opts = SapUpdateSchema.parse(args);
        const result = await sap.updateEntity(
          { service: opts.service, entitySet: opts.entitySet, key: opts.key },
          opts.payload
        );
        return jsonResult(result);
      }

      case "sap_delete_entity": {
        const sap = getSapConnector();
        if (!sap) return missingConfig("SAP");
        const opts = SapDeleteSchema.parse(args);
        const result = await sap.deleteEntity({
          service: opts.service,
          entitySet: opts.entitySet,
          key: opts.key,
        });
        return jsonResult(result);
      }

      case "sap_function_import": {
        const sap = getSapConnector();
        if (!sap) return missingConfig("SAP");
        const opts = SapFunctionSchema.parse(args);
        const result = await sap.callFunctionImport(opts);
        return jsonResult(result);
      }

      case "sap_get_metadata": {
        const sap = getSapConnector();
        if (!sap) return missingConfig("SAP");
        const { service } = SapMetadataSchema.parse(args);
        const xml = await sap.getServiceMetadata(service);
        return { content: [{ type: "text", text: xml }] };
      }

      // ── Generic ERP tools ─────────────────────────────────────────────────
      case "erp_get": {
        const erp = getGenericConnector();
        if (!erp) return missingConfig("Generic ERP");
        const { path, params } = ErpGetSchema.parse(args);
        const result = await erp.get(path, params);
        return jsonResult(result);
      }

      case "erp_post": {
        const erp = getGenericConnector();
        if (!erp) return missingConfig("Generic ERP");
        const { path, body } = ErpBodySchema.parse(args);
        const result = await erp.post(path, body);
        return jsonResult(result);
      }

      case "erp_patch": {
        const erp = getGenericConnector();
        if (!erp) return missingConfig("Generic ERP");
        const { path, body } = ErpBodySchema.parse(args);
        const result = await erp.patch(path, body);
        return jsonResult(result);
      }

      case "erp_put": {
        const erp = getGenericConnector();
        if (!erp) return missingConfig("Generic ERP");
        const { path, body } = ErpBodySchema.parse(args);
        const result = await erp.put(path, body);
        return jsonResult(result);
      }

      case "erp_delete": {
        const erp = getGenericConnector();
        if (!erp) return missingConfig("Generic ERP");
        const { path } = ErpDeleteSchema.parse(args);
        const result = await erp.delete(path);
        return jsonResult(result);
      }

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function jsonResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

function missingConfig(system: string) {
  return errorResult(
    `${system} is not configured. Set the required environment variables (see README.md).`
  );
}

// ─── Start ──────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ERP MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
