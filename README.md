# Snowflake MCP Server

A deployable MCP server that connects Claude.ai to your Snowflake data warehouse.
Teammates add a single URL to their Claude.ai settings and can immediately start
asking Claude to explore schemas, write queries, and build reports.

## Tools exposed to Claude

| Tool | Description |
|------|-------------|
| `run_query` | Execute a read-only SELECT query |
| `list_tables` | List tables in a schema |
| `list_schemas` | List schemas in a database |
| `describe_table` | Get column definitions for a table |
| `list_views` | List views in a schema |
| `sample_table` | Fetch sample rows from a table |
| `query_history` | View recent query history |

Only `SELECT` statements are allowed — write operations are blocked at the server level.

---

## Setup

### 1. Create a Snowflake service account

```sql
-- Run in Snowflake as ACCOUNTADMIN
CREATE ROLE reporting_role;
GRANT USAGE ON WAREHOUSE reporting_wh TO ROLE reporting_role;
GRANT USAGE ON DATABASE analytics TO ROLE reporting_role;
GRANT USAGE ON ALL SCHEMAS IN DATABASE analytics TO ROLE reporting_role;
GRANT SELECT ON ALL TABLES IN DATABASE analytics TO ROLE reporting_role;
GRANT SELECT ON ALL VIEWS IN DATABASE analytics TO ROLE reporting_role;
-- Grant on future objects too
GRANT SELECT ON FUTURE TABLES IN DATABASE analytics TO ROLE reporting_role;
GRANT SELECT ON FUTURE VIEWS IN DATABASE analytics TO ROLE reporting_role;

CREATE USER mcp_service_user
  PASSWORD = 'your-secure-password'
  DEFAULT_ROLE = reporting_role
  DEFAULT_WAREHOUSE = reporting_wh;

GRANT ROLE reporting_role TO USER mcp_service_user;
```

### 2. Generate API keys for your team

Each teammate needs their own key:

```bash
# Mac/Linux
openssl rand -hex 32

# Or use any random string generator
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

---

## Deployment

### Option A: Railway (recommended for getting started)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all environment variables from `.env.example` in the Railway dashboard
4. Railway auto-deploys and gives you a public HTTPS URL

### Option B: Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo
3. Render detects `render.yaml` and prompts for env vars
4. Fill in the values and deploy

### Option C: Docker (self-hosted)

```bash
# Build and run
docker compose --env-file .env up -d

# Or build manually
docker build -t snowflake-mcp .
docker run -p 3000:3000 --env-file .env snowflake-mcp
```

---

## Connecting Claude.ai

Once deployed, each teammate:

1. Goes to **Claude.ai → Settings → Integrations → Add custom integration**
2. Enters the server URL:
   ```
   https://your-deployment-url.railway.app/mcp/sse
   ```
3. Adds their API key as the Authorization header:
   ```
   Bearer their-api-key-here
   ```

Done! Claude will now have Snowflake tools available in every conversation.

---

## Example prompts for report building

Once connected, your team can ask Claude things like:

- *"What tables are in our analytics database?"*
- *"Describe the orders table and show me a few sample rows"*
- *"Write a query showing revenue by month for the last 12 months"*
- *"Find the top 10 customers by lifetime value"*
- *"Build a cohort retention analysis using the users and events tables"*

---

## Security notes

- All queries are restricted to `SELECT` — no `INSERT`, `UPDATE`, `DELETE`, or DDL
- Use a dedicated Snowflake role with minimal permissions (read-only on specific schemas)
- Give each teammate their own API key so you can rotate individually if needed
- The `/health` endpoint is public; all `/mcp/*` endpoints require a valid API key
