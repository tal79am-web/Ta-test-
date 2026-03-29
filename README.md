# ERP MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that connects Claude to ERP systems — currently **SAP** (via OData) and any **Generic REST ERP** (Odoo, Dynamics, custom APIs, etc.).

## Tools exposed

### SAP OData tools

| Tool | Description |
|------|-------------|
| `sap_read_entity` | Query an OData entity set (supports `$filter`, `$select`, `$expand`, `$top`, `$skip`, `$orderby`) |
| `sap_create_entity` | POST a new entity (handles CSRF token fetch automatically) |
| `sap_update_entity` | PATCH an existing entity |
| `sap_delete_entity` | DELETE an entity |
| `sap_function_import` | Call a function import (RFC/BAPI wrapper) via GET or POST |
| `sap_get_metadata` | Fetch the `$metadata` XML for a service (shows entity types, properties, nav props) |

### Generic ERP REST tools

| Tool | Description |
|------|-------------|
| `erp_get` | GET any API path with optional query parameters |
| `erp_post` | POST with a JSON body |
| `erp_patch` | PATCH with a JSON body |
| `erp_put` | PUT with a JSON body |
| `erp_delete` | DELETE a resource |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `SAP_BASE_URL` | Root URL of your SAP OData services |
| `SAP_USERNAME` | SAP user |
| `SAP_PASSWORD` | SAP password |
| `SAP_CLIENT` | SAP client/mandant (optional) |
| `SAP_LANGUAGE` | Logon language (default: `EN`) |
| `ERP_BASE_URL` | Base URL for generic ERP REST API |
| `ERP_AUTH_TYPE` | `none` / `basic` / `bearer` / `api_key` |
| `ERP_USERNAME` | Username (basic auth) |
| `ERP_PASSWORD` | Password (basic auth) |
| `ERP_BEARER_TOKEN` | Bearer token |
| `ERP_API_KEY` | API key value |
| `ERP_API_KEY_HEADER` | API key header name (default: `X-API-Key`) |

### 3. Build

```bash
npm run build
```

### 4. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "erp": {
      "command": "node",
      "args": ["/path/to/Ta-test-/dist/index.js"],
      "env": {
        "SAP_BASE_URL": "https://your-sap-host/sap/opu/odata/sap",
        "SAP_USERNAME": "your-user",
        "SAP_PASSWORD": "your-pass",
        "ERP_BASE_URL": "https://your-erp/api",
        "ERP_AUTH_TYPE": "bearer",
        "ERP_BEARER_TOKEN": "your-token"
      }
    }
  }
}
```

### 5. Configure Claude Code CLI

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "erp": {
      "command": "node",
      "args": ["/path/to/Ta-test-/dist/index.js"]
    }
  }
}
```

## Example usage

Once connected, you can ask Claude things like:

- *"Read the first 10 open sales orders from SAP service ZSALES_SRV"*
- *"Create a purchase order in SAP with vendor 1000 and item material M-01"*
- *"Call the BAPI_SALESORDER_CREATEFROMDAT2 function import with these parameters"*
- *"GET /api/v1/invoices from the ERP and show me unpaid ones"*
- *"Update invoice #INV-001 status to paid via PATCH"*
