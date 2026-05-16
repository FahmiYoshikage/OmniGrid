# OmniGrid Checkpoint

Tanggal: 2026-05-16

## Ringkasan Objective

OmniGrid dibangun sebagai homelab command center berbasis Next.js untuk mengelola node, visualisasi Tailscale topology, web SSH terminal, audit log, proxy manager, uptime, runbooks, Wake-on-LAN, dan fleet control.

Fokus pekerjaan sampai checkpoint ini:

- Bootstrap aplikasi Next.js 16 dengan custom server.
- Menyiapkan database SQLite, schema, repo, dan crypto vault.
- Integrasi Tailscale API client dengan cache dan mock fallback.
- Membuat topology visualizer.
- Membuat web SSH terminal via socket.io + ssh2 PTY.
- Memperbaiki auth SSH mode `tailscale` agar fallback ke SSH agent/default keys.
- Meningkatkan UX koneksi terminal Tailscale SSH.
- Merombak visual app agar tidak terasa template basic Next.js.
- Menambahkan kemampuan edit node.

## Aturan Project Penting

Project memakai Next.js versi baru yang memiliki breaking changes. Sebelum menulis kode Next.js, ikuti aturan di `AGENTS.md`:

- Baca dokumentasi relevan di `node_modules/next/dist/docs/`.
- Perhatikan deprecation notice.
- Jangan mengasumsikan API Next.js lama selalu berlaku.

## Stack Saat Ini

- Next.js 16 App Router
- React 19
- TailwindCSS v4
- shadcn/ui + Base UI primitives
- socket.io
- ssh2
- xterm.js
- @xyflow/react untuk topology
- better-sqlite3
- Zod
- AES-256-GCM vault crypto
- Node.js custom server

## Environment Variable Penting

- `OMNIGRID_MASTER_KEY`
- `OMNIGRID_DB_PATH`
- `TAILSCALE_API_KEY`
- `TAILSCALE_TAILNET`

## Fitur/Fondasi yang Sudah Selesai

### 1. Custom Server

File utama:

- `server/index.ts`
- `package.json`

Yang dilakukan:

- Membuat custom server HTTP + Next handler.
- Mengintegrasikan socket.io pada server yang sama.
- Script `dev` dan `start` diarahkan ke custom server.
- Socket.io berjalan di path `/socket.io`.

Status: selesai.

### 2. Database SQLite dan Repos

File utama:

- `src/lib/db/client.ts`
- `src/lib/db/schema.sql`
- `src/lib/db/migrate.ts`
- `src/lib/db/repos/nodes.ts`
- `src/lib/db/repos/credentials.ts`
- `src/lib/db/repos/audit.ts`

Yang dilakukan:

- Menyiapkan SQLite singleton dengan PRAGMA.
- Membuat schema untuk nodes, credentials, runbooks, audit, uptime, dan proxy cache.
- Membuat migration runner.
- Membuat repo typed untuk nodes, credentials, dan audit.
- Menambahkan `nodesRepo.update()` untuk edit node.

Status: selesai untuk fondasi awal.

### 3. Crypto Vault

File utama:

- `src/lib/crypto/index.ts`
- `src/lib/env.ts`

Yang dilakukan:

- Validasi env dengan Zod.
- Implement AES-256-GCM untuk encrypt/decrypt credential.
- Master key divalidasi sebagai 64 hex chars.

Status: selesai untuk fondasi awal.

### 4. Tailscale Client

File utama:

- `src/lib/tailscale/client.ts`
- `src/app/api/tailscale/devices/route.ts`

Yang dilakukan:

- Membuat Tailscale API client.
- TTL cache untuk snapshot device.
- Mock fallback saat env/API belum tersedia.
- Endpoint internal untuk devices.

Status: selesai untuk awal integrasi.

### 5. Topology Visualizer

File utama:

- `src/app/topology/page.tsx`
- `src/app/topology/topology-canvas.tsx`
- `src/app/topology/nodes/device-node.tsx`
- `src/app/topology/nodes/hub-node.tsx`

Yang dilakukan:

- Menggunakan React Flow.
- Membuat custom node untuk device dan hub.
- Layout radial lebih rapi.
- Online/offline dipisah dan diurutkan.
- Edge dibuat smoothstep.
- Node action diarahkan ke terminal/topology focus.
- Container topology disesuaikan dengan shell baru.

Status: selesai untuk pass visual awal, masih bisa dipoles lagi.

### 6. SSH Manager

File utama:

- `src/lib/ssh/manager.ts`

Yang dilakukan:

- Membuat lifecycle manager untuk ssh2 client + PTY shell.
- Session idle timeout 30 menit.
- Session sweeper untuk orphan session.
- Audit log saat open/close/error.
- Support resize terminal.
- Support close session.
- Fix mode `tailscale` agar auth mengikuti pola CLI SSH:
  - SSH agent jika tersedia.
  - Default private keys fallback dari `~/.ssh/id_ed25519`, `id_rsa`, dll.
