import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "ssh2";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { buildAuth } from "@/lib/ssh/manager";

export const runtime = "nodejs";

const execAsync = promisify(exec);

async function execSsh(node: any, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let stdout = "";
    
    let auth;
    try {
      auth = buildAuth(node);
    } catch (e) {
      return reject(e);
    }
    
    const { methodLabel, ...connectAuth } = auth;
    
    client.on("ready", () => {
      client.exec(command, (err, stream) => {
        if (err) {
          client.end();
          return reject(err);
        }
        stream.on("data", (data: Buffer) => {
          stdout += data.toString("utf8");
        });
        stream.on("close", () => {
          client.end();
          resolve(stdout);
        });
      });
    });

    client.on("error", (err) => {
      client.end();
      reject(err);
    });

    client.connect({
      host: node.hostname,
      port: node.ssh_port,
      readyTimeout: 10000,
      ...connectAuth,
    });
  });
}

export async function GET() {
  const { user, response } = await requireApiSession();
  if (response) return response;

  const allContainers: any[] = [];
  
  // 1. Scan Local Host
  try {
    const { stdout } = await execAsync(
      `docker ps --filter network=omnigrid-net --format '{{json .}}'`,
      { timeout: 5000 }
    );
    const localContainers = parseDockerOutput(stdout, "Local Server");
    allContainers.push(...localContainers);
  } catch (err: any) {
    console.error("[uptime] docker discover local failed (ignoring):", err.message);
  }

  // 2. Scan all managed nodes via SSH
  let nodes: ReturnType<typeof nodesRepo.list> = [];
  try {
    nodes = nodesRepo.list(user.workspaceId);
  } catch (err: any) {
    console.error("[uptime] failed to list nodes:", err.message);
  }
  
  const scanPromises = nodes.map(async (node) => {
    try {
      const stdout = await execSsh(node, `docker ps --filter network=omnigrid-net --format '{{json .}}'`);
      const nodeContainers = parseDockerOutput(stdout, node.name);
      allContainers.push(...nodeContainers);
    } catch (err: any) {
      console.error(`[uptime] docker discover on node ${node.name} failed (ignoring):`, err.message);
    }
  });
  
  await Promise.allSettled(scanPromises);

  return NextResponse.json({ containers: allContainers });
}

function parseDockerOutput(stdout: string, sourceName: string) {
  return stdout
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
          source: sourceName,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
