# OmniGrid Implementation Roadmap
## Phase-1: Security Foundation & Test Harness

**Goal:** Establish security controls and robust testing framework before building operational features.

### 1.1 Dependency Emergency Fixes (1-2 days)
- [x] Upgrade Next.js 16.2.6 → 16.3.x (app router advisories)
- [x] Upgrade socket.io transitive dependencies (resolve ws vulnerabilities)
- [x] Upgrade nodemailer 6.9.16 → 9.x (SMTP advisories)
- [x] Remove unused concurrently (critical via shell-quote)
- [x] Move shadcn from deps to devDependencies
- [x] Clean npm audit production dependencies (0 vulnerabilities)
- [x] Restore working local npm binary shims
- [x] Clear ESLint warnings (zero-tolerance CI)

**Risk:** API breaking changes in upgrades, SSH2 native build failures
**Tests:** Production build, OAuth, Socket.IO, SSH PTY, SMTP magic links
**Files:** package.json, package-lock.json, next.config.ts, .github/workflows/ci.yml

### 1.1a Request, Network, and Lifecycle Hardening
- [x] Enforce same-origin protection, JSON content type/size caps, and endpoint rate limits
- [x] Require matching OAuth state cookie and database record
- [x] Validate uptime HTTP/TCP/ping targets and block private, local, metadata, and rebinding targets
- [x] Remove shell interpolation from ping/TLS checks and bound subprocess output
- [x] Limit Socket.IO connection, terminal-open, runbook-start, and terminal-input rates
- [x] Add liveness/readiness endpoints, Compose readiness healthcheck, and idempotent graceful shutdown
- [x] Add request-security and uptime-target tests

### 1.2 Generic SSH Execution Pattern (2-3 days)
- [ ] Extract reusable exec module from uptime/discover/route.ts
- [ ] Add timeout, abort signals, output caps (50KB default)
- [ ] Fix duplicate auth/connection pattern across codebase
- [ ] Implement workspace-scoped node resolution
- [ ] Add proper error taxonomy (connect, auth, exec, timeout)

**Acceptance:** Centralized SSH with cancellation + workspace isolation
**Files:** ssh/exec.ts, ssh/manager.ts refactor, updtime/discover refactor

### 1.3 Fake SSH Server & Integration Tests (3-4 days)
- [ ] Create ssh2-based fake server (password/key auth, PTY, exec)
- [ ] Tests for SSH manager: timeout, auth failure, disconnect
- [ ] Socket.IO integration tests: auth, origin, protocol validation
- [ ] Cross-workspace authorization rejection tests
- [ ] Browser E2E setup with Playwright + deterministic auth

**Risk:** Mock complexity vs real SSH edge cases
**Files:** tests/, integration/, e2e/

---

## Phase-2: RBAC & Workspace Governance (4-5 days)

**Goal:** Multi-user access control with proper isolation and invitation system.

### 2.1 Database Schema (2 days)
- [x] Migration 009: workspace_members, invitations
- [x] Roles: owner/admin/operator/viewer
- [ ] Active workspace selection in session
- [ ] Fix global unique constraints for nodes/runbooks
- [ ] Foreign key integrity for workspace references

**Files:** migrations/009_rbac.sql, schema fixes

### 2.2 Authorization Layer (2 days)
- [x] Centralized requireWorkspacePermission function
- [x] Socket.IO role checks (handshake + events)
- [x] API middleware for core workspace-scoped endpoints
- [ ] Resource ownership validation (credential↔node, etc.)
- [ ] Role downgrade/removal immediate effect

### 2.3 Membership UI & Invitations (1 day)
- [x] Settings: Workspace Members panel
- [x] Invitation flow with role assignment and acceptance API
- [ ] Workspace switcher component
- [ ] Permission matrix in sidebar/help

**Risk:** Breaking existing user sessions, migration complexity
**API Backlog:** Members CRUD, invitations, workspace switching
**Tests:** Cross-workspace access denial, role downgrade enforcement

---

## Phase-3: Durable Jobs & Background Processing (3-4 days)

