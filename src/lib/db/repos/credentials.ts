import { randomUUID } from "node:crypto";
import { prep } from "@/lib/db/client";
import { encrypt, decrypt } from "@/lib/crypto";

export type CredentialKind = "ssh_key" | "password";

interface CredentialRow {
  id: string;
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
  list(): CredentialPublic[] {
    const rows = prep<[]>("SELECT * FROM credentials ORDER BY label").all() as CredentialRow[];
    return rows.map(toPublic);
  },

  get(id: string): CredentialPublic | undefined {
    const row = prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id) as
      | CredentialRow
      | undefined;
    return row ? toPublic(row) : undefined;
  },

  create(input: {
    label: string;
    kind: CredentialKind;
    secret: string;
    passphrase?: string;
  }): CredentialPublic {
    const id = randomUUID();
    const now = Date.now();
    prep<[string, string, CredentialKind, string, string | null, number, number]>(
      `INSERT INTO credentials (id, label, kind, secret_enc, passphrase_enc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.label,
      input.kind,
      encrypt(input.secret),
      input.passphrase ? encrypt(input.passphrase) : null,
      now,
      now,
    );
    return toPublic(
      prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id) as CredentialRow,
    );
  },

  update(id: string, input: {
    label: string;
    kind: CredentialKind;
    secret?: string;
    passphrase?: string | null;
  }): CredentialPublic | undefined {
    const existing = prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id) as
      | CredentialRow
      | undefined;
    if (!existing) return undefined;
    const now = Date.now();
    prep<[string, CredentialKind, string, string | null, number, string]>(
      `UPDATE credentials SET
        label = ?, kind = ?, secret_enc = ?, passphrase_enc = ?, updated_at = ?
      WHERE id = ?`,
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
    return this.get(id);
  },

  /** Server-only: returns plaintext secret. NEVER expose this over HTTP. */
  reveal(id: string): { secret: string; passphrase: string | null } | null {
    const row = prep<[string]>("SELECT * FROM credentials WHERE id = ?").get(id) as
      | CredentialRow
      | undefined;
    if (!row) return null;
    return {
      secret: decrypt(row.secret_enc),
      passphrase: row.passphrase_enc ? decrypt(row.passphrase_enc) : null,
    };
  },

  delete(id: string): void {
    prep<[string]>("DELETE FROM credentials WHERE id = ?").run(id);
  },
};
