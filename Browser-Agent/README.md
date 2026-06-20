# Flow Browser Agent

Headless Chrome on a server (Hugging Face Space or Docker) that runs the **Flow Agent**
browser extension against [Google Flow](https://labs.google/fx/tools/flow) — so you can
drive **video (T2V / I2V / V2V)** and **image (T2I / I2I)** generation programmatically,
without keeping a browser open on your own machine.

The hard part of "Flow in the cloud" is staying logged in. HF Spaces have **no permanent
disk**, so a normal restart wipes the Google/Flow login. This project solves that by
snapshotting the Chrome profile (cookies / login state) into **Postgres (Neon)** and
restoring it on every boot.

**Live Space:** `https://flow1254-flow-browser-agent.hf.space`

---

## How it works

```
                 ┌──────────────────────── Docker container ────────────────────────┐
                 │                                                                    │
   browser  ───► │  monitor (Go) :3001  ──┬─ live Chrome view UI (/, /api/*)          │
   / API         │                        ├─ /gpt   → 127.0.0.1:9225  (chat backend)  │
                 │                        └─ /gemini → 127.0.0.1:8000  (gemini backend)│
                 │                                                                    │
                 │  Chrome (headless)  ── CDP :9222 ── loads /opt/Flow-extension      │
                 │      └─ open tab: labs.google/fx/tools/flow                        │
                 │                                                                    │
                 │  profilesync (Go)  ── backup/restore /home/chrome/data ◄──► Neon   │
                 └────────────────────────────────────────────────────────────────────┘
                                                            │
                                                   DATABASE_URL (Neon Postgres)
```

On startup, `start_hf.sh` orchestrates everything:

1. **Restore** the Chrome profile from Postgres (`profilesync restore`).
2. Clean junk/cache and wipe stale session/tab-restore state (avoids the "restore pages?" popup).
3. Start the **monitor** server (live view + API gateway) and the CDP proxy.
4. Enable a **periodic backup every 5 min** (`profilesync backup`).
5. Launch **headless Chrome** with the Flow extension, opening Google Flow.
6. On shutdown (SIGTERM) it backs up one last time, so the next boot restores a consistent login.

---

## Components

| Path | Lang | What it does |
|------|------|--------------|
| `Flow-extension/` | JS (MV3) | "Flow Agent" extension — automates Google Flow (T2V/V2V/I2V video, T2I/I2I images). Loaded into Chrome at launch. |
| `monitor/` | Go | Serves the live Chrome view UI on **:3001** and proxies the `/gpt` and `/gemini` API gateways. Also exposes `/api/screen`, `/api/input`, `/api/navigate`, `/api/tabs`, etc. |
| `profilesync/` | Go | Snapshots `/home/chrome/data` (cookies/logins) into a Postgres `bytea` blob and restores it. Cache/junk is excluded so the blob stays small (Neon free-tier friendly). |
| `start_hf.sh` | bash | Boot orchestrator (restore → clean → serve → launch Chrome → backup). Container entrypoint. |
| `Dockerfile` | — | Multi-stage build: compiles `monitor` + `profilesync`, installs Chrome for Testing 145, bakes in the extension. Base: `akashyadav758/chrome`. |
| `docker-compose.yml` | — | Self-host: one container + a named volume for profile persistence (no Postgres needed locally). |

### Ports

| Port | Service | Exposed |
|------|---------|---------|
| 3001 | monitor — UI + API gateway | ✅ published |
| 9222 | Chrome CDP | internal |
| 9223 | CDP proxy | internal |
| 9225 | chat backend (ws + http) | internal |
| 8000 / 9226 | gemini backend (http / cookie-ws) | internal |

> The monitor listens on `:3001` by default; override with `MONITOR_PORT`. On Hugging Face,
> the Space's `app_port` (in the Space README) must match the port the monitor listens on.

---

## Configuration

Set these as **Space secrets** on HF, or via a local `.env` for Docker.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | for HF login persistence | Neon Postgres connection string. Used by `profilesync` to back up / restore the Chrome profile. Format: `postgresql://user:pass@host.region.aws.neon.tech/db?sslmode=require` |
| `API_KEY` | optional | Gates the `/gpt` and `/gemini` gateways. If unset, those APIs return `503` (the Flow extension still works). |

> 🔒 **Never commit real credentials.** `.gitignore` already excludes `.env`, `*.env`,
> `profilesync/.env`, `hf-token`, `neon-db`, and `api-key`. Use `profilesync/.env.example`
> as the template.

---

## Deploy on Hugging Face

1. Create a **Docker** Space and push this repo to it.
2. Create a free Postgres DB at [neon.tech](https://neon.tech) and copy its connection string.
3. In the Space → **Settings → Variables and secrets → New secret**:
   - `DATABASE_URL` = your Neon connection string
   - *(optional)* `API_KEY` = a key to protect the gateways
4. The Space builds and starts. Open the Space URL → **log in to Google / Flow once**.
5. Done. The profile auto-saves every 5 min and is restored on every restart/rebuild —
   **you won't have to log in again.**

### Verify persistence

Boot logs show the restore/backup cycle:

```
📥 Restoring Chrome profile from Postgres...
[profilesync] restored 147 files from Postgres snapshot   # after first login
🗄️  Profile auto-backup every 5 min enabled.
✨ Launching Chrome Headless...
```

First-ever boot (before any login) instead shows `[profilesync] no snapshot yet — fresh start`.

> ⚠️ A login is only durable once it has been backed up (within ~5 min, or on graceful
> shutdown). If you restart immediately after logging in, the last few minutes can be lost.

---

## Self-host with Docker

No Postgres needed locally — a named volume persists the profile across restarts.

```bash
# optional: gate the /gpt /gemini APIs
echo "API_KEY=your-key" > .env

docker compose up --build -d
```

Then open <http://localhost:3001> for the live Chrome view, and log in to Flow once.
The `chrome-profile` named volume keeps your login across `docker compose down/up` and host reboots.

---

## Security notes

- Treat `DATABASE_URL` and `API_KEY` as secrets — set them as Space secrets / in `.env`, never in code.
- If a connection string is ever exposed, **rotate the Neon password** and update both the
  `DATABASE_URL` Space secret and your local `.env`.
- The profile snapshot contains live login cookies — anyone with `DATABASE_URL` can restore
  your session. Keep the DB private.