**Goal:** Persistent job queue replacing in-memory process maps.

### 3.1 Queue Schema & Repository (1.5 days)
- [ ] Migration 010: operation_jobs, operation_events  
- [ ] Job types: runbook.execute, container.action, node.probe
- [ ] Atomic lease mechanism: queued → leased → running
- [ ] Restart recovery for lost leases
- [ ] Event storage with sequence numbers

### 3.2 Worker Implementation (1.5 days)
- [ ] Worker registry and bounded concurrency
- [ ] Job handlers registry pattern
- [ ] Graceful worker shutdown (drain/cancel policies)
- [ ] Job cancellation: cancel_requested state
- [ ] Output buffering and event batch writes

### 3.3 Jobs API & Socket Namespace (1 day)
- [ ] `/api/jobs` endpoints (CRUD, subscription)
- [ ] `/operations` socket namespace (status, events)
- [ ] Reconnect replay: fetch missed events from API
- [ ] Job room authorization per workspace

**Risk:** SQLite contention, duplicate execution bugs, job serialization
**Files:** jobs/types.ts, jobs/worker.ts, socket.ts update
**Success:** Jobs survive browser disconnect and server restart

---

## Phase-4: SSH Host-Key Verification (2-3 days)

**Goal:** Prevent MITM attacks through fingerprint approval workflow.

### 4.1 Database Design (0.5 days)
- [ ] Migration 011: node_host_keys table
- [ ] fields: workspace_id, node_id, algorithm, fingerprint_sha256
- [ ] status: pending/trusted/revoked
- [ ] timestamps and approval metadata

**Files:** migrations/011_node_host_keys.sql

### 4.2 Host Key Management (1 day)
- [ ] Centralized ConnectConfig builder with hostVerifier
- [ ] First connection: display fingerprint for manual approval
- [ ] Subsequent connections: verify against trusted fingerprint
- [ ] Mismatch handling: block connection, audit event
- [ ] UI: Trust/Replace/Revoke fingerprint actions

### 4.3 API & Integration (1 day)
- [ ] Protected endpoints: trust/replace/revoke by admin only
- [ ] Error taxonomy for SSH connection failures
- [ ] Integration with job queue for host-key approval
- [ ] Graceful fallback for existing nodes without trusted keys

**Security:** Host-key verification before ANY SSH operations
**Files:** ssh/connect.ts, nodes API, approval UI
**Tests:** unknown/trusted/mismatch/revoked fingerpint scenarios

---

## Phase-5: Runbook Safety, Revisions & History (3-4 days)

**Goal:** Reproducible executions with safety controls and full history.

### 5.1 Immutable Revisions (1 day)
- [ ] Migration 012: runbook_revisions, runbook_executions tables
- [ ] Fix workspace-wide name uniqueness 
- [ ] Revision creation on every create/update
- [ ] Current revision pointer in runbooks table

**Files:** migrations/012_runbook_revisions.sql, runbooks repos update

### 5.2 Job Migration (1.5 days)
- [ ] Move single-node execution to jobs system
- [ ] Persist execution records with immutable revision reference
- [ ] Output events via jobs event system
- [ ] Persisted history survives disconnect/restart

### 5.3 Safety Controls (1 day)
- [ ] Risk level: low/medium/high/critical with confirmations
- [ ] Server-enforced timeout (default 5 minutes, max 30)
- [ ] Output size limits (200KB default, 5MB max)
- [ ] Concurrency controls: per-runbook and global limits
- [ ] Shell allowlist validation (bash/python/zsh only)

### 5.4 UI Refactor & History (0.5 days)
- [ ] Split massive runbooks-client.tsx into components
- [ ] Execution history page per runbook
- [ ] Risk confirmation dialog for high-risk runs
- [ ] Show revision metadata in execution history

**Risk:** Breaking existing socket-only execution, large codebase refactor
**Files:** runbook UI split, jobs handler for runbook execution
**Success:** Reproducible history, safety controls, persistent executions

---

## Phase-6: Notification System (2-3 days)

