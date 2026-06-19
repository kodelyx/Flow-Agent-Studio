# Flow Setup: Google Flow AI Agent & Studio UI

This project exposes Google Flow AI's generation capabilities as an OpenAI-compatible API backend and provides a premium iOS 18 glassmorphic studio interface.

---

## 🏗️ Architecture

- **`flow-agent`**: FastAPI OpenAI-compatible backend server (`/v1/images/generations`, `/v1/videos/generations`).
- **`Flow-extension`**: Chrome Extension acting as a WebSocket bridge between the local agent and Google Flow.
- **`frontend`**: React + TS studio web app for canvas management, generations, references, and credits tracking.

---

## 🚀 Quick Start

### 1. Start Backend
```bash
cd flow-agent
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python cli/api.py --port 8001
```

### 2. Load Extension
1. Go to `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select `flow-agent/Flow-extension`.
3. Keep Google Flow AI tab open in Chrome to auto-sync the auth token.

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev # Launches Vite/Hono app at http://localhost:3000
```

---

## 📡 Key Endpoints (Port `8001`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/v1/images/generations` | OpenAI Spec: Generate images (supports consistent reference references) |
| **POST** | `/v1/videos/generations` | Generate standard videos or Video-to-Video refs |
| **GET** | `/v1/credits` | Fetch remaining user account credits |
| **GET** | `/v1/history` | Get local generation history metadata |
| **DELETE** | `/v1/history` | Wipe all history entries and downloaded reference media |

---

## 🎨 Premium UI Features

- **iOS 18 Light Glassmorphism**: Clean layout with frosted cards, light background, and crimson red accents.
- **Persistent Card Footers**: Prompts and action buttons (`Img Ref`, `Vid Ref`, `Copy Prompt`) sit directly below media assets for easy access.
- **Auto-Clearing Canvas**: Active workspace auto-clears on new request triggers, preserving full history under the persistent History tab.
- **Background Generation**: Image and video generator tabs operate concurrently without blocking the client.