- `methodLabel` dicatat di audit, tapi tidak dikirim ke `ssh2.connect`.

Status: selesai untuk M4 awal.

### 7. Socket.io SSH Namespace

File utama:

- `src/lib/ssh/socket.ts`

Namespace:

- `/ssh`

Protocol client ke server:

- `open` `{ nodeId, cols, rows }`
- `input` `{ sessionId, data }`
- `resize` `{ sessionId, cols, rows }`
- `close` `{ sessionId }`

Protocol server ke client:

- `data` `{ sessionId, chunk }`
- `status` `{ sessionId?, nodeId, code, label, detail?, at }`
- `exit` `{ sessionId, reason }`
- `error` `{ sessionId?, message, hint? }`

Yang dilakukan:

- Multiplex banyak terminal tabs dalam satu socket.
- Auto close semua session saat socket disconnect.
- Menambahkan status event untuk progress koneksi.
- Menambahkan error hint via `explainSshError()`.
- Memperbaiki closure session id agar event punya session id stabil.

Status: selesai.

### 8. SSH Status dan Error Hint

File utama:

- `src/lib/ssh/status.ts`

Status codes:

- `resolving-node`
- `auth-ready`
- `tcp-connecting`
- `ssh-ready`
- `pty-ready`
- `closed`

Yang dilakukan:

- Membuat typed status event.
- Membuat mapping error ke hint actionable.
- Contoh hint:
  - Auth failed: cek SSH agent/default key/authorized_keys.
  - Timeout: cek Tailscale connected, node online, TCP/22 reachable.
  - Connection refused: cek sshd di target.
  - Node not found: add ulang node dari Nodes page.

Status: selesai.

### 9. Terminal UI

File utama:

- `src/app/terminal/page.tsx`
- `src/app/terminal/terminal-workspace.tsx`
- `src/app/terminal/terminal-pane.tsx`

Yang dilakukan:

- Membuat halaman Terminal dengan xterm.js.
- Support multiple tabs.
- Tab membuka session via socket.io `/ssh`.
- Forward input keyboard ke backend.
- Forward resize ke backend.
- Menambahkan status badge pada tab:
  - Connecting: cyan pulse.
  - Connected: green glow.
  - Error: red.
  - Closed: gray.
- Menambahkan animated connection overlay:
  - Spinner + pulse.
  - Progress bar.
  - Elapsed timer.
  - Step timeline.
  - Error state + hint.
- Terminal juga menulis log status warna cyan di xterm.

Status: selesai untuk UX koneksi Tailscale SSH.

### 10. Nodes CRUD dan UI

File utama:

- `src/app/nodes/page.tsx`
- `src/app/api/nodes/route.ts`
- `src/app/api/nodes/[id]/route.ts`
- `src/lib/db/repos/nodes.ts`

Yang dilakukan:

- Membuat Nodes page dari table basic menjadi dashboard card grid.
- Menambahkan stat cards:
  - Managed nodes.
  - Tailscale SSH.
  - Unique tags.
- Setiap node card menampilkan:
  - Name.
  - Hostname/IP.
  - SSH mode.
  - SSH port.
  - OS.
  - SSH user.
  - Updated date.
  - Tags.
- Node actions:
  - Open SSH.
  - View topology.
  - Edit node.
  - Delete node.
- Menambahkan reusable `NodeDialog` untuk create/edit.
- Menambahkan `PUT /api/nodes/[id]`.
- Menambahkan `nodesRepo.update()`.
- Menghindari penggunaan `Button asChild` karena komponen Button di project ini tidak mendukung prop tersebut.

Status: selesai.

### 11. Global Visual Redesign

