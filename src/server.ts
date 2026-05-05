import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { SnowflakeClient } from "./snowflake.js";
import { createMcpRouter } from "./mcp.js";
import { authMiddleware } from "./auth.js";

const app = express();
app.use(cors());
app.use(express.json());

const snowflake = new SnowflakeClient({
  account: process.env.SNOWFLAKE_ACCOUNT!,
  username: process.env.SNOWFLAKE_USER!,
  password: process.env.SNOWFLAKE_PASSWORD!,
  database: process.env.SNOWFLAKE_DATABASE!,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
  schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
  role: process.env.SNOWFLAKE_ROLE,
});

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "snowflake-mcp" });
});

// MCP routes (auth required)
app.use("/mcp", authMiddleware, createMcpRouter(snowflake));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Snowflake MCP server running on port ${PORT}`);
});
