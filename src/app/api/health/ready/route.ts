import { NextResponse } from "next/server";
import { migrationStatus } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

export function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    const migration = migrationStatus();
    const ready = migration.current === migration.expected;
    return NextResponse.json({
      status: ready ? "ok" : "not_ready",
      database: "ok",
      migration,
    }, {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      status: "not_ready",
      database: "error",
      error: error instanceof Error ? error.message : "database check failed",
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
