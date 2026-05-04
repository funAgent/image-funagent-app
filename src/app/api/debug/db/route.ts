import { Client } from "pg";

export const runtime = "nodejs";

function safeConnectionInfo(connectionString: string | undefined) {
  if (!connectionString) {
    return {
      configured: false,
      protocol: null,
      username: null,
      host: null,
      port: null,
      database: null,
      sslmode: null,
      pgbouncer: null,
      connectionLimit: null,
      uselibpqcompat: null,
    };
  }

  try {
    const url = new URL(connectionString);
    return {
      configured: true,
      protocol: url.protocol,
      username: decodeURIComponent(url.username),
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, "") || null,
      sslmode: url.searchParams.get("sslmode"),
      pgbouncer: url.searchParams.get("pgbouncer"),
      connectionLimit: url.searchParams.get("connection_limit"),
      uselibpqcompat: url.searchParams.get("uselibpqcompat"),
    };
  } catch (error) {
    return {
      configured: true,
      parseError: error instanceof Error ? error.message : "Invalid URL",
    };
  }
}

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  const info = safeConnectionInfo(connectionString);

  if (!connectionString) {
    return Response.json({ ok: false, databaseUrl: info });
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    const result = await client.query<{
      current_user: string;
      current_database: string;
      invite_count: string;
    }>(`
      select
        current_user,
        current_database(),
        (select count(*)::text from public."InviteCode") as invite_count
    `);

    return Response.json({
      ok: true,
      databaseUrl: info,
      database: result.rows[0],
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        databaseUrl: info,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                code:
                  "code" in error && typeof error.code === "string"
                    ? error.code
                    : null,
              }
            : { message: "Unknown error", code: null },
      },
      { status: 500 },
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
