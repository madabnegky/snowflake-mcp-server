import snowflake from "snowflake-sdk";

interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  database: string;
  warehouse: string;
  schema: string;
  role?: string;
}

export class SnowflakeClient {
  private config: SnowflakeConfig;

  constructor(config: SnowflakeConfig) {
    this.config = config;
  }

  private getConnection(): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
      const connection = snowflake.createConnection({
        account: this.config.account,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database,
        warehouse: this.config.warehouse,
        schema: this.config.schema,
        role: this.config.role,
      });

      connection.connect((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });
  }

  async query(sql: string, binds: any[] = []): Promise<any[]> {
    const conn = await this.getConnection();
    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        binds,
        complete: (err, _stmt, rows) => {
          conn.destroy(() => {});
          if (err) reject(err);
          else resolve(rows || []);
        },
      });
    });
  }

  async listDatabases(): Promise<any[]> {
    return this.query("SHOW DATABASES");
  }

  async listSchemas(database?: string): Promise<any[]> {
    const db = database || this.config.database;
    return this.query(`SHOW SCHEMAS IN DATABASE "${db}"`);
  }

  async listTables(schema?: string, database?: string): Promise<any[]> {
    const db = database || this.config.database;
    const sc = schema || this.config.schema;
    return this.query(`SHOW TABLES IN SCHEMA "${db}"."${sc}"`);
  }

  async describeTable(table: string, schema?: string, database?: string): Promise<any[]> {
    const db = database || this.config.database;
    const sc = schema || this.config.schema;
    return this.query(`DESCRIBE TABLE "${db}"."${sc}"."${table}"`);
  }

  async listViews(schema?: string, database?: string): Promise<any[]> {
    const db = database || this.config.database;
    const sc = schema || this.config.schema;
    return this.query(`SHOW VIEWS IN SCHEMA "${db}"."${sc}"`);
  }

  async getSampleRows(table: string, limit = 5, schema?: string, database?: string): Promise<any[]> {
    const db = database || this.config.database;
    const sc = schema || this.config.schema;
    return this.query(`SELECT * FROM "${db}"."${sc}"."${table}" LIMIT ${limit}`);
  }

  async getQueryHistory(limit = 20): Promise<any[]> {
    return this.query(`
      SELECT query_id, query_text, database_name, schema_name,
             execution_status, start_time, end_time,
             total_elapsed_time / 1000 as elapsed_seconds,
             rows_produced, bytes_scanned / (1024*1024) as mb_scanned
      FROM snowflake.account_usage.query_history
      WHERE execution_status = 'SUCCESS'
      ORDER BY start_time DESC
      LIMIT ${limit}
    `);
  }
}
