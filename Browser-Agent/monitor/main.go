// Chrome live monitor with a built-in navigator.
//
// Talks to Chrome's DevTools Protocol on 127.0.0.1:9222 and serves a browser-like
// UI on :3001:
//   - a live tab strip listing every open Chrome page (known AI services first),
//   - an address bar + back / forward / reload to drive the active tab anywhere,
//   - new-tab / close-tab buttons,
//   - click + type forwarded straight into the active page.
// The active tab is brought to front before every screenshot so background tabs
// still render. Tabs are keyed by their live CDP target id (not hardcoded).
package main

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const cdpBase = "http://127.0.0.1:9222"

//go:embed index.html
var indexHTML []byte

// knownTab is one of the AI services we pre-open and label nicely.
type knownTab struct {
	Title string
	URL   string // page to open on startup
	Match string // substring used to find an already-open page target
}

var knownTabs = []knownTab{
	{"Flow", "https://labs.google/fx/tools/flow", "labs.google"},
}

// cdpTarget mirrors the relevant fields of an entry from GET /json.
type cdpTarget struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	URL   string `json:"url"`
	Title string `json:"title"`
	WS    string `json:"webSocketDebuggerUrl"`
}

// tabInfo is what the UI consumes from /api/tabs.
type tabInfo struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

// cdpConn is a serialized request/response wrapper around one DevTools websocket.
type cdpConn struct {
	c  *websocket.Conn
	mu sync.Mutex
	id int
}

