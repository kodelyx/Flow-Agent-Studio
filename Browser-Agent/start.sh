#!/bin/bash

# Graceful Shutdown Handler
cleanup() {
    echo "🛑 Shutting down..."
    pkill -TERM -f chrome-linux64 2>/dev/null || true
    sleep 5
    # Snapshot the profile (cookies/logins) to Postgres after Chrome has closed
    # its files, so the next boot restores a consistent login state.
    if [ -n "$DATABASE_URL" ]; then
        echo "💾 Backing up Chrome profile to Postgres..."
        /opt/profilesync/profilesync backup || echo "⚠️  Backup failed"
    fi
    exit 0
}
trap cleanup SIGTERM SIGINT

echo "🚀 Starting Chrome Headless Boot Sequence on Hugging Face Spaces..."

# 0. Restore Chrome profile from Postgres snapshot (survives HF restart/rebuild).
if [ -n "$DATABASE_URL" ]; then
    echo "📥 Restoring Chrome profile from Postgres..."
    /opt/profilesync/profilesync restore || echo "⚠️  Restore skipped/failed (first run?)"
fi

# 1. Structure Detection & Fix
if [ -d "/home/chrome/data/data/Default" ]; then
    echo "⚠️  Nested structure detected. Fixing..."
    mv /home/chrome/data/data/* /home/chrome/data/ 2>/dev/null || true
    rmdir /home/chrome/data/data 2>/dev/null || true
fi

# 2. Deep Junk Cleanup
echo "🧹 Performing Deep Junk Cleanup..."
rm -rf /home/chrome/data/Default/Cache \
       /home/chrome/data/Default/Code\ Cache \
       /home/chrome/data/Default/GPUCache \
       /home/chrome/data/Default/DawnGraphiteCache \
       /home/chrome/data/Default/DawnWebGPUCache \
       /home/chrome/data/Default/ShaderCache \
       /home/chrome/data/Default/GrShaderCache \
       /home/chrome/data/Default/Service\ Worker/CacheStorage \
       /home/chrome/data/Default/History \
       /home/chrome/data/Default/Favicons \
       /home/chrome/data/Default/Top\ Sites \
       /home/chrome/data/Default/Visited\ Links \
       /home/chrome/data/Default/Network\ Action\ Predictor \
       /home/chrome/data/Default/Network\ Persistent\ State 2>/dev/null || true

rm -rf /home/chrome/data/component_crx_cache \
       /home/chrome/data/optimization_guide_model_store \
       /home/chrome/data/WasmTtsEngine \
       /home/chrome/data/OnDeviceHeadSuggestModel \
       /home/chrome/data/hyphen-data \
       /home/chrome/data/ZxcvbnData \
       /home/chrome/data/SafetyTips \
       /home/chrome/data/Safe\ Browsing* \
       /home/chrome/data/BrowserMetrics* \
       /home/chrome/data/Crashpad \
       /home/chrome/data/GrShaderCache \
       /home/chrome/data/ShaderCache \
       /home/chrome/data/GraphiteDawnCache 2>/dev/null || true

# 3. Singleton/Lock removal
echo "🔓 Removing lock files..."
find /home/chrome -name "Singleton*" -exec rm -f {} +
rm -f /home/chrome/data/Default/LOCK /home/chrome/data/Default/LOG.old 2>/dev/null || true

# 3b. Session-restore wipe
echo "🧹 Wiping saved session/tab restore state..."
rm -rf /home/chrome/data/Default/Sessions 2>/dev/null || true
rm -f  /home/chrome/data/Default/Current\ Tabs \
       /home/chrome/data/Default/Last\ Tabs \
       /home/chrome/data/Default/Current\ Session \
       /home/chrome/data/Default/Last\ Session 2>/dev/null || true

# 4. Preferences Injection (Developer Mode & Crash Fix)
python3 -c "
import json, os
pref_path = '/home/chrome/data/Default/Preferences'
os.makedirs(os.path.dirname(pref_path), exist_ok=True)
data = {}
if os.path.exists(pref_path):
    try:
        with open(pref_path, 'r') as f:
            data = json.load(f)
    except:
        pass

# Enable Developer Mode
if 'extensions' not in data:
    data['extensions'] = {}
if 'ui' not in data['extensions']:
    data['extensions']['ui'] = {}
data['extensions']['ui']['developer_mode'] = True

# Prevent Restore Popup
if 'profile' not in data:
    data['profile'] = {}
data['profile']['exit_type'] = 'Normal'

with open(pref_path, 'w') as f:
    json.dump(data, f)
" 2>/dev/null || true

# 4b. Configure Extension WS URL dynamically from environment
BACKEND_WS_URL=${BACKEND_WS_URL:-"ws://backend:8001/ws"}
echo "🔧 Configuring Extension WebSocket URL to: $BACKEND_WS_URL"
sed -i "s|const AGENT_WS_URL = '.*';|const AGENT_WS_URL = '${BACKEND_WS_URL}';|g" /opt/Flow-extension/background.js

# 5. Start Monitor Server (Exposed on 7860 to keep HF healthy and show view)
echo "🚀 Starting Go Monitor Server..."
touch /home/chrome/chrome.log
/opt/monitor3/monitor &

# 6. Start CDP Proxy
echo "🔌 Starting CDP Proxy..."
socat TCP-LISTEN:9223,fork,bind=0.0.0.0 TCP:127.0.0.1:9222 &

# 6b. Periodic profile backup
if [ -n "$DATABASE_URL" ]; then
    echo "🗄️  Profile auto-backup every 5 min enabled."
    ( while sleep 300; do /opt/profilesync/profilesync backup >/dev/null 2>&1 || true; done ) &
fi

export XDG_RUNTIME_DIR=/tmp/runtime-chrome
mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"

# 7. Launch Chrome Headless
echo "✨ Launching Chrome Headless..."
/opt/chrome-linux64/chrome \
  --headless=new \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-infobars \
  --disable-blink-features=AutomationControlled \
  --excludeSwitches=enable-automation \
  --use-fake-ui-for-media-stream \
  --use-fake-device-for-media-stream \
  --use-mock-keychain \
  --password-store=basic \
  --window-size=980,1070 \
  --user-agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-gpu-compositing \
  --disable-breakpad \
  --disable-crash-reporter \
  --mute-audio \
  --in-process-gpu \
  --disable-dev-shm-usage \
  --font-render-hinting=none \
  --disable-font-subpixel-positioning \
  --force-color-profile=srgb \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1 \
  --remote-allow-origins='*' \
  --user-data-dir=/home/chrome/data \
  --disable-background-networking \
  --disable-sync \
  --no-first-run \
  --disable-default-apps \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows \
  --load-extension=/opt/Flow-extension \
  --disable-extensions-except=/opt/Flow-extension \
  --disable-translate \
  --memory-pressure-off \
  --disable-client-side-phishing-detection \
  --disable-component-update \
  --disable-domain-reliability \
  --disable-hang-monitor \
  --disable-ipc-flooding-protection \
  --disable-popup-blocking \
  --disable-prompt-on-repost \
  --disable-cookie-encryption \
  --force-dark-mode \
  --udp-force-randomized-port \
  --disable-partial-raster \
  --disable-features=TranslateUI,PaintHolding,IsolateOrigins,site-per-process \
  --enable-features=NetworkService,NetworkServiceInProcess \
  --disable-site-isolation-trials \
  --js-flags="--max-old-space-size=512" \
  --metrics-recording-only \
  'https://labs.google/fx/tools/flow' 2>&1 | tee /home/chrome/chrome.log
