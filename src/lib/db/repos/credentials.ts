import { randomUUID } from "node:crypto";
import { prep } from "@/lib/db/client";
import { encrypt, decrypt } from "@/lib/crypto";

export type CredentialKind = "ssh_key" | "password";

interface CredentialRow {
  id: string;
  workspace_id: string | null;
  label: string;
  kind: CredentialKind;
  secret_enc: string;
  passphrase_enc: string | null;
  created_at: number;
  updated_at: number;
}

/** Public-facing shape: never includes secret material. */
export interface CredentialPublic {
  id: string;
  label: string;
  kind: CredentialKind;
  has_passphrase: boolean;
  created_at: number;
  updated_at: number;
}

function toPublic(r: CredentialRow): CredentialPublic {
  return {
    id: r.id,
    label: r.label,
    kind: r.kind,
    has_passphrase: r.passphrase_enc !== null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const credentialsRepo = {
  list(workspaceId?: string): CredentialPublic[] {
    const rows = (workspaceId
      ? prep<[string]>("SELECT * FROM credentials WHERE workspace_id = ? ORDER BY label").all(workspaceId)
      : prep<[]>("SELECT * FROM credentials ORDER BY label").all()) as CredentialRow[];
    return rows.map(toPublic);
  },

  get(id: string, workspaceId?: string): CredentialPublic | undefined {
    const row = (workspaceId
      ? prep<[string, string]>("SELECT * FROM credentials WHERE id = ? AND workspace_id = ?").get(id, workspaceId)
      : prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id)) as
      | CredentialRow
      | undefined;
    return row ? toPublic(row) : undefined;
  },

  create(input: {
    label: string;
    kind: CredentialKind;
    secret: string;
    passphrase?: string;
  }, workspaceId?: string): CredentialPublic {
    const id = randomUUID();
    const now = Date.now();
    prep<[string, string | null, string, CredentialKind, string, string | null, number, number]>(
      `INSERT INTO credentials (id, workspace_id, label, kind, secret_enc, passphrase_enc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      workspaceId ?? null,
      input.label,
      input.kind,
      encrypt(input.secret),
      input.passphrase ? encrypt(input.passphrase) : null,
      now,
      now,
    );
    return toPublic(
      workspaceId
        ? (prep<[string, string]>("SELECT * FROM credentials WHERE id = ? AND workspace_id = ?").get(id, workspaceId) as CredentialRow)
        : (prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id) as CredentialRow),
    );
  },

  update(id: string, input: {
    label: string;
    kind: CredentialKind;
    secret?: string;
    passphrase?: string | null;
  }, workspaceId?: string): CredentialPublic | undefined {
    const existing = (workspaceId
      ? prep<[string, string]>("SELECT * FROM credentials WHERE id = ? AND workspace_id = ?").get(id, workspaceId)
      : prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id)) as
      | CredentialRow
      | undefined;
    if (!existing) return undefined;
    const now = Date.now();
    prep<[string, CredentialKind, string, string | null, number, string]>(
      `UPDATE credentials SET
        label = ?, kind = ?, secret_enc = ?, passphrase_enc = ?, updated_at = ?
      WHERE id = ?${workspaceId ? " AND workspace_id = ?" : ""}`,
    ).run(
      input.label,
      input.kind,
      input.secret ? encrypt(input.secret) : existing.secret_enc,
      input.passphrase === undefined
        ? existing.passphrase_enc
        : input.passphrase
          ? encrypt(input.passphrase)
          : null,
      now,
      id,
    );
    return this.get(id, workspaceId);
  },

  /** Server-only: returns plaintext secret. NEVER expose this over HTTP. */
  reveal(id: string, workspaceId?: string): { secret: string; passphrase: string | null } | null {
    const row = (workspaceId
      ? prep<[string, string]>("SELECT * FROM credentials WHERE id = ? AND workspace_id = ?").get(id, workspaceId)
      : prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id)) as
      | CredentialRow
      | undefined;
    if (!row) return null;
    return {
      secret: decrypt(row.secret_enc),
      passphrase: row.passphrase_enc ? decrypt(row.passphrase_enc) : null,
    };
  },

  delete(id: string, workspaceId?: string): void {
    if (workspaceId) {
      prep<[string, string]>("DELETE FROM credentials WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
      return;
    }
    prep<[string]>("DELETE FROM credentials WHERE id = ?").run(id);
  },
};
