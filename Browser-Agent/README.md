# 🌐 Flow Browser Agent

A headless Chrome service running the **Flow Agent** browser extension against Google Flow. It automates browser interactions inside a container and communicates with the `flow-agent` backend.

---

## 🛠️ How It Works

* **CDP Port**: Chrome runs headless with Remote Debugging (CDP) enabled.
* **WebSocket Link**: The pre-loaded extension automatically connects to the backend API WebSocket when Chrome launches.
* **Persistent Login**: The Chrome profile (cookies and login states) is persisted in the Docker named volume `chrome-profile`, meaning **you only have to log in once**.

---

## 🚀 Running Locally

Runs as part of the unified Docker Compose stack:
```bash
docker compose up -d
```

### 🔑 Initial Google Flow Authentication
1. Launch the stack.
2. Open **`http://localhost:3001`** in your browser to view the live Chrome instance.
3. Log in to your Google Account on Google Flow.
4. Your login state is saved permanently in the Docker volume.