**Goal:** Durable notification delivery with retry and provider integrations.

### 6.1 Channel Configuration (0.5 days)
- [ ] Migration 013: notification_channels/subscriptions/deliveries
- [ ] Settings UI: Webhook/Discord/Telegram/Email channels
- [ ] Telegram bot setup flow (BotFather token + Chat ID discovery)
- [ ] Test notification endpoints
- [ ] Channel confidentiality (secrets never returned by GET)

### 6.2 Durable Delivery Engine (1.5 days)  
- [ ] Outbox pattern: emit deliverable on incident transitions
- [ ] Retry with exponential backoff + jitter
- [ ] Success/failure audit trail per provider
- [ ] Bounded retry limits, no permanent retry on 4xx
- [ ] Provider-specific retry strategies (Telegram vs webhook vs email)

### 6.3 Provider Integration (1 day)
- [ ] Generic webhook with HMAC signatures
- [ ] Discord webhook payloads with rich formatting
- [ ] Telegram Bot API integration with Markdown/HTML formatting
- [ ] Telegram inline buttons for acknowledge, check now, and view details
- [ ] Email via existing SMTP configuration
- [ ] Flapping prevention: threshold/cooldown policies
- [ ] Message templates per provider

**Risk:** Secret leakage in logs, unreliable provider internet access, Telegram bot token exposure
**Files:** notifications/*, settings notification UI, incident transitions, Telegram provider
**Success:** Multi-provider uptime alerts delivered reliably with retry resilience

### Telegram Integration Features (+0.5 days effort)
- [ ] Rich alert formatting for uptime, node health, and runbook failures
- [ ] Optional image attachments for topology graphs and health charts
- [ ] Group chat support for workspace-wide subscriptions
- [ ] Chat ID discovery with automatic detection and manual fallback
- [ ] Telegram-specific message length splitting and Markdown escaping

---

## Phase-7: Observability & Logging (2-3 days)

**Goal:** Structured logging, metrics, correlation for operations troubleshooting.

### 7.1 Structured Logging (1 day)
- [ ] Pine-compatible JSON logger (one object per line)
- [ ] Request correlation IDs end-to-end
- [ ] Redaction policies for secrets/webhooks
- [ ] HTTP server request/response logging
- [ ] Shutdown logging for lifecycle visibility

### 7.2 Metrics & Health (1 day)
- [ ] Metrics endpoint (internal, protected)
- [ ] HTTP request/latency, SSH sessions, uptime checks
- [ ] Liveness/readiness endpoints (separate from session check)
- [ ] Cardinality controls (avoid unbounded labels)

### 7.3 Tracing (1 day)
- [ ] OpenTelemetry integration point in instrumentation.ts
- [ ] Trace correlation for SSH, jobs, external APIs
- [ ] OTLP exporter configuration
- [ ] Span attribute policies (no secrets)

**Risk:** Performance overhead, log volume explosion, collector dependencies
**Files:** logging/, metrics/, tracing/ integration points
**Success:** Operational visibility without security exposure

---

## Phase-8: Container Operations & Node Health (3-4 days)

**Goal:** Safe container management and comprehensive node health reporting.

### 8.1 Container Discovery Job (1 day)
- [ ] Replace direct SSH scan with jobs system
- [ ] Persist container snapshots with node + container IDs
- [ ] Discovery errors tracked per node
- [ ] Rate limiting and concurrency controls

### 8.2 Container Lifecycle (2 days)
- [ ] API: start/stop/restart/enum actions only
- [ ] Enforce omnigrid-net membership verification
- [ ] Shell injection prevention (fixed commands only)
- [ ] Bounded log streaming with tail/duration limits
- [ ] Confirmation for destructive actions

### 8.3 Node Health (1 day)
- [ ] Migration 014: node_health, node_health_history
- [ ] Health probes: TCP/SSH/Docker/network reachability
- [ ] UI: health badges/colors in nodes/containers pages
- [ ] Bulk runbook target health warnings

**Files:** containers/*, node health jobs, UI health indicators
**Success:** Safe container ops + actionable node health data

---

## Phase-9: Cloudflare Desired State & Drift (3-4 days)

**Goal:** Controlled publish/edit/remove with drift detection and safety guarantees.

### 9.1 Desired State Schema (1 day)
- [ ] Migration 015: cloudflare_publications
- [ ] Track managed ingress vs DNS vs unmanaged
- [ ] Ownership and revision history markers
- [ ] Drift state machine: in_sync/missing/mismatch/unknown

**Files:** migrations/015_cloudflare_publications.sql

### 9.2 Controlled Mutations (2 days)
- [ ] Publish/edit: optimistic concurrency with revision checks
- [ ] Preserve unrelated ingress rules and ordering
- [ ] Partial-failure handling (ingress success, DNS failure)
- [ ] Safe unpublish (managed vs unmanaged DNS treatment)

### 9.3 Drift Detection (1 day)
- [ ] Observation jobs: compare desired vs actual state
- [ ] Drift reporting UI with remediation options
- [ ] Reconciliation jobs (manual approval by default)
- [ ] API permission boundaries (no surprise auto-fixes)

**Risk:** Cloudflare API rate limits, pagination complexity, concurrent edits
**Files:** Cloudflare client refactor, publications API, drift UI
**Success:** Safe Cloudflare management with clear ownership

---

## Phase-10: Backup & Recovery (2-3 days)

**Goal:** Platform backup/restore with master-key escrow guidance.

### 10.1 Backup Service (1 day)
- [ ] Online SQLite snapshot with integrity validation
- [ ] Manifest creation: schema version, timestamp, key fingerprint
- [ ] Retention policies and secure permissions
- [ ] Integration with external backup systems (S3, etc.)

### 10.2 Restore Workflow (1 day)
- [ ] Offline restore procedure with validation
- [ ] Master-key verification before production cutover
- [ ] Rollback procedures and testing
- [ ] Operator documentation for key escrow/recovery

### 10.3 Master Key Rotation Design (1 day)
- [ ] Keyring design: key_id + envelope versioning
- [ ] Transactional re-encryption job
- [ ] Progress state and failure recovery
- [ ] Audit rotation events without exposing keys

**Critical:** Platform-level backup for all workspaces (not tenant export)
**Files:** backup/, ops documentation, rotation design
**Success:** Disaster recovery capability with proper security posture

---

## Cross-Cutting Implementation Notes

### File Patterns
- Database: migrations/0XX_descriptive_name.sql
- API: src/app/api/resource/[id]*/route.ts
- Socket: src/lib/socket/namespace.ts
- Jobs: src/lib/jobs/handler.ts
- UI: src/app/view/page.tsx + view-client.tsx
- Tests: __tests__/ feature.spec.ts for E2E, .test.ts for unit

