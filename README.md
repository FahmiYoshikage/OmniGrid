# OmniGrid

> Zero Trust server operations platform for homelabs, private fleets, and self-hosted infrastructure.

OmniGrid gives you a secure control plane to manage servers, SSH access, topology, tunnels, identity, and workspace-scoped integrations from one place. It is built for operators who want a modern web interface without giving up Zero Trust principles.

## What OmniGrid is for

OmniGrid is designed for teams and operators who need to:

- manage private servers without exposing inbound ports
- centralize SSH access and infrastructure visibility
- publish internal apps through Cloudflare Tunnel
- keep secrets encrypted and scoped per workspace
- support multiple login methods on one account

The current platform already supports:

- Tailscale-aware topology and device visibility
- web SSH terminal with multi-tab sessions
- credential vault with AES-256-GCM encryption at rest
- Cloudflare Tunnel monitoring and published hostname management
- multi-login account linking with GitHub, Google, and email magic links
- SQLite-backed sessions, audit data, and workspace-scoped settings

## Core capabilities

### Zero Trust access plane

- Tailscale-aware internal access
- Cloudflare Zero Trust / Tunnel visibility
- no need to publish OmniGrid through a public reverse proxy
- workspace-scoped integration secrets

### Server management workflow

- node inventory and SSH profiles
- browser terminal for multiple hosts
- topology preview for connected infrastructure
- recent audit visibility for operator activity

### Identity and account linking

- sign in with GitHub
- sign in with Google
- sign in with one-time email magic links delivered through Gmail SMTP
- link one, two, or all three methods to the same OmniGrid account

## Platform architecture

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 App Router · React 19 · TailwindCSS v4 · shadcn/ui primitives |
| Backend | Node.js custom server + Next.js route handlers |
| Realtime | Socket.IO + xterm.js |
| SSH | `ssh2` with local agent / key fallback |
| Storage | SQLite via `better-sqlite3` |
| Crypto | AES-256-GCM secret vault |
| Auth | GitHub OAuth · Google OAuth · Gmail-delivered magic links |
| Tunnel / Edge | Cloudflare Zero Trust API + Cloudflare Tunnel |

## Security posture

- all SSH handshakes happen on the backend
- credentials never need to enter the frontend bundle
- secrets are encrypted at rest with `OMNIGRID_MASTER_KEY`
- sessions are stored server-side in SQLite
- login methods can be linked to one OmniGrid account without duplicating workspaces
- Cloudflare and Tailscale secrets are stored per workspace, not as globally exposed UI state

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Generate a platform master key

```bash
npm run keygen
```

Copy the generated 64-character hex string into `OMNIGRID_MASTER_KEY`.

### 3. Create the local environment file

```bash
cp .env.example .env.local
```

Minimum required values:

```bash
OMNIGRID_MASTER_KEY=
OMNIGRID_PUBLIC_URL=http://localhost:3000
```

### 4. Configure at least one login method

You can enable any combination of the following:

- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `GMAIL_SMTP_USER` + `GMAIL_SMTP_APP_PASSWORD`

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Start OmniGrid

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Authentication setup

### GitHub OAuth

Create a GitHub OAuth app and set the callback URL to:

```text
${OMNIGRID_PUBLIC_URL}/api/auth/github/callback
```

### Google OAuth

Create a Google OAuth client and set the callback URL to:

```text
${OMNIGRID_PUBLIC_URL}/api/auth/google/callback
```

### Gmail magic-link login

For passwordless email login:

- create or choose a Gmail account for sending auth emails
- enable 2-step verification
- create a Gmail App Password
- set `GMAIL_SMTP_USER` and `GMAIL_SMTP_APP_PASSWORD`
- optionally set `AUTH_EMAIL_FROM`

OmniGrid will send one-time login or account-linking links to the user inbox. No password is stored in OmniGrid.

## Workspace-scoped integrations

Integrations are configured in the OmniGrid Settings UI and stored per workspace.

### Tailscale

Use the workspace Tailscale API key and tailnet to:

- populate topology data
- preview tailnet devices on the dashboard
- support Tailscale-oriented operations

### Cloudflare Zero Trust

Use workspace Cloudflare credentials to:

- inspect remote-managed tunnels
- view published hostnames
- view Cloudflare Access applications
- inspect visible zones and DNS CNAME records
- publish new hostnames directly from OmniGrid

Recommended Cloudflare API token scopes:

- `Cloudflare Tunnel:Read/Edit`
- `Access: Apps and Policies Read`
- `Zone:Read`
- `DNS:Read/Edit`

## Dashboard overview

The Overview page gives a compact operations snapshot for:

- Tailscale device health
- managed nodes stored in OmniGrid
- recent audit activity
- Cloudflare tunnel and published hostname visibility

This makes OmniGrid useful as a daily operator cockpit, not just a configuration screen.

## Docker and deployment

This repository includes a production-oriented Dockerfile and `docker-compose.yml`.

Typical deployment model:

- run OmniGrid behind private networking
- expose it through Cloudflare Tunnel or your preferred Zero Trust ingress
- keep `OMNIGRID_PUBLIC_URL` aligned with the real public origin

For Cloudflare Tunnel deployments, OmniGrid can now help you inspect and manage published hostname mappings directly from the UI.

## Local development notes

- the custom server entrypoint lives in `server/index.ts`
- `npm run dev` starts the custom server with Next.js and Socket.IO together
- `npm run build` validates the production application build
- `npm run db:smoke` verifies crypto and DB behavior

## Project layout

```text
src/
├── app/                      # App Router pages and route handlers
├── components/               # Shared UI and layout components
└── lib/
    ├── auth/                 # Session, identity, OAuth, email login
    ├── cloudflare/           # Cloudflare API client and shared types
    ├── crypto/               # AES-256-GCM helpers
    ├── db/                   # SQLite client, schema, migrations, repos
    ├── ssh/                  # SSH connection and diagnostics logic
    └── tailscale/            # Tailscale API client
server/                       # Custom Node.js server entrypoint
data/                         # SQLite DB files
scripts/                      # Utility scripts
```

## Operational principles

- fail fast on invalid environment config
- prefer encrypted secret storage over long-lived plaintext env sprawl
- keep identity flexible while preserving one workspace/account model
- expose internal services through Zero Trust ingress instead of direct public ports
- make operators productive from one interface without losing auditability

## Current status

OmniGrid is already usable as a secure server management surface for:

- homelab fleets
- private VPS estates
- internal admin planes
- Zero Trust-first self-hosted environments

The platform is still evolving, but the foundation is now strong enough to be treated as a proper service rather than a prototype.

## License

Private project for now.
