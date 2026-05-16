import { randomUUID } from "node:crypto";
import { prep } from "@/lib/db/client";

export type SshMode = "tailscale" | "key" | "password";

export interface NodeRow {
  id: string;
  name: string;
  hostname: string;
  tailscale_id: string | null;
  os: string | null;
  tags: string | null;
  ssh_user: string | null;
  ssh_port: number;
  ssh_mode: SshMode;
  credential_id: string | null;
  mac_address: string | null;
  wol_broadcast: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface NodeInput {
  name: string;
  hostname: string;
  tailscale_id?: string | null;
  os?: string | null;
  tags?: string[];
  ssh_user?: string | null;
  ssh_port?: number;
  ssh_mode?: SshMode;
  credential_id?: string | null;
  mac_address?: string | null;
  wol_broadcast?: string | null;
  notes?: string | null;
}

export const nodesRepo = {
  list(): NodeRow[] {
    return prep<[]>("SELECT * FROM nodes ORDER BY name").all() as NodeRow[];
  },

  get(id: string): NodeRow | undefined {
    return prep<[string]>("SELECT * FROM nodes WHERE id = ?").get(id) as
      | NodeRow
      | undefined;
  },

  create(input: NodeInput): NodeRow {
    const id = randomUUID();
    const now = Date.now();
    prep<[
      string, string, string, string | null, string | null, string | null,
      string | null, number, SshMode, string | null, string | null,
      string | null, string | null, number, number,
    ]>(
      `INSERT INTO nodes (
        id, name, hostname, tailscale_id, os, tags,
        ssh_user, ssh_port, ssh_mode, credential_id, mac_address,
        wol_broadcast, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.hostname,
      input.tailscale_id ?? null,
      input.os ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.ssh_user ?? null,
      input.ssh_port ?? 22,
      input.ssh_mode ?? "tailscale",
      input.credential_id ?? null,
      input.mac_address ?? null,
      input.wol_broadcast ?? null,
      input.notes ?? null,
      now,
      now,
    );
    return this.get(id)!;
  },

  update(id: string, input: NodeInput): NodeRow | undefined {
    const now = Date.now();
    prep<[
      string, string, string | null, string | null, string | null,
      string | null, number, SshMode, string | null, string | null,
      string | null, string | null, number, string,
    ]>(
      `UPDATE nodes SET
        name = ?, hostname = ?, tailscale_id = ?, os = ?, tags = ?,
        ssh_user = ?, ssh_port = ?, ssh_mode = ?, credential_id = ?,
        mac_address = ?, wol_broadcast = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    ).run(
      input.name,
      input.hostname,
      input.tailscale_id ?? null,
      input.os ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.ssh_user ?? null,
      input.ssh_port ?? 22,
      input.ssh_mode ?? "tailscale",
      input.credential_id ?? null,
      input.mac_address ?? null,
      input.wol_broadcast ?? null,
      input.notes ?? null,
      now,
      id,
    );
    return this.get(id);
  },

  delete(id: string): void {
    prep<[string]>("DELETE FROM nodes WHERE id = ?").run(id);
  },
};
