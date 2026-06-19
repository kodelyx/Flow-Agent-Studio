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

---

## 🎨 Recent Studio UI & Lightbox Updates
 
 We recently updated the studio interface to match premium iOS 18 design guidelines:
 
 - **Simplified Gallery Header**: Removed clustered context action groups (`Auto-play`, `Add All`, `Download All` buttons) from the gallery card header to provide a clean, uncluttered presentation.
 - **Count Badge Alignment & Canvas Auto-Clearing**: Configured the active canvas workspace to automatically clear previous assets when launching a new generation request (images or videos are auto-cleared in their respective tabs), removed the redundant 'Clear' button entirely, and positioned the active asset count badge on the right of the header for a clean visual look.
 - **Minimalist Empty States**: Cleaned up the empty state template by removing the red circle emoji (`🔴`) and the verbose instructions, keeping the layout completely uncluttered.
 - **Premium Glassmorphic Lightbox**: Replaced the opaque pitch-black backdrop with a translucent, sharp overlay (`rgba(15, 23, 42, 0.15)`) that lets the studio show through clearly. Restyled the lightbox content container as a frosted glass popover card with a spring-spring scale opening animation, responsive media constraints (`50vh`), and high-contrast control buttons.
 - **Unified Panel Heights**: Aligned bottom card borders by changing `.ios-grid` layout container alignment to `align-items: stretch`, ensuring the Controls card and Gallery card are perfectly balanced.
 - **Light Mode Chrome Extension**: Converted both `popup.html` and `side_panel.html` in the Chrome extension (`Flow-extension/`) to match the iOS 18 glassmorphic theme. Used light background overlays, crimson accents (`#ff375f`), white translucent cards, and standard transparent cropped logos (`mix-blend-mode: multiply`) to provide a consistent visual look and feel. Also corrected the extension footer signature links to redirect both the "Flow Agent" GitHub project reference and "kodelyx" brand link directly to the correct repository: `https://github.com/kodelyx/Flow-Agent-Studio`. Swapped log type labels to use dark slate text (`var(--text)`) instead of red/cyan for improved readability, and removed the duplicate log count badge from the "Request Log" header in the side panel since totals are already tracked in the metrics header card.
 - **Side-by-Side Reference Actions**: Updated the image overlay reference buttons (`Add Image Ref` and `Add Video Ref`) to display side-by-side (flex-row) instead of vertically stacked. Restyled the buttons inside `.overlay-buttons` with a flexible width layout and proportional font size sizing to optimize interactive layout space on image hovers.