File utama:

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/app-shell.tsx`
- `src/app/page.tsx`
- `src/app/topology/page.tsx`
- `src/app/terminal/page.tsx`

Yang dilakukan:

- Mengaktifkan class `dark` di root HTML.
- Body dibuat `overflow-hidden` agar layout shell tidak double-scroll aneh.
- Mengganti warna root theme dari basic light ke dark premium.
- Menambahkan background radial/gradient ambience.
- AppShell dibuat glassmorphism:
  - Rounded sidebar.
  - Gradient brand logo.
  - Active navigation style.
  - Main content rounded glass container.
- PageHeader dibuat lebih premium dengan gradient subtle.
- Overview cards dipoles agar tidak template basic.
- Topology dan Terminal container disesuaikan agar tidak konflik `h-screen` dengan shell.

Status: selesai untuk pass visual awal.

## Bug yang Diperbaiki

- `npm run dev` sebelumnya tidak cocok untuk socket.io, lalu diarahkan ke custom server.
- `server-only` mengganggu CLI scripts, lalu dipisahkan/diatasi.
- `DialogTrigger asChild` tidak didukung, diganti controlled dialog.
- `Button asChild` tidak didukung, diganti Link styled langsung.
- `Select onValueChange` bisa `null`, sudah dicoerce ke string kosong.
- TooltipProvider memakai prop `delay`, bukan `delayDuration`.
- Topology default node terlalu basic, diganti custom nodes.
- SSH tailscale mode tidak bisa connect karena auth fallback belum sesuai CLI SSH, diperbaiki dengan agent/default keys.
- Terminal connecting state terlalu minim, diganti progress state machine + overlay.
- Nodes sebelumnya hanya bisa hapus, sekarang bisa edit.
- Tema inkonsisten putih/gelap, dipaksa konsisten dark premium.

## Validasi yang Sudah Dilakukan

### Build

Command:

```bash
npm run build
```

Status:

- Build sukses.
- TypeScript selesai tanpa error.
- Routes berhasil digenerate.

### Socket Smoke

Command:

```bash
node --import tsx scripts/socket-smoke.ts
```

Status:

- Socket `/ssh` connect sukses.
- Error path `node not found` mengembalikan hint yang benar.

### PUT Node API

Command test manual:

```bash
node -e "(async()=>{ /* fetch PUT /api/nodes/:id */ })()"
```

Hasil:

- `PUT /api/nodes/:id` return `200`.
- Node updated tanpa merusak data.

## File Penting yang Sudah Diedit/Dibuat

### Backend dan Infrastruktur

- `server/index.ts`
- `package.json`
- `src/lib/env.ts`
- `src/lib/crypto/index.ts`
- `src/lib/db/client.ts`
- `src/lib/db/schema.sql`
- `src/lib/db/migrate.ts`
- `src/lib/db/repos/nodes.ts`
- `src/lib/db/repos/credentials.ts`
- `src/lib/db/repos/audit.ts`
- `src/lib/tailscale/client.ts`

### API Routes

- `src/app/api/nodes/route.ts`
- `src/app/api/nodes/[id]/route.ts`
- `src/app/api/tailscale/devices/route.ts`

### SSH dan Terminal

- `src/lib/ssh/manager.ts`
- `src/lib/ssh/socket.ts`
- `src/lib/ssh/status.ts`
- `src/app/terminal/page.tsx`
- `src/app/terminal/terminal-workspace.tsx`
- `src/app/terminal/terminal-pane.tsx`

### UI dan Layout

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/app-shell.tsx`
- `src/app/page.tsx`
- `src/app/nodes/page.tsx`

### Topology

- `src/app/topology/page.tsx`
- `src/app/topology/topology-canvas.tsx`
- `src/app/topology/nodes/device-node.tsx`
- `src/app/topology/nodes/hub-node.tsx`

## Current State

Aplikasi saat ini memiliki:

- Shell dark premium yang konsisten.
- Overview page lebih polished.
- Nodes page dengan card UI dan edit support.
- Topology page dengan container yang lebih cocok untuk shell baru.
- Terminal page dengan multi-tab xterm dan UX koneksi Tailscale SSH lebih jelas.
- Backend SSH session manager dengan 30 menit idle timeout.
- Socket.io `/ssh` namespace aktif.
- Nodes API sudah support create, read, update, delete.

## Pending / Next Steps yang Disarankan

### High Priority

- Polish Topology visual lanjutan:
  - Better edge animation.
  - Better focus mode.
  - Better node grouping.
  - Better minimap/control styling.

- Polish Terminal visual lanjutan:
  - Terminal toolbar.
  - Better tab close UX.
  - Reconnect button.
  - Session metadata panel.

- Custom delete confirmation dialog:
  - Ganti browser `confirm()` dengan modal premium.

### Medium Priority

- Credentials UI:
  - CRUD SSH key/password.
  - Credential selection di node edit dialog.

- Audit Log UI:
  - Searchable audit viewer.
  - Filter by actor/action/node.

- README update:
  - Document current scripts.
  - Document env setup.
  - Document SSH modes.
  - Document custom server requirement.

### Future Milestones

- Reverse proxy manager.
- Uptime monitoring.
- Runbooks.
- Wake-on-LAN.
- Fleet control.
- Optional SSH command capture.

## Known Considerations

- Komponen `Button` project ini tidak mendukung `asChild`.
- Komponen `TooltipProvider` memakai prop `delay`.
- Project memakai Next.js 16 custom server; jangan kembali ke asumsi `next dev` basic jika butuh socket.io.
- Tailscale SSH mode bergantung pada SSH agent/default keys di mesin server OmniGrid.
- Credential vault sudah ada fondasi, tapi UI credential belum selesai.

## Status Akhir Checkpoint

Status: stabil setelah build.

Command validasi terakhir:

```bash
npm run build
```

Hasil: sukses.
