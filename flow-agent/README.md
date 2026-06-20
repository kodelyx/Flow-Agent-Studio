# Flow Agent

A Python backend + CLI that turns [Google Flow](https://labs.google/fx/tools/flow) into a
programmable, **OpenAI-compatible** image & video generation API.

Flow Agent does **not** call Google directly. Instead it bridges to the **Flow Agent Chrome
extension** over a WebSocket: the extension runs inside an already-logged-in Chrome (e.g. the
[`Browser-Agent`](../Browser-Agent) project) and performs the actual authenticated calls to
Flow, streaming results back. So this process holds **no Google credentials** — the login
lives in the browser, and the auth token is captured live from the extension.

---

## What it does

- **Video** — Text-to-Video, Image-to-Video (start frame), First/Last frame (start + end),
  Reference-to-Video, and Video-to-Video editing.
- **Images** — Text-to-Image and Image-to-Image (reference), 1–4 variations.
- **Two interfaces** — a CLI for one-off generations, and an OpenAI-compatible HTTP server
  you can point existing OpenAI SDK clients at.

---

## Architecture

```
   OpenAI SDK / curl / CLI
            │  HTTP (OpenAI-compatible)
            ▼
   ┌────────────────────────┐        WebSocket /ws          ┌──────────────────────┐
   │  Flow Agent (this repo) │ ◄───────────────────────────► │  Flow extension       │
   │  FastAPI + omniflash    │   /api/ext/callback (results)  │  (in logged-in Chrome)│
   └────────────────────────┘                                └──────────┬───────────┘
                                                                         │ authenticated
                                                                         ▼
                                                          aisandbox-pa.googleapis.com (Flow)
```

The extension connects to `/ws`, Flow Agent forwards generation requests to it, and the
extension posts results back to `/api/ext/callback`. Generated media is polled, downloaded,
de-watermarked (optional), and stored locally.

---

## Layout

| Path | What it is |
|------|------------|
| `omni.py` | Backward-compatible wrapper + CLI entry point for video generation. |
| `omniflash/` | Core package. |
| `omniflash/bridge.py` | `ExtensionBridge` — the WebSocket link to the Chrome extension. |
| `omniflash/config.py` | Constants: endpoints, aspect ratios, models, durations, credit costs, ports. |
| `omniflash/generators/` | One module per mode: `t2v`, `i2v`, `v2v`, `t2i`, plus `common`. |
| `omniflash/media_store.py` | Tracks generated media (history / downloads). |
| `omniflash/upload.py` | Image/video upload to Flow. |
| `cli/api.py` | FastAPI **OpenAI-compatible** server (`Flow Agent OpenAI API Wrapper`). |
| `cli/generate.py` | Video CLI. |
| `cli/image.py` | Image CLI. |
| `cli/edit.py` | Video editor (V2V) CLI. |
| `cli/upload.py` | Upload CLI. |
| `cli/sniff.py` | Flow API traffic sniffer (debugging). |

---

## Setup

```bash
cd flow-agent
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit as needed
```

For anything to actually generate, the **Flow extension must be connected** — run the
[`Browser-Agent`](../Browser-Agent) stack (or load the extension in a logged-in Chrome) so it
dials this server's WebSocket.

---

## CLI usage

**Video** (via `omni.py`):

```bash
python omni.py "A dragon breathing fire over a snowy mountain"
python omni.py "Eagle soaring" --aspect landscape --duration 8 -o eagle.mp4
python omni.py "Make it night time" --edit <MEDIA_ID>          # V2V edit
python omni.py "Zoom out reveal" --start frame.png --end last.png   # first/last frame
python omni.py "Dancing robot" --ref ref1.png ref2.png         # reference-to-video
```

| Flag | Meaning | Choices / default |
|------|---------|-------------------|
| `--aspect, -a` | Aspect ratio | `portrait` (default) · `landscape` |
| `--duration, -d` | Seconds | `4` · `6` · `8` · `10` (default 10) |
| `--count, -c` | Variations | `1`–`4` (default 1) |
| `--start, -s` / `--end` | Start / end frame image | file path or media_id |
| `--ref, -r` | Reference images | one or more |
| `--edit, -e` | Edit existing video | media_id |
| `--no-clean` | Skip watermark removal | off |

**Images:**

```bash
python -m cli.image "A neon city at dusk" --aspect landscape --count 4
python -m cli.image "Same style, new angle" --ref base.png
```

> Video credit cost by duration: 4s → 5, 6s → 10, 8s → 10, 10s → 15. Max 4 per request.

---

## OpenAI-compatible API server

```bash
python -m cli.api --host 0.0.0.0 --port 8001
# or: uvicorn cli.api:app --host 0.0.0.0 --port 8001
```

Set `SERVER_API_KEY` in `.env` to require a `Authorization: Bearer <key>` header (leave empty
to disable auth).

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/v1/models` | List available models |
| `POST` | `/v1/images/generations` | Generate images (OpenAI image schema) |
| `POST` | `/v1/videos/generations` | Generate videos |
| `POST` | `/v1/chat/completions` | Chat-style entry point |
| `POST` | `/v1/upload` | Upload an image/video to Flow |
| `GET`  | `/v1/history` | List generated media |
| `DELETE` | `/v1/history` · `/v1/history/{filename}` | Clear / delete history |
| `GET`  | `/v1/credits` | Remaining Flow credits |
| `GET`  | `/download/{filename}` | Download a generated file |
| `GET`  | `/health` | Health + extension connection status |
| `WS`   | `/ws` | Chrome extension connection (internal) |
| `POST` | `/api/ext/callback` | Extension result callback (internal) |

Example:

```bash
curl -X POST http://localhost:8001/v1/images/generations \
  -H "Authorization: Bearer $SERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a watercolor fox", "n": 2}'
```

---

## Configuration (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `WS_PORT` | `9227` | WebSocket port for the extension link |
| `HTTP_PORT` | `8100` | HTTP callback port for extension responses |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `8000` | Custom FastAPI server |
| `OPENAI_API_HOST` / `OPENAI_API_PORT` | `127.0.0.1` / `8001` | OpenAI-compatible server |
| `API_SSL` | `false` | Enable self-signed HTTPS (or set `API_SSL_CERTFILE`/`API_SSL_KEYFILE`) |
| `SERVER_API_KEY` | *(empty)* | Bearer key required from clients; empty = no auth |
| `DEFAULT_PROJECT` | *(uuid)* | Google Flow project ID |
| `IMAGE_MODEL` | `NARWHAL` | Image model: `NARWHAL` · `GEM_PIX_2` · `IMAGEN_4` |
| `POLL_INTERVAL` | `10` | Seconds between status polls |
| `POLL_TIMEOUT` | `420` | Max seconds to wait for a video |

> 🔒 `.env` is gitignored — keep `SERVER_API_KEY` and any project IDs out of version control.
> Use `.env.example` as the template.

---

## Relationship to Browser-Agent

`flow-agent` is the **API / CLI side**; [`Browser-Agent`](../Browser-Agent) is the
**browser side** that hosts the logged-in Chrome + Flow extension and persists the login.
Run Browser-Agent so the extension is online, then drive generations through this server's
CLI or HTTP API.
