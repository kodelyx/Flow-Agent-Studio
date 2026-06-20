# Flow Agent Studio

**Turn [Google Flow](https://labs.google/fx/tools/flow) into a programmable, OpenAI-compatible image & video generation API — with a premium studio UI and a cloud-hosted browser agent.**

Google Flow has no public API. This project drives it through a logged-in Chrome
extension and exposes the result as standard `/v1/images/generations` and
`/v1/videos/generations` endpoints — so you can generate **video** (Text-to-Video,
Image-to-Video, First/Last frame, Video-to-Video) and **images** (Text-to-Image,
Image-to-Image) from the CLI, the OpenAI SDK, the web studio, or in bulk from a
spreadsheet.

No Google credentials ever live in the backend — the login stays inside the browser,
and the auth token is captured live from the extension.

---

## 🧩 Components

| Folder | Stack | Role |
| :--- | :--- | :--- |
| **`flow-agent`** | Python · FastAPI | OpenAI-compatible backend + CLI. Bridges to the extension over WebSocket, polls/downloads generated media, and persists it (Cloudflare R2 + Postgres). Holds **no** Google credentials. |
| **`Flow-extension`** | Chrome MV3 (JS) | The "Flow Agent" extension. Runs inside a logged-in Chrome, performs the actual authenticated calls to Google Flow, and bridges results back over WebSocket. Load this for **local** use. |
| **`Browser-Agent`** | Docker · Go | **Flow in the cloud.** Runs headless Chrome + the extension on a server (Hugging Face Space / Docker), snapshotting the Chrome login profile into Neon Postgres so it survives restarts. Includes a live-view `monitor` and `profilesync`. |
| **`frontend`** | React + TS · Hono | iOS-style glassmorphic studio web app (canvas, generations, references, credits, and a bulk generator). Deploys to Cloudflare Workers via Wrangler. |

### How it fits together

```
   OpenAI SDK / curl / CLI / Studio UI
              │  HTTP (OpenAI-compatible, port 8001)
              ▼
   ┌─────────────────────────┐      WebSocket /ws        ┌───────────────────────────┐
   │  flow-agent (FastAPI)    │ ◄──────────────────────► │  Flow-extension            │
   │  omniflash + media store │   /api/ext/callback      │  (in a logged-in Chrome)   │
   └─────────────────────────┘                           └─────────────┬─────────────┘
              │                                                          │ authenticated
              │ R2 + Postgres (media persistence)                       ▼
              ▼                                          aisandbox-pa.googleapis.com (Flow)

   The Chrome can be your own (local) OR headless Chrome managed by Browser-Agent (cloud).
```

---

## 🚀 Quick Start (local)

### 1. Start the backend
```bash
cd flow-agent
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # adjust ports / settings if needed
python cli/api.py --port 8001
```

### 2. Load the extension
1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the top-level **`Flow-extension/`** folder.
3. Keep a Google Flow tab open in Chrome — the extension auto-syncs the auth token
   and connects to the backend over WebSocket.

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev   # Hono/Vite studio at http://localhost:3000
```

> **Cloud alternative:** instead of running the extension in your own browser, deploy
> **`Browser-Agent`** (headless Chrome + extension on a Hugging Face Space or via
> `docker compose up`) and point `flow-agent` at it. See `Browser-Agent/README.md`.

---

## 📡 Key Endpoints (port `8001`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/v1/images/generations` | OpenAI spec: generate images (supports consistent references) |
| **POST** | `/v1/videos/generations` | Generate video — standard, Image-to-Video, or Video-to-Video |
| **GET** | `/v1/credits` | Fetch remaining account credits |
| **GET** | `/v1/history` | Get local generation history metadata |
| **DELETE** | `/v1/history` | Wipe all history entries and downloaded media |

---

## 📦 Bulk Generator

A dedicated, high-throughput workspace to run many prompts parsed from `.xlsx`, `.csv`, or `.txt` files:

- **Parallel modality tracks** — image and video prompts run in concurrent queues (`runImageQueue` / `runVideoQueue`).
- **Dynamic parameter visibility** — default-setting groups (image / video) show or hide based on the modalities detected in your sheet.
- **Default fallbacks** — rows missing parameters (dimensions, duration, variations) fall back to the Default Settings dropdowns.
- **Visual preview checklist** — an interactive summary of parsed rows is shown on the canvas before generation begins.

---

## 🔗 Cross-Row Reference Chains (Image-to-Video & Style Links)

Specify dynamic, sequential references in your spreadsheet to run multi-step pipelines —
e.g. generate an image and use it as the start frame or style reference for a later video/image:

- **Syntax** — write **`@N`** in reference columns (`Reference 1/2/3`), where `N` is the 1-based data-row index (excluding headers).
  - *Example*: Row 1 is an `image` prompt, Row 2 is a `video` prompt. Set Row 2's reference to `@1` for an **Image-to-Video** chain.
- **Async waiting loop** — dependent tasks show `Waiting for Row N...` and auto-resume as `Generating...` once the dependency registers its output media ID.
- **Multiple references** — reference several prior rows (e.g. `@1`, `@2`) and they're combined into style references.
- **Timeout safety** — a 3-minute timeout lets dependent rows skip a failed/cancelled reference instead of freezing the queue.

---

## 📁 Per-component docs

Each folder has its own README with deeper detail:
`flow-agent/README.md` · `Browser-Agent/README.md`
