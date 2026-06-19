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
| **POST** | `/v1/videos/generations` | Generate standard videos, Image-to-Video, or Video-to-Video references |
| **GET** | `/v1/credits` | Fetch remaining user account credits |
| **GET** | `/v1/history` | Get local generation history metadata |
| **DELETE** | `/v1/history` | Wipe all history entries and downloaded reference media |

---

## 📦 Dedicated Bulk Generator Tab

The **Bulk Generator** provides an independent, high-throughput workspace to run multiple prompts parsed from `.xlsx`, `.csv`, or `.txt` spreadsheet files:
- **Parallel Modality Tracks**: Separates image and video prompts into concurrent execution queues (`runImageQueue` and `runVideoQueue`) to process them as fast as possible.
- **Dynamic Parameter Visibility**: Automatically hides and shows default parameter groups (e.g. Default Image Settings, Default Video Settings) on the sidebar based on what modalities are detected in your spreadsheet.
- **Default Fallbacks**: If rows in the spreadsheet are missing parameters (like dimensions, duration, variations), the app uses the values selected in the Default Settings dropdowns as fallback parameters.
- **Visual Preview Checklist**: Displays an interactive checklist summarizing and parsing the loaded spreadsheet rows directly in the empty canvas space before generation begins.

---

## 🔗 Cross-Row Reference Chains (Image-to-Video & Style Links)

You can specify dynamic, sequential references in your spreadsheet to run complex pipelines, such as generating an image and using it as a starting frame or style reference for a subsequent video/image:

- **Syntax**: Write **`@N`** in reference columns (`Reference 1`, `Reference 2`, `Reference 3`), where `N` is the 1-based index of the target data row (excluding headers).
  - *Example*: Row 1 is an `image` prompt, and Row 2 is a `video` prompt. Set Row 2's reference cell to `@1` to execute an **Image-to-Video** chain.
- **Asynchronous Waiting Loop**: Dependent video/image tasks pause execution and display `Waiting for Row N...` in real-time, automatically resuming as `Generating...` when the dependency row registers its output media ID.
- **Multiple References**: You can reference multiple prior rows (e.g., `@1`, `@2`) across columns, and they will be automatically combined into style references.
- **Timeout Safety**: A 3-minute timeout ensures that if a reference row fails or is cancelled, subsequent dependent rows skip the reference and proceed without freezing the browser queue.
