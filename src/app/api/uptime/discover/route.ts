import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";

const execAsync = promisify(exec);

export async function GET() {
  const { response } = await requireApiSession();
  if (response) return response;

  try {
    // Try to find containers connected to 'omnigrid-net' network
    const { stdout } = await execAsync(
      `docker ps --filter network=omnigrid-net --format '{{json .}}'`,
      { timeout: 5000 }
    );

    const containers = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          return {
            id: parsed.ID,
            name: parsed.Names,
            image: parsed.Image,
            state: parsed.State,
            status: parsed.Status,
            ports: parsed.Ports,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ containers });
  } catch (err) {
    // Docker might not be installed, or the network might not exist
    const message = err instanceof Error ? err.message : String(err);
    console.error("[uptime] docker discover failed:", message);
    return NextResponse.json({ error: "Failed to detect docker containers", detail: message }, { status: 500 });
  }
}
