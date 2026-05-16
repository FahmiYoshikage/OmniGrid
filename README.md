# OmniGrid

> Single pane of glass for a Tailscale-native homelab. Web SSH, topology graph, reverse-proxy manager, fleet control, uptime, runbooks — one self-hosted container.

**Status:** in active build. Milestone 1 (data + crypto foundation) ✅ complete.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui |
| Realtime | socket.io + xterm.js |
| Topology | @xyflow/react (React Flow) |
| Backend | Node.js (Next route handlers + custom server later) |
| SSH | `ssh2` + Tailscale SSH fallback |
| Storage | SQLite (`better-sqlite3`, WAL mode) |
| Crypto | AES-256-GCM credential vault |
| Containerisation | Single Docker image |

---

## Performance principles

OmniGrid is designed to feel instant on a Raspberry Pi-class host:

- **`better-sqlite3` + WAL**: synchronous, in-process, no IPC. PRAGMAs tuned (`cache_size=64MiB`, `mmap_size=256MiB`, `synchronous=NORMAL`).
- **Singleton DB handle** (HMR-safe via `globalThis`) and **prepared-statement cache** — no re-parsing SQL per request.
- **Lazy crypto key derivation**, cached after first use.
- **Zod-validated env at boot** — fail fast, zero runtime guesswork.
- **Snapshot caches** for slow upstreams (NPM, Tailscale API) so the UI never blocks on the network.
- **Append-only audit + uptime tables** with covering indexes for time-range queries.

---

## Quick start

### 1. Generate a master key

```bash
npm run keygen
```

Copy the 64-char hex output.

### 2. Configure env

```bash
cp .env.example .env.local
# paste the master key into OMNIGRID_MASTER_KEY=
```

### 3. Initialise the database

```bash
npm run db:migrate
```

### 4. (Optional) sanity check

```bash
npm run db:smoke
```

Verifies crypto roundtrip + repo writes/reads.

### 5. Dev server

```bash
npm run dev
```

→ http://localhost:3000

---

## Tailscale data and SSH setup

The topology/dashboard will show **mock data** until both Tailscale API env vars are configured:

```bash
TAILSCALE_API_KEY=tskey-api-...
TAILSCALE_TAILNET=your-tailnet.ts.net
```

Generate the API key from the Tailscale admin console. The key only needs permission to read devices for topology/dashboard views.

Important distinctions:

- **Tailscale API login** is used to list real tailnet devices.
- **The machine running OmniGrid must also be connected to Tailscale** if you want web SSH to reach `100.x.y.z` tailnet IPs.
- **SSH still uses normal SSH authentication** unless the target's Tailscale SSH policy allows the OmniGrid host/user. If terminal connect fails, verify from the same machine:

```bash
tailscale status
ssh user@100.x.y.z
```

If the CLI SSH command fails on the OmniGrid host, the web terminal will fail too. For `tailscale` SSH mode OmniGrid tries the local SSH agent first, then default keys under `~/.ssh/`.

---

## Project layout

```
src/
├── app/                      # Next.js App Router (UI + route handlers)
├── components/ui/            # shadcn/ui primitives
└── lib/
    ├── env.ts                # Zod-validated env loader
    ├── crypto/               # AES-256-GCM vault
    ├── db/
    │   ├── client.ts         # SQLite singleton + PRAGMAs + stmt cache
    │   ├── schema.sql        # Baseline schema (v1)
    │   ├── migrate.ts        # Forward-only migration runner
    │   ├── migrations/       # NNN_name.sql files
    │   └── repos/            # Typed data accessors
    ├── ssh/                  # (M3) ssh2 + Tailscale SSH bridge
    ├── tailscale/            # (M2) Tailscale API client
    ├── npm/                  # (M4) Nginx Proxy Manager client
    ├── docker/               # (M4) dockerode wrappers
    ├── uptime/               # (M5) ping worker
    ├── runbooks/             # (M6) fan-out executor
    ├── wol/                  # (M7) Wake-on-LAN
    └── audit/                # (M8) session metadata logging
server/                       # (M3) custom server entry
data/                         # SQLite db + WAL files (gitignored)
scripts/                      # CLI utilities
```

---

## Roadmap

| # | Milestone | State |
|---|---|---|
| 1 | Crypto vault + SQLite foundation | ✅ done |
| 2 | Tailscale API client + topology page | ✅ done |
| 3 | Custom server + socket.io + ssh2 PTY | ✅ done |
| 4 | xterm.js tabbed terminal UI | ✅ done |
| 5 | Audit logging middleware | ⏳ |
| 6 | NPM proxy manager integration | ⏳ |
| 7 | Docker fleet control (dockerode) | ⏳ |
| 8 | Uptime monitor + webhook alerting | ⏳ |
| 9 | Runbooks fan-out execution | ⏳ |
| 10 | Wake-on-LAN trigger | ⏳ |
| 11 | Dockerfile + Tailscale sidecar | ⏳ |

---

## Security model

- **Tailscale-first trust**: OmniGrid is intended to bind to the tailnet only. Public exposure is *not* a supported deployment.
- **Auth via Tailscale `whois`** (planned): incoming requests are identified by the local Tailscale daemon — zero passwords stored.
- **All SSH handshakes happen on the backend**. Private keys never enter the frontend bundle and live encrypted at rest (AES-256-GCM).
- **`OMNIGRID_MASTER_KEY` is the root of trust**. Lose it and every encrypted credential is unreadable. Back it up out-of-band.
- **Audit log** records every SSH session and runbook execution with the verified Tailscale identity.

---

## License

TBD (private homelab project for now).
