# Flow Setup: OpenAI-Compatible Google Flow AI Agent & UI

This project is a complete setup for leveraging Google Flow AI's image and video generation capabilities through an OpenAI-compatible API server (`flow-agent`) and a responsive web application (`frontend`).

---

## 🏗️ Project Architecture

The workspace consists of two main parts:

```
Flow-Setup/
├── flow-agent/          # Python-based backend & OpenAI-compatible API server
│   ├── cli/api.py       # FastAPI application
│   ├── omniflash/       # Extension bridge and generators (T2I, I2V, etc.)
│   └── Flow-extension/  # Chrome extension to interface with Google Flow
└── frontend/            # Web interface (TypeScript + React)
```

1. **`flow-agent`**: A FastAPI backend that connects to Google Flow via a Chrome Extension (WebSocket bridge) and exposes standard OpenAI-compatible endpoints.
2. **`frontend`**: A premium, highly responsive user interface that connects to the local api server to allow image/video generation, reference selection, canvas layout manipulation, and history/credit management.

---

## ⚡ Features

- **Standard OpenAI Specifications**: Direct drop-in endpoints (`/v1/images/generations`, `/v1/chat/completions`) for editor integrations.
- **Video Generation & Contextual References**: Dedicated Video Generation tab with advanced reference controls (`Add Image Ref`, `Add Video Ref` options).
- **Parallel Multi-File Upload**: Supports selecting and dragging-and-dropping multiple files (images/videos) at once.
- **Active Upload Counters**: Dynamic loader messages track real-time parallel upload progress (`Uploading reference to Google Flow (N active)...`) and only hide when all uploads are complete.
- **Async Non-Blocking Server**: Uploading large video files runs concurrently on the backend using async subprocesses (`asyncio.create_subprocess_exec`), keeping the event loop fully responsive.
- **History & Clean Archive**: Save and view generation history locally. Clearing history removes both generated items and all uploaded references (`upload_` files) from disk.
- **Credits Tracking**: Auto-updates credits on startup and immediately after video generation tasks.
- **Dynamic Canvas**: Visual canvas to manage, add, and remove generated outputs.

---

## 🚀 Getting Started

### 1. Setup Backend (`flow-agent`)

#### Prerequisites
- Python 3.8+
- Google Chrome (with Flow extension loaded)

#### Installation & Startup
1. Navigate to the `flow-agent` directory:
   ```bash
   cd flow-agent
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python cli/api.py --port 8001
   ```
   *The server starts on `http://127.0.0.1:8001` and opens a WebSocket listener on port `9227` for the extension.*

---

### 2. Chrome Extension Setup

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `flow-agent/Flow-extension` directory.
4. Open the Google Flow AI page in Chrome to authorize and connect. Once connected, you will see `🔑 Auth token captured` in the server logs.

---

### 3. Setup Frontend

#### Prerequisites
- Node.js & npm

#### Installation & Startup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite/Webpack development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 📡 API Endpoints

The FastAPI server exposes the following endpoints on port `8001`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/health` | Check backend server & extension connection status |
| **GET** | `/v1/models` | List available models (OpenAI format) |
| **POST** | `/v1/images/generations` | Generate images from prompt (OpenAI Spec) |
| **POST** | `/v1/videos/generations` | Generate videos from prompt and start asset |
| **POST** | `/v1/chat/completions` | Custom chat endpoints for editors/IDE integration |
| **POST** | `/v1/upload` | Upload local file to Flow and get a `media_id` |
| **GET** | `/v1/credits` | Get remaining account credits |
| **GET** | `/v1/history` | Get generation history metadata |
| **DELETE** | `/v1/history` | Delete all history entries and downloaded files |
| **DELETE** | `/v1/history/{filename}` | Delete a single history item and file |
| **GET** | `/download/{filename}` | Download/serve generated assets |

---

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python), Uvicorn, WebSocket, Asyncio
- **Frontend**: React, TypeScript, Vanilla CSS
- **Bridge**: Chrome Extension (manifest v3), WebSocket Communication
