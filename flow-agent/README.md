# ⚡ Flow Agent (Backend)

The Python backend + API server that turns Google Flow (Google Labs) into a programmable, **OpenAI-compatible** image & video generation API.

It bridges to the **Flow Agent Chrome extension** (running inside `Browser-Agent`) via WebSocket to execute commands in a logged-in browser session.

---

## 🛠️ Setup & Run

### 1. Configure Environment
```bash
cd flow-agent
cp .env.example .env
```

### 2. Run Locally (Alternative to Docker Compose)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m cli.api --host 0.0.0.0 --port 8001
```
*The server will start on port `8001`.*

---

## 🚀 CLI Usage

### Video Generation (omni.py)
```bash
python omni.py "A dragon flying over mountains" --aspect landscape --duration 8
```

### Image Generation (cli.image)
```bash
python -m cli.image "A futuristic neon city" --aspect landscape --count 4
```

---

## 🌐 OpenAI-Compatible API

Exposes standard endpoints at `http://localhost:8001`:

* **`POST /v1/images/generations`** — Generate images.
* **`POST /v1/videos/generations`** — Generate videos.
* **`GET /v1/history`** — List generated media files.
* **`GET /v1/credits`** — Remaining Google Flow credits.
* **`GET /download/{filename}`** — Download generated files.