### API Contracts to Lock
- Job IDs are UUID4, workspace-scoped throughout
- All mutations require workspace membership and permission
- Socket events include job/session IDs and correlation context
- Host keys always referenced by SHA256 fingerprint
- Container identity requires node_id + container_id tuple
- Cloudflare publications use normalized hostname + revision

### Testing Gates
- 90%+ unit test coverage for critical modules
- Integration tests for SSH manager, queue, authorization
- E2E for core workflows: runbook, terminal, uptime, notifications
- Performance tests: 100 concurrent SSH sessions, 1000 jobs
- Security tests: cross-workspace access, input injection, payload validation

### Operational Readiness
- Health readiness replaces session endpoint
- Graceful shutdown sequence includes job drain
- Log rotation and retention policies enforced
- Backup/restore tested quarterly
- Disaster recovery runbook maintained

### Risk Mitigation
- RBAC first: prevents security-sensitive APIs from immediate redesign
- Jobs before runbook history: durable foundation before data accumulation  
- Host-key verification before container operations: secure SSH channels first
- Observability before notification volume: reduce blind troubleshooting
- Container remote-only: avoids Docker socket security complexity

This phased approach ensures each layer builds on solid foundations without premature complexity, while maintaining backwards compatibility and operational safety throughout the rollout.