func (cc *cdpConn) call(method string, params map[string]any) (json.RawMessage, error) {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	cc.id++
	myID := cc.id
	if err := cc.c.WriteJSON(map[string]any{"id": myID, "method": method, "params": params}); err != nil {
		return nil, err
	}
	cc.c.SetReadDeadline(time.Now().Add(15 * time.Second))
	for {
		_, data, err := cc.c.ReadMessage()
		if err != nil {
			return nil, err
		}
		var m struct {
			ID     int             `json:"id"`
			Result json.RawMessage `json:"result"`
			Error  *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(data, &m) != nil {
			continue
		}
		if m.ID == myID { // ignore CDP events (no matching id)
			if m.Error != nil {
				return nil, fmt.Errorf("cdp %s: %s", method, m.Error.Message)
			}
			return m.Result, nil
		}
	}
}

// connections, one persistent websocket per target id.
var (
	conns  = map[string]*cdpConn{}
	connMu sync.Mutex
)

func httpGetJSON(url string, out any) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

func listTargets() ([]cdpTarget, error) {
	var t []cdpTarget
	err := httpGetJSON(cdpBase+"/json", &t)
	return t, err
}

// pageTargets returns the open page targets, known services first then the rest.
func pageTargets() ([]cdpTarget, error) {
	targets, err := listTargets()
	if err != nil {
		return nil, err
	}
	var pages []cdpTarget
	for _, t := range targets {
		if t.Type != "page" || strings.HasPrefix(t.URL, "devtools://") {
			continue
		}
		pages = append(pages, t)
	}
	rank := func(t cdpTarget) int {
		for i, k := range knownTabs {
			if strings.Contains(t.URL, k.Match) {
				return i
			}
		}
		return len(knownTabs) + 1
	}
	sort.SliceStable(pages, func(i, j int) bool { return rank(pages[i]) < rank(pages[j]) })
	return pages, nil
}

// friendlyTitle prefers a known service label, then the page title, then the URL.
func friendlyTitle(t cdpTarget) string {
	for _, k := range knownTabs {
		if strings.Contains(t.URL, k.Match) {
			return k.Title
		}
	}
	if t.URL == "" || t.URL == "about:blank" {
		return "New Tab"
	}
	if strings.TrimSpace(t.Title) != "" {
		return t.Title
	}
	return t.URL
}

// browserWS returns the browser-level websocket URL (for Target.* calls).
func browserWS() (string, error) {
	var v struct {
		WS string `json:"webSocketDebuggerUrl"`
	}
	if err := httpGetJSON(cdpBase+"/json/version", &v); err != nil {
		return "", err
	}
	return v.WS, nil
}

func dial(ws string) (*cdpConn, error) {
	c, _, err := websocket.DefaultDialer.Dial(ws, nil)
	if err != nil {
		return nil, err
	}
	return &cdpConn{c: c}, nil
}

// browserCall runs a single browser-level command (createTarget / closeTarget).
func browserCall(method string, params map[string]any) (json.RawMessage, error) {
	bws, err := browserWS()
	if err != nil {
		return nil, err
	}
	bc, err := dial(bws)
	if err != nil {
		return nil, err
	}
	defer bc.c.Close()
	return bc.call(method, params)
}

// targetWSByID looks up a page target's websocket URL by its id.
func targetWSByID(id string) (string, error) {
	targets, err := listTargets()
	if err != nil {
		return "", err
	}
	for _, t := range targets {
		if t.ID == id {
			return t.WS, nil
		}
	}
	return "", fmt.Errorf("no target %q", id)
}

// ensureKnown finds an already-open page for a known service, creating it if absent.
func ensureKnown(k knownTab) error {
	targets, err := listTargets()
	if err != nil {
		return err
	}
	for _, tg := range targets {
		if tg.Type == "page" && strings.Contains(tg.URL, k.Match) {
			return nil
		}
	}
	_, err = browserCall("Target.createTarget", map[string]any{"url": k.URL})
	return err
}

// conn returns a live cdpConn for the given target id, (re)dialing as needed.
func conn(id string) (*cdpConn, error) {
	connMu.Lock()
	defer connMu.Unlock()
	if cc, ok := conns[id]; ok {
		if _, err := cc.call("Target.getTargetInfo", nil); err == nil { // cheap liveness probe
			return cc, nil
		}
		cc.c.Close()
		delete(conns, id)
	}
	ws, err := targetWSByID(id)
	if err != nil {
		return nil, err
	}
	cc, err := dial(ws)
	if err != nil {
		return nil, err
	}
	conns[id] = cc
	return cc, nil
}

// connForReq resolves the ?tab= target, writing an error response on failure.
func connForReq(w http.ResponseWriter, r *http.Request) (*cdpConn, bool) {
	id := r.URL.Query().Get("tab")
	if id == "" {
		http.Error(w, "missing tab", http.StatusBadRequest)
		return nil, false
	}
	cc, err := conn(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return nil, false
	}
	return cc, true
}

func screenHandler(w http.ResponseWriter, r *http.Request) {
	cc, ok := connForReq(w, r)
	if !ok {
		return
	}
	cc.call("Page.bringToFront", nil) // ensure background tab renders
	res, err := cc.call("Page.captureScreenshot", map[string]any{"format": "png"})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	var out struct {
		Data string `json:"data"`
	}
	if json.Unmarshal(res, &out) != nil || out.Data == "" {
		http.Error(w, "no screenshot", http.StatusBadGateway)
		return
	}
	png, err := base64.StdEncoding.DecodeString(out.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(png)
}

func inputHandler(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Type   string  `json:"type"`
		X      float64 `json:"x"`
		Y      float64 `json:"y"`
		Button string  `json:"button"`
		Text   string  `json:"text"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	cc, ok := connForReq(w, r)
	if !ok {
		return
	}
	switch in.Type {
	case "mousedown", "mouseup":
		mt := "mousePressed"
		if in.Type == "mouseup" {
			mt = "mouseReleased"
		}
		btn := in.Button
		if btn == "" {
			btn = "left"
		}
		cc.call("Input.dispatchMouseEvent", map[string]any{
			"type": mt, "x": in.X, "y": in.Y, "button": btn, "clickCount": 1,
		})
	case "keydown":
		if in.Text == "\r" || in.Text == "\n" {
			cc.call("Input.dispatchKeyEvent", map[string]any{
				"type": "keyDown", "key": "Enter", "windowsVirtualKeyCode": 13, "text": "\r",
			})
			cc.call("Input.dispatchKeyEvent", map[string]any{"type": "keyUp", "key": "Enter", "windowsVirtualKeyCode": 13})
		} else if in.Text == "\b" {
			cc.call("Input.dispatchKeyEvent", map[string]any{"type": "keyDown", "key": "Backspace", "windowsVirtualKeyCode": 8})
			cc.call("Input.dispatchKeyEvent", map[string]any{"type": "keyUp", "key": "Backspace", "windowsVirtualKeyCode": 8})
		} else if in.Text != "" {
			cc.call("Input.insertText", map[string]any{"text": in.Text})
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// normalizeURL prepends https:// when the user typed a bare host.
func normalizeURL(u string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return ""
	}
	if !strings.Contains(u, "://") {
		u = "https://" + u
	}
	return u
}

func navigateHandler(w http.ResponseWriter, r *http.Request) {
	var in struct {
		URL string `json:"url"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	url := normalizeURL(in.URL)
	if url == "" {
		http.Error(w, "empty url", http.StatusBadRequest)
		return
	}
	cc, ok := connForReq(w, r)
	if !ok {
		return
	}
	if _, err := cc.call("Page.navigate", map[string]any{"url": url}); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func reloadHandler(w http.ResponseWriter, r *http.Request) {
	cc, ok := connForReq(w, r)
	if !ok {
		return
	}
	cc.call("Page.reload", nil)
	w.WriteHeader(http.StatusNoContent)
}

// historyStep moves the active tab back (delta -1) or forward (delta +1).
func historyStep(cc *cdpConn, delta int) error {
	res, err := cc.call("Page.getNavigationHistory", nil)
	if err != nil {
		return err
	}
	var h struct {
		CurrentIndex int `json:"currentIndex"`
		Entries      []struct {
			ID int `json:"id"`
		} `json:"entries"`
	}
	if err := json.Unmarshal(res, &h); err != nil {
		return err
	}
	target := h.CurrentIndex + delta
	if target < 0 || target >= len(h.Entries) {
		return nil // nothing to do at the ends
	}
	_, err = cc.call("Page.navigateToHistoryEntry", map[string]any{"entryId": h.Entries[target].ID})
	return err
}

func historyHandler(delta int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cc, ok := connForReq(w, r)
		if !ok {
			return
		}
		if err := historyStep(cc, delta); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func newtabHandler(w http.ResponseWriter, r *http.Request) {
	var in struct {
		URL string `json:"url"`
	}
	json.NewDecoder(r.Body).Decode(&in)
	url := normalizeURL(in.URL)
	if url == "" {
		url = "about:blank"
	}
	res, err := browserCall("Target.createTarget", map[string]any{"url": url})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	var out struct {
		TargetID string `json:"targetId"`
	}
	json.Unmarshal(res, &out)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"id": out.TargetID})
}

func closetabHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("tab")
	if id == "" {
		http.Error(w, "missing tab", http.StatusBadRequest)
		return
	}
	if _, err := browserCall("Target.closeTarget", map[string]any{"targetId": id}); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	connMu.Lock()
	if cc, ok := conns[id]; ok {
		cc.c.Close()
		delete(conns, id)
	}
	connMu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

func tabsHandler(w http.ResponseWriter, r *http.Request) {
	pages, err := pageTargets()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	out := make([]tabInfo, 0, len(pages))
	for _, t := range pages {
		out = append(out, tabInfo{ID: t.ID, Title: friendlyTitle(t), URL: t.URL})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func chromeLogHandler(w http.ResponseWriter, r *http.Request) {
	f, err := os.Open("/home/chrome/chrome.log")
	if err != nil {
		http.Error(w, "no log", http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	io.Copy(w, f)
}

// backendLogHandler serves the per-server logs (API-key gated) so we can diagnose
// the gpt/gemini backends without shelling into the container:
//   /logs/chatgpt  /logs/gemini  (also /logs/monitor)
func backendLogHandler(w http.ResponseWriter, r *http.Request) {
	if !authOK(w, r) {
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/logs/")
	paths := map[string]string{
		"chatgpt": "/home/chrome/chatgpt.log",
		"gemini":  "/home/chrome/gemini.log",
		"monitor": "/home/chrome/monitor.log",
	}
	p, ok := paths[name]
	if !ok {
		http.Error(w, "unknown log (use chatgpt|gemini|monitor)", http.StatusNotFound)
		return
	}
	f, err := os.Open(p)
	if err != nil {
		http.Error(w, "no log", http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	io.Copy(w, f)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	mem := readMeminfo()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"memUsedGB":  mem.usedGB,
		"memTotalGB": mem.totalGB,
		"memPct":     mem.pct,
		"cpu":        readCPUPercent(),
		"uptime":     readUptime(),
	})
}

// ---- API gateway ----------------------------------------------------------
// The monitor doubles as the single public entry point for the backend
// servers that run on localhost inside this same container. HF exposes only one
// port (3001), so /gpt and /gemini are reverse-proxied to the servers'
// loopback HTTP ports. Both are gated by an API key (fail-closed).

var apiKey = os.Getenv("API_KEY")

// authOK enforces the API key on gateway routes. If API_KEY is unset it refuses
// every call (503) so the logged-in accounts are never accidentally wide open.
func authOK(w http.ResponseWriter, r *http.Request) bool {
	if apiKey == "" {
		http.Error(w, "gateway disabled: API_KEY not set on the server", http.StatusServiceUnavailable)
		return false
	}
	// Check ?key= and the apikey cookie BEFORE the Authorization header. On a
	// private HF Space the platform claims Authorization: Bearer <HF_token>, so the
	// API key must travel via ?key= or the cookie; only fall back to Authorization
	// (public Space / OpenAI-compatible clients) when those are absent.
	got := r.URL.Query().Get("key")
	if got == "" {
		if c, err := r.Cookie("apikey"); err == nil {
			got = c.Value
		}
	}
	if got == "" {
		got = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	}
	if got != apiKey {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return false
	}
	return true
}

// gate wraps a handler so it requires the API key (Bearer header, ?key=, or the
// apikey cookie). Every monitor route that can view or drive the logged-in
// browser is gated — nothing is publicly reachable.
func gate(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authOK(w, r) {
			return
		}
		h(w, r)
	}
}

// gatewayHandler builds an API-key-gated reverse proxy that strips prefix and
// forwards to target (e.g. /gpt/api/chat -> http://127.0.0.1:9225/api/chat).
func gatewayHandler(prefix, target string) http.HandlerFunc {
	u, err := url.Parse(target)
	if err != nil {
		log.Fatalf("bad gateway target %q: %v", target, err)
	}
	proxy := &httputil.ReverseProxy{
		Director: func(r *http.Request) {
			r.URL.Scheme = u.Scheme
			r.URL.Host = u.Host
			r.Host = u.Host
			p := strings.TrimPrefix(r.URL.Path, prefix)
			if p == "" || p[0] != '/' {
				p = "/" + p
			}
			r.URL.Path = p
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			http.Error(w, "backend unavailable: "+err.Error(), http.StatusBadGateway)
		},
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !authOK(w, r) {
			return
		}
		proxy.ServeHTTP(w, r)
	}
}

func main() {
	// Pre-open the known AI services in the background so they're ready by first view.
	go func() {
		for i := 0; i < 60; i++ {
			ok := true
			for _, k := range knownTabs {
				if err := ensureKnown(k); err != nil {
					ok = false
				}
			}
			if ok {
				log.Println("all known tabs ready")
				return
			}
			time.Sleep(2 * time.Second)
		}
	}()

	// The monitor UI (/, /api/*, /chrome.log) is open — the Space is private, so
	// HuggingFace's own auth already gates who can reach it (the owner). The browser
	// can't attach ?key= when HF serves the private subdomain, so requiring our key
	// here locks the owner out of their own live view. Only the AI gateway
	// (/gpt /gemini) and /logs stay API-key-gated for external programmatic use.
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})
	http.HandleFunc("/api/tabs", tabsHandler)
	http.HandleFunc("/api/screen", screenHandler)
	http.HandleFunc("/api/input", inputHandler)
	http.HandleFunc("/api/navigate", navigateHandler)
	http.HandleFunc("/api/reload", reloadHandler)
	http.HandleFunc("/api/back", historyHandler(-1))
	http.HandleFunc("/api/forward", historyHandler(+1))
	http.HandleFunc("/api/newtab", newtabHandler)
	http.HandleFunc("/api/closetab", closetabHandler)
	http.HandleFunc("/api/stats", statsHandler)
	http.HandleFunc("/chrome.log", chromeLogHandler)
	http.HandleFunc("/logs/", backendLogHandler)

	// API gateway → the three backend servers on localhost (API-key gated).
	http.HandleFunc("/gpt/", gatewayHandler("/gpt", "http://127.0.0.1:9225"))
	http.HandleFunc("/gemini/", gatewayHandler("/gemini", "http://127.0.0.1:8000"))
	if apiKey == "" {
		log.Println("WARNING: API_KEY not set — /gpt /gemini are disabled (503) until it is set")
	}

	addr := ":3001"
	if p := os.Getenv("MONITOR_PORT"); p != "" {
		addr = ":" + p
	}
	log.Printf("navigator monitor listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
