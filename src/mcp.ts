import { Router, Request, Response } from "express";
import { SnowflakeClient } from "./snowflake.js";

const TOOLS = [
  {
    name: "run_query",
    description:
      "Execute a read-only SQL SELECT query against Snowflake. Always prefer this for data retrieval and report generation.",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A SQL SELECT statement to execute. Only SELECT statements are allowed.",
        },
        limit: {
          type: "number",
          description: "Optional row limit override (default 500, max 2000)",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "list_tables",
    description: "List all tables in a Snowflake schema. Use this to explore what data is available.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string", description: "Schema name (defaults to configured schema)" },
        database: { type: "string", description: "Database name (defaults to configured database)" },
      },
    },
  },
  {
    name: "list_schemas",
    description: "List all schemas in a Snowflake database.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (defaults to configured database)" },
      },
    },
  },
  {
    name: "describe_table",
    description:
      "Get the column definitions for a table including data types, nullability, and defaults. Use this before writing queries to understand the schema.",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        schema: { type: "string", description: "Schema name (defaults to configured schema)" },
        database: { type: "string", description: "Database name (defaults to configured database)" },
      },
      required: ["table"],
    },
  },
  {
    name: "list_views",
    description: "List all views in a Snowflake schema.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string", description: "Schema name (defaults to configured schema)" },
        database: { type: "string", description: "Database name (defaults to configured database)" },
      },
    },
  },
  {
    name: "sample_table",
    description: "Fetch a small sample of rows from a table to understand its structure and data.",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        limit: { type: "number", description: "Number of rows to return (default 5, max 20)" },
        schema: { type: "string", description: "Schema name (defaults to configured schema)" },
        database: { type: "string", description: "Database name (defaults to configured database)" },
      },
      required: ["table"],
    },
  },
  {
    name: "query_history",
    description: "View recent successfully executed queries in this Snowflake account.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of queries to return (default 20, max 100)" },
      },
    },
  },
];

async function callTool(sf: SnowflakeClient, name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "run_query": {
        const sql = String(args.sql || "").trim();
        if (!/^SELECT/i.test(sql)) {
          return JSON.stringify({ error: "Only SELECT statements are allowed." });
        }
        const maxLimit = Math.min(args.limit || 500, 2000);
        // Inject LIMIT if not present
        const finalSql = /LIMIT\s+\d+/i.test(sql) ? sql : `${sql} LIMIT ${maxLimit}`;
        const rows = await sf.query(finalSql);
        return JSON.stringify({ row_count: rows.length, rows });
      }
      case "list_tables": {
        const rows = await sf.listTables(args.schema, args.database);
        return JSON.stringify({ tables: rows });
      }
      case "list_schemas": {
        const rows = await sf.listSchemas(args.database);
        return JSON.stringify({ schemas: rows });
      }
      case "describe_table": {
        const rows = await sf.describeTable(args.table, args.schema, args.database);
        return JSON.stringify({ columns: rows });
      }
      case "list_views": {
        const rows = await sf.listViews(args.schema, args.database);
        return JSON.stringify({ views: rows });
      }
      case "sample_table": {
        const limit = Math.min(args.limit || 5, 20);
        const rows = await sf.getSampleRows(args.table, limit, args.schema, args.database);
        return JSON.stringify({ row_count: rows.length, rows });
      }
      case "query_history": {
        const limit = Math.min(args.limit || 20, 100);
        const rows = await sf.getQueryHistory(limit);
        return JSON.stringify({ queries: rows });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || String(err) });
  }
}

export function createMcpRouter(sf: SnowflakeClient): Router {
  const router = Router();

  // SSE endpoint — Claude.ai connects here for streaming
  router.get("/sse", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Send server info
    sendEvent("endpoint", { uri: `/mcp/messages?sessionId=${Date.now()}` });

    // Keepalive
    const keepalive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15000);

    req.on("close", () => clearInterval(keepalive));
  });

  // Message handling endpoint
  router.post("/messages", async (req: Request, res: Response) => {
    const { method, params, id } = req.body;

    const reply = (result: any) => res.json({ jsonrpc: "2.0", id, result });
    const error = (code: number, message: string) =>
      res.json({ jsonrpc: "2.0", id, error: { code, message } });

    switch (method) {
      case "initialize":
        return reply({
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "snowflake-mcp", version: "1.0.0" },
        });

      case "tools/list":
        return reply({ tools: TOOLS });

      case "tools/call": {
        const { name, arguments: args } = params;
        const content = await callTool(sf, name, args || {});
        return reply({
          content: [{ type: "text", text: content }],
        });
      }

      case "ping":
        return reply({});

      default:
        return error(-32601, `Method not found: ${method}`);
    }
  });

  return router;
}
