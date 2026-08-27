/* ============================================================
   SynapseDev — Phone-first developer suite prototype
   Fully client-side: mock state + localStorage + simulated AI
   ============================================================ */
"use strict";

/* ---------------- Constants & seed data ---------------- */

const LS_KEY = "synapsedev-state-v1";

const PEOPLE = [
  { id: "you",  name: "Priya Sharma", short: "You",  initials: "PS", color: "#00f2fe", role: "Staff Engineer · You",     presence: "online"  },
  { id: "john", name: "John Doe",     short: "John", initials: "JD", color: "#10b981", role: "Backend · Auth Platform",  presence: "inmeet"  },
  { id: "mia",  name: "Mia Kim",      short: "Mia",  initials: "MK", color: "#f59e0b", role: "SRE · CI Infrastructure",  presence: "inmeet"  },
  { id: "sam",  name: "Sam Rivera",   short: "Sam",  initials: "SR", color: "#8b5cf6", role: "ML Engineer · On-Device",  presence: "online"  },
  { id: "ana",  name: "Ana Petrov",   short: "Ana",  initials: "AP", color: "#ef4444", role: "Frontend · Companion Web", presence: "offline" },
];
const person = id => PEOPLE.find(p => p.id === id) || PEOPLE[0];

const ORGS = ["Acme Engineering", "Nebula Labs", "Personal Workspace"];
const KANBAN_COLS = [
  { id: "backlog",    label: "Backlog",     icon: "🗂️" },
  { id: "inprogress", label: "In Progress", icon: "🔧" },
  { id: "citest",     label: "CI / Test",   icon: "🧪" },
  { id: "done",       label: "Done",        icon: "✅" },
];

const SEED_TICKETS = [
  { id: "TICK-100", title: "Migrate pipeline config to ci.yml v2 schema", assignee: "ana",  priority: "Low",      branch: "chore/TICK-100-ciyml",   col: "done",       fromMeet: false, ci: { state: "passed", label: "✅ CI Passed (Jenkins #831)" } },
  { id: "TICK-101", title: "Fix race condition in auth token expiry path", assignee: "john", priority: "High",     branch: "feature/TICK-101-auth",  col: "inprogress", fromMeet: false, ci: null },
  { id: "TICK-102", title: "Woodpecker ARM64 runner flakes on cold cache", assignee: "mia",  priority: "Critical", branch: "fix/TICK-102-runner",    col: "citest",     fromMeet: false, ci: { state: "running", label: "⏳ CI Running (Woodpecker #76)" } },
  { id: "TICK-103", title: "Benchmark dataset ingestion for NPU eval",     assignee: "sam",  priority: "Medium",   branch: "feat/TICK-103-dataset",  col: "backlog",    fromMeet: false, ci: null },
];

const SEED_CHANNELS = [
  { id: "general",          name: "general",          desc: "Org-wide announcements",              fav: true  },
  { id: "engineering-core", name: "engineering-core", desc: "Platform + backend engineering",     fav: true  },
  { id: "standup-notes",    name: "standup-notes",    desc: "Auto-posted Meet summaries",          fav: false },
  { id: "ci-alerts",        name: "ci-alerts",        desc: "Jenkins / Woodpecker build webhooks", fav: false },
];

function seedMessages() {
  const t = (mins) => Date.now() - mins * 60000;
  return {
    "general": [
      { who: "ana",  text: "Companion web view now mirrors the phone laser pointer in real time 🎯 Try it from the Meet hub.", ts: t(190), read: true },
      { who: "john", text: "Nice. On my side: chasing the auth expiry race. Repro rate ~1/40 under load.", ts: t(140), read: true },
      { who: "you",  text: "Standup Meet in 10 — bring the `v1_auth.go` findings.", ts: t(65), read: true },
    ],
    "engineering-core": [
      { who: "john", text: "Root cause candidate:\n```go\nsession, ok := store[string(hash[:])]\n// read is not guarded — writer can evict mid-read\n```\nWe never took the RLock in the v1 handler.", ts: t(120), read: true },
      { who: "sam",  text: "Also flagging that **SHA-1** is still used for token digests in v1. We should land `argon2id` while we're in there.", ts: t(100), read: true },
      { who: "you",  text: "Agreed — fold both into the `v2-refactor` branch. Diff it in Code Hub with the AI explainer before review.", ts: t(80), read: true },
    ],
    "standup-notes": [
      { who: "bot", text: "🤖 **SynapseBot** · Daily digest armed. Finalized Meet summaries will be auto-posted here.", ts: t(300), read: true },
    ],
    "ci-alerts": [
      { who: "bot", text: "🟢 **Jenkins #831** succeeded · `chore/TICK-100-ciyml` · 4m 12s · deployed to staging.", ts: t(260), read: true },
      { who: "bot", text: "🟡 **Woodpecker #76** running · `fix/TICK-102-runner` · arm64 matrix (3/5 stages).", ts: t(45), read: true },
    ],
  };
}

/* ---------------- Repo mock data ---------------- */

const V1_AUTH_A8 = `package auth

import (
	"crypto/sha1"
	"errors"
	"time"
)

// ValidateToken checks a bearer token
// against the in-memory session store.
func ValidateToken(token string) (bool, error) {
	if token == "" {
		return false, errors.New("empty token")
	}
	hash := sha1.Sum([]byte(token))
	session, ok := store[string(hash[:])]
	if !ok {
		return false, errors.New("unknown session")
	}
	if session.Expiry.Before(time.Now()) {
		delete(store, string(hash[:]))
		return false, errors.New("expired token")
	}
	return true, nil
}`;

const V1_AUTH_B3 = `package auth

import (
	"crypto/sha1"
	"errors"
	"sync"
	"time"
)

var mu sync.RWMutex

// ValidateToken checks a bearer token
// against the in-memory session store.
// Reads are now guarded by an RWMutex.
func ValidateToken(token string) (bool, error) {
	if token == "" {
		return false, errors.New("empty token")
	}
	hash := sha1.Sum([]byte(token))
	mu.RLock()
	session, ok := store[string(hash[:])]
	mu.RUnlock()
	if !ok {
		return false, errors.New("unknown session")
	}
	if session.Expiry.Before(time.Now()) {
		evictExpired(string(hash[:]))
		return false, errors.New("expired token")
	}
	return true, nil
}`;

const V2_AUTH = `package auth

import (
	"context"
	"errors"
	"time"

	"golang.org/x/crypto/argon2"
)

// ValidateToken verifies a bearer token.
// v2: requires a structured context and
// uses Argon2id instead of legacy SHA-1.
func ValidateToken(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, errors.New("empty token")
	}
	key := argon2.IDKey([]byte(token), salt, 1, 64*1024, 4, 32)
	mu.RLock()
	session, ok := store[string(key)]
	mu.RUnlock()
	if !ok {
		return false, errors.New("unknown session")
	}
	if session.Expiry.Before(time.Now()) {
		evict(ctx, string(key))
		return false, errors.New("expired token")
	}
	return true, nil
}`;

const CI_YML = `# SynapseDev universal CI schema v2
pipeline: auth-service
runners:
  - jenkins: { node: "linux-x64", jdk: 17 }
  - woodpecker: { arch: "arm64", cache: warm }
stages:
  - lint:  { cmd: "golangci-lint run ./..." }
  - test:  { cmd: "go test -race ./...", retries: 2 }
  - build: { cmd: "go build -o bin/authd ./cmd" }
  - bench: { cmd: "go test -bench=NPU ./dataset" }
notify:
  channel: "#ci-alerts"
  on: [success, failure]`;

const BENCH_JSON = `{
  "suite": "npu-8elite-inference",
  "runtime": "Snapdragon Hexagon NPU (ONNX)",
  "models": [
    { "name": "whisper-tiny",  "latency_ms": 41,  "rtf": 0.06 },
    { "name": "gemma-2b-int4", "tok_per_s": 28.4, "ttft_ms": 190 },
    { "name": "qwen-coder-1.5b", "tok_per_s": 33.1, "ttft_ms": 145 }
  ],
  "power_budget_w": 4.2,
  "thermal_ceiling_c": 42
}`;

const REPO = {
  branches: ["main", "feature/TICK-101-auth", "v2-refactor"],
  files: [
    { path: "src/auth/v1_auth.go",   dir: "src/auth", size: "1.1 KB", byBranch: { "main": V1_AUTH_A8, "feature/TICK-101-auth": V1_AUTH_B3, "v2-refactor": V1_AUTH_B3 } },
    { path: "src/auth/v2_auth.go",   dir: "src/auth", size: "1.3 KB", byBranch: { "main": null, "feature/TICK-101-auth": null, "v2-refactor": V2_AUTH } },
    { path: "config/ci.yml",         dir: "config",   size: "0.6 KB", byBranch: { "main": CI_YML, "feature/TICK-101-auth": CI_YML, "v2-refactor": CI_YML } },
    { path: "dataset/benchmark.json",dir: "dataset",  size: "0.4 KB", byBranch: { "main": BENCH_JSON, "feature/TICK-101-auth": BENCH_JSON, "v2-refactor": BENCH_JSON } },
  ],
  commits: [
    { hash: "c7d551", msg: "feat(auth): introduce v2_auth.go with argon2id + ctx", author: "Sam Rivera", when: "2h ago",  branch: "v2-refactor",           snapshot: V2_AUTH },
    { hash: "b3e104", msg: "fix(auth): guard session reads with RWMutex",          author: "John Doe",   when: "5h ago",  branch: "feature/TICK-101-auth", snapshot: V1_AUTH_B3 },
    { hash: "a8f9c2", msg: "chore(auth): baseline v1 token validation",            author: "Priya Sharma", when: "2d ago", branch: "main",                 snapshot: V1_AUTH_A8 },
    { hash: "9e0f3a", msg: "ci: migrate to universal ci.yml v2 schema",            author: "Ana Petrov", when: "3d ago",  branch: "main",                  snapshot: CI_YML },
  ],
};

const TRANSCRIPT_TEXT = `Standup update: We have a race condition in the auth middleware. John, please refactor v1/auth_handler.go to v2/auth_controller.go and verify the Jenkins build passes today.`;

/* ---------------- State ---------------- */

const defaultState = () => ({
  view: "phone",                 // phone | web
  mode: "meet",                  // teams | code | ticket | meet | settings
  org: ORGS[0],
  theme: "obsidian",
  tickets: JSON.parse(JSON.stringify(SEED_TICKETS)),
  ticketSeq: 104,
  channels: JSON.parse(JSON.stringify(SEED_CHANNELS)),
  messages: seedMessages(),
  activeChannel: "engineering-core",
  teamTab: "channels",           // fav | channels | people
  meetingDocs: [],
  meet: { video: true, mic: true, nc: true, spatial: false, inCall: true },
  code: { branch: "feature/TICK-101-auth", file: "src/auth/v1_auth.go", diffTab: "same", c1: "a8f9c2", c2: "b3e104", fa: "src/auth/v1_auth.go", fab: "feature/TICK-101-auth", fb: "src/auth/v2_auth.go", fbb: "v2-refactor" },
  settings: {
    tenant: "Enterprise Org",
    twofa: true,
    notifCI: true, notifMentions: true, notifTickets: true,
    runtime: "Snapdragon Hexagon NPU - ONNX",
    offline: false,
  },
  ciLog: [],
});

let S = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = defaultState();
      const parsed = JSON.parse(raw);
      return { ...d, ...parsed, meet: { ...d.meet, ...(parsed.meet||{}) }, code: { ...d.code, ...(parsed.code||{}) }, settings: { ...d.settings, ...(parsed.settings||{}) } };
    }
  } catch (e) { /* corrupted state -> reset */ }
  return defaultState();
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }

/* Ephemeral (not persisted) */
const EPH = {
  orgMenuOpen: false,
  ciDrawerOpen: false,
  searchQ: "",
  voiceRunning: false,
  transcriptDone: S.meetingDocs.length > 0,
  actionBannerDismissed: false,
  aiExplainState: "idle",       // idle | running | done
  laser: { active: false, x: .5, y: .5, from: "local" },
  speakingIdx: 0,
};

/* Cross-tab laser + state sync */
let laserBC = null, stateBC = null;
try {
  laserBC = new BroadcastChannel("synapse-laser");
  laserBC.onmessage = (ev) => {
    const d = ev.data || {};
    EPH.laser = { active: !!d.active, x: d.x ?? .5, y: d.y ?? .5, from: "remote" };
    paintMirrors();
  };
  stateBC = new BroadcastChannel("synapse-state");
  stateBC.onmessage = () => { S = loadState(); render(); };
} catch (e) {}
function broadcastState() { try { stateBC && stateBC.postMessage("sync"); } catch (e) {} }

/* ---------------- Utilities ---------------- */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function nowClock() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toast(text, kind = "success", icon) {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  const ic = icon || (kind === "success" ? "✅" : kind === "error" ? "⛔" : "⚡");
  el.innerHTML = `<span class="t-ico">${ic}</span><span>${text}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 3400);
}

function openModal(html) {
  $("#modal-root").innerHTML = `<div class="modal-overlay" data-act="modal-overlay"><div class="modal">${html}</div></div>`;
}
function closeModal() { $("#modal-root").innerHTML = ""; }

/* Tiny markdown: **bold**, `code`, ```blocks``` */
function md(text) {
  let out = esc(text);
  out = out.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre>${code.trim()}</pre>`);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/\n/g, "<br>");
  return out;
}

/* LCS line diff */
function diffLines(aText, bText) {
  const a = (aText || "").split("\n"), b = (bText || "").split("\n");
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: "ctx", a: i + 1, b: j + 1, s: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: "del", a: i + 1, b: null, s: a[i] }); i++; }
    else { ops.push({ t: "add", a: null, b: j + 1, s: b[j] }); j++; }
  }
  while (i < n) { ops.push({ t: "del", a: i + 1, b: null, s: a[i] }); i++; }
  while (j < m) { ops.push({ t: "add", a: null, b: j + 1, s: b[j] }); j++; }
  return ops;
}

function setNPU(mode) {
  $$(".npu-chip").forEach(el => {
    el.classList.toggle("inferring", mode !== "idle");
    el.textContent = mode === "idle" ? "⚡ NPU 8-Elite: Idle" : `⚡ NPU 8-Elite: ${mode}`;
  });
}

function avatarHTML(pid, cls = "", withDot = false) {
  const p = person(pid);
  const dot = withDot ? `<span class="presence-dot ${p.presence}"></span>` : "";
  return `<span class="avatar ${cls}" style="background:${p.color}" title="${esc(p.name)}">${p.initials}${dot}</span>`;
}

function priBadge(pri) {
  const map = { Critical: "red", High: "amber", Medium: "cyan", Low: "grey" };
  return `<span class="badge ${map[pri] || "grey"}">${pri}</span>`;
}

function unreadFor(chId) { return (S.messages[chId] || []).filter(m => !m.read).length; }
function totalUnread() { return S.channels.reduce((s, c) => s + unreadFor(c.id), 0); }

/* ---------------- Bot / cross-hub integrations ---------------- */

function postBot(channelId, text) {
  if (!S.messages[channelId]) S.messages[channelId] = [];
  S.messages[channelId].push({ who: "bot", text, ts: Date.now(), read: S.mode === "teams" && S.activeChannel === channelId });
  save(); broadcastState();
}

function pushTicket({ title, assignee, priority, branch, fromMeet, col = "backlog", ci = null }) {
  const id = `TICK-${S.ticketSeq++}`;
  S.tickets.unshift({ id, title, assignee, priority, branch, col, fromMeet: !!fromMeet, ci });
  save(); broadcastState();
  return id;
}

/* ---------------- Top-level render ---------------- */

function render() {
  document.documentElement.dataset.theme = S.theme;
  document.body.classList.toggle("web-view", S.view === "web");
  const app = $("#app");
  app.innerHTML = `
    ${topbarHTML()}
    <div class="stage ${S.view === "web" ? "web-stage" : ""}">
      ${S.view === "phone" ? phoneHTML() : webHTML()}
    </div>
  `;
  afterRender();
}

function topbarHTML() {
  return `
  <div class="topbar">
    <div class="brand"><span class="bolt">⚡</span><span class="brand-name">Synapse<em>Dev</em></span></div>
    <div class="view-toggle">
      <button data-act="set-view" data-v="phone" class="${S.view === "phone" ? "active" : ""}">📱 Phone View <span class="dimtx">(iQOO 15)</span></button>
      <button data-act="set-view" data-v="web" class="${S.view === "web" ? "active" : ""}">💻 Web Companion</button>
    </div>
    <div class="searchwrap">
      <span class="sicon">🔍</span>
      <input id="global-search" placeholder="Search workspace… tickets, files, channels, people" value="${esc(EPH.searchQ)}" autocomplete="off" />
      ${EPH.searchQ ? searchResultsHTML() : ""}
    </div>
    <div class="org-switch">
      <button class="org-btn" data-act="toggle-org">🏢 ${esc(S.org)} <span class="dimtx">▾</span></button>
      ${EPH.orgMenuOpen ? `<div class="org-menu">${ORGS.map(o => `
        <button data-act="pick-org" data-org="${esc(o)}">🏢 <span>${esc(o)}</span> ${o === S.org ? '<span class="check">✓</span>' : ""}</button>`).join("")}
      </div>` : ""}
    </div>
    ${S.settings.offline ? `<span class="offline-pill">⛔ OFFLINE MODE</span>` : ""}
    <div class="quick-actions">
      <button class="icon-btn ${S.meet.inCall && S.meet.mic ? "live" : ""}" data-act="quick-call" title="Quick audio call">📞</button>
      <button class="icon-btn ${S.meet.inCall && S.meet.video ? "live" : ""}" data-act="quick-video" title="Quick video call">📹</button>
    </div>
  </div>`;
}

function searchResultsHTML() {
  const q = EPH.searchQ.toLowerCase();
  const res = [];
  S.tickets.forEach(t => { if ((t.id + " " + t.title).toLowerCase().includes(q)) res.push({ kind: "ticket", label: `${t.id} — ${t.title}`, act: "sr-ticket", data: t.id }); });
  REPO.files.forEach(f => { if (f.path.toLowerCase().includes(q)) res.push({ kind: "file", label: f.path, act: "sr-file", data: f.path }); });
  S.channels.forEach(c => { if (("#" + c.name).toLowerCase().includes(q)) res.push({ kind: "channel", label: "#" + c.name, act: "sr-channel", data: c.id }); });
  PEOPLE.forEach(p => { if (p.name.toLowerCase().includes(q)) res.push({ kind: "person", label: p.name, act: "sr-person", data: p.id }); });
  const items = res.slice(0, 8).map(r => `
    <div class="sr-item" data-act="${r.act}" data-data="${esc(r.data)}">
      <span class="sr-kind">${r.kind}</span><span>${esc(r.label)}</span>
    </div>`).join("");
  return `<div class="search-results">${items || `<div class="sr-empty">No matches in ${esc(S.org)} for “${esc(EPH.searchQ)}”</div>`}</div>`;
}

/* ---------------- Phone shell ---------------- */

const NAV = [
  { id: "teams",    label: "Teams",    icon: "💬", key: "1" },
  { id: "code",     label: "Code",     icon: "⌥",  key: "2" },
  { id: "ticket",   label: "Ticket",   icon: "🎯", key: "3" },
  { id: "meet",     label: "Meet",     icon: "📹", key: "4" },
  { id: "settings", label: "Settings", icon: "⚙️", key: "5" },
];

function phoneHTML() {
  return `
  <div class="phone-outer">
    <div class="phone">
      <div class="phone-screen">
        <div class="punch-hole"></div>
        <div class="statusbar">
          <span class="status-time">${nowClock()}</span>
          <span class="spacer"></span>
          <span class="npu-chip">⚡ NPU 8-Elite: Idle</span>
          <span>5G</span>
          <span>▂▄▆█</span>
          <span>🔋 87%</span>
        </div>
        <div class="phone-body" id="phone-body">
          ${modeHTML(S.mode)}
        </div>
        ${S.mode === "ticket" ? ciFabHTML() : ""}
        ${EPH.ciDrawerOpen && S.mode === "ticket" ? ciDrawerHTML() : ""}
        <div class="bottom-nav">
          ${NAV.map(n => `
            <button class="nav-item ${S.mode === n.id ? "active" : ""}" data-act="set-mode" data-m="${n.id}">
              <span class="kbd-hint">${n.key}</span>
              <span class="nico">${n.icon}</span>${n.label}
              ${n.id === "teams" && totalUnread() ? `<span class="nav-badge">${totalUnread()}</span>` : ""}
            </button>`).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

function modeHTML(mode) {
  switch (mode) {
    case "teams": return teamsHTML();
    case "code": return codeHTML();
    case "ticket": return ticketHTML();
    case "meet": return meetHTML();
    case "settings": return settingsHTML();
  }
  return "";
}

/* ---------------- Web companion shell ---------------- */

function webHTML() {
  const panel = (area, icon, title, body, extra = "") => `
    <div class="dock-panel dock-${area}" id="dock-${area}">
      <div class="dock-head"><span class="live-dot"></span> ${icon} ${title}
        <div class="dk-actions">${extra}<button class="mini-btn" data-act="dock-toggle" data-p="${area}">▾ dock</button></div>
      </div>
      <div class="dock-body" data-panel="${area}">${body}</div>
    </div>`;
  return `
  <div class="web-grid">
    ${panel("teams", "💬", "Team Hub", teamsHTML())}
    ${panel("meet", "📹", "Meet Hub — Live", meetHTML(true), `<button class="mini-btn" data-act="set-mode" data-m="settings">⚙️ Settings</button>`)}
    ${panel("tickets", "🎯", "Ticket Hub — Kanban", ticketHTML())}
    ${panel("code", "⌥", "Code Hub — Diff Engine", codeHTML())}
  </div>
  ${ciFabHTML()}
  ${EPH.ciDrawerOpen ? ciDrawerHTML() : ""}`;
}

/* ============================================================
   MODE 1 — MEET HUB
   ============================================================ */

function meetHTML(companion = false) {
  const m = S.meet;
  const tiles = [
    { pid: "you",  cam: m.video, mic: m.mic },
    { pid: "john", cam: true,    mic: true },
    { pid: "mia",  cam: true,    mic: false },
    { pid: "sam",  cam: false,   mic: true },
  ];
  const grads = { you: "linear-gradient(135deg,#083344,#0e7490)", john: "linear-gradient(135deg,#052e1f,#047857)", mia: "linear-gradient(135deg,#451a03,#b45309)", sam: "linear-gradient(135deg,#2e1065,#6d28d9)" };
  return `
  <div class="h-title">📹 Meet Hub ${m.inCall ? '<span class="badge green">● LIVE · 24:18</span>' : '<span class="badge grey">Call ended</span>'}</div>
  <div class="h-sub">Daily Standup — Auth Platform · E2E encrypted · On-device AI pipeline</div>

  ${m.inCall ? `
  <div class="video-grid" id="video-grid">
    ${tiles.map((t, i) => {
      const p = person(t.pid);
      return `
      <div class="vtile ${t.cam ? "" : "cam-off"}" data-tile="${i}">
        <div class="vt-bg" style="background:${grads[t.pid]}"></div>
        <div class="vt-avatar" style="background:${p.color}">${p.initials}</div>
        <div class="vt-tags">
          ${!t.mic ? `<span class="vt-tag">🔇 muted</span>` : ""}
          ${!t.cam ? `<span class="vt-tag">📷 off</span>` : ""}
        </div>
        <div class="vt-name">${t.pid === "you" ? "You" : esc(p.short)} <span class="wave" style="display:none"><i></i><i></i><i></i><i></i></span></div>
      </div>`;
    }).join("")}
  </div>

  <div class="call-controls">
    <button class="ctl-btn ${m.video ? "" : "off"}" data-act="meet-video" title="Toggle video">${m.video ? "📹" : "🚫"}<span class="ctl-lbl">Video</span></button>
    <button class="ctl-btn ${m.mic ? "" : "off"}" data-act="meet-mic" title="Toggle mic">${m.mic ? "🎙️" : "🔇"}<span class="ctl-lbl">Mic</span></button>
    <button class="ctl-btn ${m.nc ? "fx-on" : ""}" data-act="meet-nc" title="Noise cancellation">🌊<span class="ctl-lbl">Noise NC</span></button>
    <button class="ctl-btn ${m.spatial ? "fx-on" : ""}" data-act="meet-spatial" title="Spatial audio">🎧<span class="ctl-lbl">Spatial</span></button>
    <button class="ctl-btn end" data-act="meet-end" title="End call">📞<span class="ctl-lbl">End</span></button>
  </div>
  <div class="fx-badges">
    ${m.nc ? '<span class="badge green">🌊 Noise Cancellation ON</span>' : '<span class="badge grey">🌊 Noise Cancellation OFF</span>'}
    ${m.spatial ? '<span class="badge green">🎧 Spatial Audio ON</span>' : '<span class="badge grey">🎧 Spatial Audio OFF</span>'}
  </div>` : `
  <div class="empty-state card">
    <div class="es-icon">📵</div>
    <div class="es-title">You left the standup</div>
    <div class="es-sub">The meeting doc and action items were preserved below.</div>
    <button class="btn primary sm" data-act="meet-rejoin" style="margin-top:10px">↩ Rejoin call</button>
  </div>`}

  <div class="section-label">🔦 Access-to-Pointer — shared screen (drag to point)</div>
  <div class="laser-stage" id="laser-stage">
    <div class="fake-ui">
      <div class="fl" style="width:42%"></div><div class="fl" style="width:88%"></div>
      <div class="fl" style="width:74%"></div><div class="fl" style="width:60%"></div>
      <div class="fl" style="width:81%"></div><div class="fl" style="width:35%"></div>
    </div>
    <div class="laser-coords" id="laser-coords">(x: —, y: —) · broadcasting to companion</div>
    <div class="laser-dot" id="laser-dot" style="display:none"></div>
    <div class="laser-label" id="laser-label" style="display:none">👤 You (Laser)</div>
  </div>

  ${companion ? `
  <div class="section-label">🖥️ Companion mirror — receives (X, Y) in real time</div>
  <div class="mirror-stage" data-mirror>
    <div class="mirror-coords" data-mirror-coords>awaiting stream…</div>
    <div class="mirror-hint">Drag on any laser canvas (this tab or the phone tab)<br>and the pointer is mirrored here live.</div>
    <div class="laser-dot remote" data-mirror-dot style="display:none"></div>
    <div class="laser-label" data-mirror-label style="display:none;background:var(--emerald)">👤 You (Laser)</div>
  </div>` : ""}

  <div class="section-label">🎙️ Voice-to-Action AI engine</div>
  <div class="card flat">
    <button class="btn primary block" data-act="voice-sim" ${EPH.voiceRunning ? "disabled" : ""}>
      ${EPH.voiceRunning ? "🎙️ Listening…" : "🎙️ Simulate Voice Input"}
    </button>
    <div class="transcript-box" id="transcript-box" style="${EPH.transcriptDone || EPH.voiceRunning ? "" : "display:none"}">
      <span class="t-label">[LIVE TRANSCRIPT · whisper-tiny @ NPU]</span><br>
      <span id="transcript-text">${EPH.transcriptDone ? esc(TRANSCRIPT_TEXT) : ""}</span>${EPH.voiceRunning ? '<span class="cursor"></span>' : ""}
    </div>
    <div id="npu-pipeline-banner"></div>
    <div id="meet-artifacts">${EPH.transcriptDone ? meetArtifactsHTML() : ""}</div>
  </div>

  ${S.meetingDocs.length === 0 && !EPH.transcriptDone ? `
  <div class="empty-state">
    <div class="es-icon">📄</div>
    <div class="es-title">No meeting docs yet</div>
    <div class="es-sub">Tap <b>Simulate Voice Input</b> to run the on-device<br>transcribe → summarize → auto-ticket pipeline.</div>
  </div>` : ""}`;
}

function meetArtifactsHTML() {
  const ticketAlready = S.tickets.some(t => t.fromMeet && /auth middleware/i.test(t.title));
  return `
  <div class="summary-doc">
    <div class="doc-head">📄 standup_2026-08-27.md · generated on-device · Gemma-2B-INT4 <span style="margin-left:auto" class="badge violet">✨ AI</span></div>
    <h4>🗒️ Agenda</h4>
    <ul><li>Daily standup — Auth Platform squad</li><li>Auth middleware stability & CI health</li></ul>
    <h4>✅ Decisions</h4>
    <ul>
      <li>Confirmed <b>race condition</b> in the auth middleware session path.</li>
      <li>Migrate <code>v1/auth_handler.go</code> → <code>v2/auth_controller.go</code>.</li>
    </ul>
    <h4>⚡ Action Items</h4>
    <ul>
      <li><b>John</b>: refactor auth middleware to v2 controller — <b>due today</b>.</li>
      <li><b>John</b>: verify <b>Jenkins</b> build passes on the refactor branch.</li>
    </ul>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm" data-act="export-md">⬇ Export Markdown / PDF</button>
      <button class="btn sm" data-act="open-standup-channel">💬 View in #standup-notes</button>
    </div>
  </div>
  ${!ticketAlready && !EPH.actionBannerDismissed ? `
  <div class="action-banner">
    <span style="font-size:18px">⚡</span>
    <div class="ab-txt"><b>Action Item Detected:</b> Refactor auth middleware<br><span class="dimtx">assignee: John · priority: High · link: feature branch</span></div>
    <button class="btn success sm" data-act="auto-ticket">Auto-Create Ticket</button>
  </div>` : ticketAlready ? `
  <div class="action-banner" style="border-color:var(--border2);box-shadow:none;background:var(--panel3)">
    <span style="font-size:16px">✅</span>
    <div class="ab-txt">Ticket created from this doc — see <b>Ticket Hub</b> <span class="badge violet">✨ Created from Meet Doc</span></div>
  </div>` : ""}`;
}

/* Voice pipeline simulation */
function runVoiceSim() {
  if (EPH.voiceRunning) return;
  EPH.voiceRunning = true;
  EPH.transcriptDone = false;
  EPH.actionBannerDismissed = false;
  renderPanels();
  setNPU("Listening…");
  const target = $("#transcript-text");
  if (!target) return;
  let i = 0;
  const timer = setInterval(() => {
    i += 1 + Math.floor(Math.random() * 2);
    if (i >= TRANSCRIPT_TEXT.length) {
      i = TRANSCRIPT_TEXT.length;
      clearInterval(timer);
      finishTranscription();
    }
    const el = $("#transcript-text");
    if (el) el.textContent = TRANSCRIPT_TEXT.slice(0, i);
  }, 28);
}

function finishTranscription() {
  setNPU("Inferring");
  const banner = $("#npu-pipeline-banner");
  if (banner) banner.innerHTML = `<div class="npu-banner"><span class="spinner"></span>⚡ NPU Hexagon Engine: Transcribing &amp; Parsing…</div>`;
  setTimeout(() => {
    EPH.voiceRunning = false;
    EPH.transcriptDone = true;
    setNPU("idle");
    if (!S.meetingDocs.length) {
      S.meetingDocs.push({ id: "DOC-" + Date.now(), title: "standup_2026-08-27.md", ts: Date.now() });
      postBot("standup-notes", "🤖 **SynapseBot** · Meet summary finalized: `standup_2026-08-27.md`\n**Action item:** John → refactor `v1/auth_handler.go` → `v2/auth_controller.go`, verify Jenkins build. ✨ Generated fully on-device (Gemma-2B-INT4).");
      save(); broadcastState();
    }
    renderPanels();
    toast("Meeting summary generated on-device (0 bytes left the phone)", "info", "✨");
  }, 1800);
}

function autoCreateTicket() {
  const id = pushTicket({
    title: "Refactor auth middleware: v1/auth_handler.go → v2/auth_controller.go",
    assignee: "john", priority: "High", branch: "feature/TICK-101-auth",
    fromMeet: true, col: "backlog",
  });
  postBot("ci-alerts", `🎫 **${id}** created from Meet doc · assigned **John Doe** · linked \`feature/TICK-101-auth\`.`);
  toast(`Ticket ${id} created and assigned to John`, "success", "🎫");
  renderPanels();
}

function exportMarkdown() {
  const mdDoc = `# Standup — Auth Platform (2026-08-27)

## Agenda
- Daily standup — Auth Platform squad
- Auth middleware stability & CI health

## Decisions
- Confirmed race condition in the auth middleware session path.
- Migrate \`v1/auth_handler.go\` → \`v2/auth_controller.go\`.

## Action Items
- [ ] **John** — refactor auth middleware to v2 controller (due today)
- [ ] **John** — verify Jenkins build passes on refactor branch

_Generated on-device by SynapseDev · Gemma-2B-INT4 @ Snapdragon Hexagon NPU_
`;
  const blob = new Blob([mdDoc], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "standup_2026-08-27.md";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("standup_2026-08-27.md exported", "info", "⬇");
}

/* Laser pointer */
function bindLaser() {
  $$(".laser-stage").forEach(stage => {
    const dot = stage.querySelector(".laser-dot");
    const label = stage.querySelector(".laser-label");
    const coords = stage.querySelector(".laser-coords");
    let down = false;
    const move = (e) => {
      const r = stage.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
      dot.style.display = label.style.display = "block";
      dot.style.left = label.style.left = x + "px";
      dot.style.top = label.style.top = y + "px";
      const nx = +(x / r.width).toFixed(3), ny = +(y / r.height).toFixed(3);
      coords.textContent = `(x: ${nx}, y: ${ny}) · broadcasting to companion`;
      // trail
      const tr = document.createElement("div");
      tr.className = "laser-trail";
      tr.style.left = x + "px"; tr.style.top = y + "px";
      stage.appendChild(tr);
      setTimeout(() => tr.remove(), 520);
      EPH.laser = { active: true, x: nx, y: ny, from: "local" };
      try { laserBC && laserBC.postMessage({ active: true, x: nx, y: ny }); } catch (err) {}
      paintMirrors();
    };
    stage.addEventListener("pointerdown", e => { down = true; stage.setPointerCapture(e.pointerId); move(e); });
    stage.addEventListener("pointermove", e => { if (down) move(e); });
    const up = () => {
      down = false;
      setTimeout(() => {
        if (!down) {
          dot.style.display = label.style.display = "none";
          coords.textContent = "(x: —, y: —) · broadcasting to companion";
          EPH.laser.active = false;
          try { laserBC && laserBC.postMessage({ active: false }); } catch (err) {}
          paintMirrors();
        }
      }, 350);
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
  });
}

function paintMirrors() {
  $$("[data-mirror]").forEach(mir => {
    const dot = mir.querySelector("[data-mirror-dot]");
    const label = mir.querySelector("[data-mirror-label]");
    const coords = mir.querySelector("[data-mirror-coords]");
    const hint = mir.querySelector(".mirror-hint");
    if (!dot) return;
    if (EPH.laser.active) {
      const r = mir.getBoundingClientRect();
      dot.style.display = label.style.display = "block";
      if (hint) hint.style.display = "none";
      dot.style.left = label.style.left = (EPH.laser.x * r.width) + "px";
      dot.style.top = label.style.top = (EPH.laser.y * r.height) + "px";
      coords.textContent = `RX (x: ${EPH.laser.x}, y: ${EPH.laser.y}) · ${EPH.laser.from === "remote" ? "from phone tab" : "local echo"} · <8ms`;
    } else {
      dot.style.display = label.style.display = "none";
      if (hint) hint.style.display = "grid";
      coords.textContent = "awaiting stream…";
    }
  });
}

/* ============================================================
   MODE 2 — TICKET HUB
   ============================================================ */

function ticketHTML() {
  return `
  <div class="h-title">🎯 Ticket Hub <span class="badge cyan">${S.tickets.length} tickets</span></div>
  <div class="h-sub">Kanban · universal CI/CD hooks (Jenkins · Woodpecker) · drag cards or tap to move</div>
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button class="btn primary sm" data-act="new-ticket">＋ New Ticket</button>
    <button class="btn sm" data-act="toggle-ci-drawer">🛠️ CI/CD Webhook Simulator</button>
  </div>
  <div class="kanban">
    ${KANBAN_COLS.map(col => {
      const cards = S.tickets.filter(t => t.col === col.id);
      return `
      <div class="kcol" data-col="${col.id}">
        <div class="kcol-head">${col.icon} ${col.label} <span class="count">${cards.length}</span></div>
        <div class="kcol-body">
          ${cards.length ? cards.map(tcardHTML).join("") : `<div class="kcol-empty">Drop tickets here<br>·<br>empty column</div>`}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function tcardHTML(t) {
  return `
  <div class="tcard" draggable="true" data-ticket="${t.id}" data-act="open-ticket" data-id="${t.id}">
    <div class="trow"><span class="tid">${t.id}</span>
      ${t.fromMeet ? '<span class="badge violet">✨ Created from Meet Doc</span>' : ""}
    </div>
    <div class="ttitle">${esc(t.title)}</div>
    <div class="trow">
      ${avatarHTML(t.assignee)}
      ${priBadge(t.priority)}
      ${t.ci ? `<span class="badge ${t.ci.state === "passed" ? "green" : t.ci.state === "failed" ? "red" : "amber"}">${esc(t.ci.label)}</span>` : ""}
    </div>
    <div class="tbranch">⎇ ${esc(t.branch)}</div>
  </div>`;
}

function ciFabHTML() {
  return `<button class="ci-drawer-fab" data-act="toggle-ci-drawer">🛠️ CI/CD Webhook Simulator</button>`;
}

function ciDrawerHTML() {
  return `
  <div class="ci-drawer">
    <div style="display:flex;align-items:center;margin-bottom:10px">
      <b style="font-size:13px">🛠️ CI/CD Webhook Simulator</b>
      <button class="mini-btn" style="margin-left:auto;background:var(--panel3);border:1px solid var(--border2);border-radius:7px;color:var(--muted);padding:3px 8px" data-act="toggle-ci-drawer">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn success sm" data-act="ci-jenkins">▶ Trigger Jenkins Webhook: TICK-101 (Success)</button>
      <button class="btn danger sm" data-act="ci-woodpecker">▶ Trigger Woodpecker Runner: TICK-102 (Failed)</button>
    </div>
    <div class="ci-log">
      ${S.ciLog.length ? S.ciLog.map(l => `<div class="lg-line ${l.cls || ""}">${esc(l.text)}</div>`).join("") : '<div class="lg-line lg-info">$ webhook listener ready on :9099 …</div>'}
    </div>
  </div>`;
}

function ciLog(text, cls) {
  S.ciLog.push({ text, cls });
  if (S.ciLog.length > 30) S.ciLog = S.ciLog.slice(-30);
  save();
}

function moveTicket(id, col, animate = true) {
  const t = S.tickets.find(x => x.id === id);
  if (!t || t.col === col) return;
  t.col = col;
  t.justMoved = animate;
  save(); broadcastState();
  renderPanels();
  setTimeout(() => { delete t.justMoved; }, 700);
}

function triggerJenkins() {
  const t = S.tickets.find(x => x.id === "TICK-101");
  if (!t) return;
  ciLog("→ POST /hooks/jenkins  payload={job:842, ref:feature/TICK-101-auth}", "lg-info");
  ciLog("Jenkins #842 · checkout ✓ · go vet ✓ · go test -race ✓ (312 tests)");
  toast("Jenkins webhook received: build #842 SUCCESS", "info", "🟢");
  t.col = "inprogress"; t.ci = { state: "running", label: "⏳ CI Running (Jenkins #842)" };
  save(); renderPanels();
  setTimeout(() => {
    moveTicket("TICK-101", "citest");
    toast("TICK-101 → CI / Test (pipeline verifying)", "info", "🧪");
  }, 900);
  setTimeout(() => {
    t.ci = { state: "passed", label: "✅ CI Passed (Jenkins #842)" };
    moveTicket("TICK-101", "done");
    ciLog("Jenkins #842 · SUCCESS in 3m 41s → TICK-101 auto-closed", "");
    postBot("ci-alerts", "🟢 **Jenkins #842** succeeded · `feature/TICK-101-auth` · 3m 41s · **TICK-101** auto-moved to **Done**. ✅");
    toast("✅ TICK-101 Done — CI Passed (Jenkins #842)", "success");
    renderPanels();
  }, 2300);
}

function triggerWoodpecker() {
  const t = S.tickets.find(x => x.id === "TICK-102");
  if (!t) return;
  ciLog("→ POST /hooks/woodpecker  payload={run:77, ref:fix/TICK-102-runner}", "lg-info");
  ciLog("Woodpecker #77 · arm64 stage 4/5 FAILED: cache mount timeout", "lg-fail");
  t.ci = { state: "failed", label: "❌ CI Failed (Woodpecker #77)" };
  t.col = "inprogress"; t.justMoved = true;
  save(); broadcastState();
  postBot("ci-alerts", "🔴 **Woodpecker #77** failed · `fix/TICK-102-runner` · stage `test-arm64` — cache mount timeout. **TICK-102** moved back to **In Progress**.");
  toast("❌ Woodpecker #77 failed — TICK-102 returned to In Progress", "error");
  renderPanels();
  setTimeout(() => { delete t.justMoved; }, 700);
}

function openTicketModal(id) {
  const t = S.tickets.find(x => x.id === id);
  if (!t) return;
  openModal(`
    <h3><span class="tid mono" style="color:var(--cyan)">${t.id}</span> ${t.fromMeet ? '<span class="badge violet">✨ Created from Meet Doc</span>' : ""}</h3>
    <div class="m-sub">${esc(t.title)}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      ${avatarHTML(t.assignee)} <b style="font-size:12px">${esc(person(t.assignee).name)}</b>
      ${priBadge(t.priority)}
      ${t.ci ? `<span class="badge ${t.ci.state === "passed" ? "green" : t.ci.state === "failed" ? "red" : "amber"}">${esc(t.ci.label)}</span>` : ""}
    </div>
    <div class="tbranch" style="margin-bottom:14px">⎇ ${esc(t.branch)} · <span class="dimtx">linked in Code Hub</span></div>
    <div class="section-label" style="margin-top:0">Move to column</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
      ${KANBAN_COLS.map(c => `<button class="btn sm ${t.col === c.id ? "primary" : ""}" data-act="modal-move" data-id="${t.id}" data-col="${c.id}">${c.icon} ${c.label}</button>`).join("")}
    </div>
    <div class="m-actions">
      <button class="btn danger sm" data-act="delete-ticket" data-id="${t.id}">🗑 Delete</button>
      <button class="btn sm" data-act="close-modal">Close</button>
    </div>`);
}

function newTicketModal() {
  openModal(`
    <h3>＋ Create Ticket</h3>
    <div class="m-sub">Manually file a ticket into the ${esc(S.org)} board.</div>
    <div class="field"><label>Title</label><input id="nt-title" placeholder="e.g. Harden token refresh path" /></div>
    <div class="field"><label>Assignee</label>
      <select id="nt-assignee">${PEOPLE.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Priority</label>
      <select id="nt-priority"><option>Critical</option><option selected>High</option><option>Medium</option><option>Low</option></select></div>
    <div class="field"><label>Linked Git branch</label><input id="nt-branch" placeholder="feature/TICK-…" value="feature/" /></div>
    <div class="m-actions">
      <button class="btn" data-act="close-modal">Cancel</button>
      <button class="btn primary" data-act="create-ticket">Create Ticket</button>
    </div>`);
}

/* Drag & drop */
function bindKanbanDnD() {
  $$(".tcard").forEach(card => {
    card.addEventListener("dragstart", e => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", card.dataset.ticket);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  $$(".kcol").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", e => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      if (id) {
        moveTicket(id, col.dataset.col);
        toast(`${id} moved to ${KANBAN_COLS.find(c => c.id === col.dataset.col).label}`, "info", "🎯");
      }
    });
  });
}

/* ============================================================
   MODE 3 — CODE HUB
   ============================================================ */

function codeHTML() {
  const c = S.code;
  const dirs = {};
  REPO.files.forEach(f => { (dirs[f.dir] = dirs[f.dir] || []).push(f); });
  const activeFile = REPO.files.find(f => f.path === c.file);
  const fileContent = activeFile ? activeFile.byBranch[c.branch] : null;

  return `
  <div class="h-title">⌥ Code Hub <span class="badge cyan mono">acme/auth-service</span></div>
  <div class="h-sub">Version control · commit history · dual-mode diff engine · on-device AI explainer</div>

  <div class="repo-bar">
    <div class="branch-select">⎇ <select data-act-change="repo-branch">
      ${REPO.branches.map(b => `<option ${b === c.branch ? "selected" : ""}>${b}</option>`).join("")}
    </select></div>
    <button class="btn sm" data-act="new-branch">＋ Branch</button>
  </div>

  <div class="card flat">
    <div class="section-label" style="margin-top:0">📁 Repository files</div>
    <div class="file-tree">
      ${Object.entries(dirs).map(([dir, files]) => `
        <div class="ft-dir">📂 ${esc(dir)}/</div>
        ${files.map(f => {
          const missing = f.byBranch[c.branch] == null;
          return `<div class="ft-file ${c.file === f.path ? "active" : ""}" data-act="pick-file" data-f="${esc(f.path)}" style="${missing ? "opacity:.4" : ""}">
            📄 ${esc(f.path.split("/").pop())} ${missing ? '<span class="badge grey">not on branch</span>' : ""} <span class="fsize">${f.size}</span>
          </div>`;
        }).join("")}`).join("")}
    </div>
  </div>

  <div class="card flat">
    <div class="section-label" style="margin-top:0">🕘 Commit history</div>
    ${REPO.commits.map(cm => `
      <div class="commit-row">
        <span class="commit-hash">${cm.hash}</span>
        <div><div class="commit-msg">${esc(cm.msg)}</div>
        <div class="commit-meta">${esc(cm.author)} · ${cm.when} · ⎇ ${esc(cm.branch)}</div></div>
      </div>`).join("")}
  </div>

  <div class="section-label">🔀 Dual-mode diff tool</div>
  <div class="tabs">
    <button class="${c.diffTab === "same" ? "active" : ""}" data-act="diff-tab" data-t="same">Same-File Commit Diff</button>
    <button class="${c.diffTab === "cross" ? "active" : ""}" data-act="diff-tab" data-t="cross">Cross-File Diff</button>
  </div>

  ${c.diffTab === "same" ? `
  <div class="diff-controls">
    <select class="diff-select" data-act-change="diff-c1">
      ${REPO.commits.filter(x => x.snapshot !== CI_YML).map(x => `<option value="${x.hash}" ${x.hash === c.c1 ? "selected" : ""}>c1: ${x.hash} · ${esc(x.msg.slice(0, 26))}…</option>`).join("")}
    </select>
    <span class="vs">⇢</span>
    <select class="diff-select" data-act-change="diff-c2">
      ${REPO.commits.filter(x => x.snapshot !== CI_YML).map(x => `<option value="${x.hash}" ${x.hash === c.c2 ? "selected" : ""}>c2: ${x.hash} · ${esc(x.msg.slice(0, 26))}…</option>`).join("")}
    </select>
  </div>
  ${renderDiff(commitSnap(c.c1), commitSnap(c.c2), `src/auth/v1_auth.go @ ${c.c1}`, `@ ${c.c2}`)}` : `
  <div class="diff-controls">
    <div>
      <select class="diff-select" data-act-change="diff-fa" style="margin-bottom:5px">
        ${REPO.files.map(f => `<option value="${esc(f.path)}" ${f.path === c.fa ? "selected" : ""}>A: ${esc(f.path)}</option>`).join("")}
      </select>
      <select class="diff-select" data-act-change="diff-fab">
        ${REPO.branches.map(b => `<option ${b === c.fab ? "selected" : ""}>⎇ ${b}</option>`).join("")}
      </select>
    </div>
    <span class="vs">⇢</span>
    <div>
      <select class="diff-select" data-act-change="diff-fb" style="margin-bottom:5px">
        ${REPO.files.map(f => `<option value="${esc(f.path)}" ${f.path === c.fb ? "selected" : ""}>B: ${esc(f.path)}</option>`).join("")}
      </select>
      <select class="diff-select" data-act-change="diff-fbb">
        ${REPO.branches.map(b => `<option ${b === c.fbb ? "selected" : ""}>⎇ ${b}</option>`).join("")}
      </select>
    </div>
  </div>
  ${renderDiff(fileSnap(c.fa, c.fab), fileSnap(c.fb, c.fbb), `${c.fa} @ ${c.fab}`, `${c.fb} @ ${c.fbb}`)}`}

  <div id="ai-explain-zone">${aiExplainHTML()}</div>

  ${fileContent != null ? `
  <div class="section-label">👁 Viewing <span class="mono" style="color:var(--cyan)">${esc(c.file)}</span> @ ${esc(c.branch)}</div>
  <div class="diff-view"><div class="diff-body">${fileContent.split("\n").map((l, i) => `
    <div class="diff-line"><span class="ln">${i + 1}</span><span class="op"></span><span class="txt">${esc(l) || " "}</span></div>`).join("")}
  </div></div>` : `
  <div class="empty-state card">
    <div class="es-icon">🌿</div>
    <div class="es-title">File not on this branch</div>
    <div class="es-sub"><span class="mono">${esc(c.file)}</span> doesn't exist on <span class="mono">${esc(c.branch)}</span>.<br>Switch to <span class="mono">v2-refactor</span> to view it.</div>
  </div>`}`;
}

function commitSnap(hash) { const cm = REPO.commits.find(x => x.hash === hash); return cm ? cm.snapshot : ""; }
function fileSnap(path, branch) {
  const f = REPO.files.find(x => x.path === path);
  return f ? (f.byBranch[branch] ?? `// ${path}\n// (file does not exist on branch ${branch})`) : "";
}

function renderDiff(aText, bText, labelA, labelB) {
  const ops = diffLines(aText, bText);
  const adds = ops.filter(o => o.t === "add").length;
  const dels = ops.filter(o => o.t === "del").length;
  // collapse long unchanged runs into hunks
  const rows = [];
  let run = [];
  const flushRun = () => {
    if (run.length > 6) {
      rows.push(run[0], run[1]);
      rows.push({ t: "hunk", s: `@@ … ${run.length - 4} unchanged lines … @@` });
      rows.push(run[run.length - 2], run[run.length - 1]);
    } else rows.push(...run);
    run = [];
  };
  ops.forEach(o => { if (o.t === "ctx") run.push(o); else { flushRun(); rows.push(o); } });
  flushRun();

  return `
  <div class="diff-view">
    <div class="diff-head">
      <span>🔀 <b>${esc(labelA)}</b> ⇢ <b>${esc(labelB)}</b></span>
      <span style="margin-left:auto"><span class="diff-stat-add">+${adds}</span> / <span class="diff-stat-del">−${dels}</span></span>
      <button class="btn sm" style="border-color:var(--violet);color:#b79bff" data-act="ai-explain">✨ AI Explain Diff (Qwen-Coder)</button>
    </div>
    <div class="diff-body">
      ${rows.map(o => o.t === "hunk"
        ? `<div class="diff-line hunk">${esc(o.s)}</div>`
        : `<div class="diff-line ${o.t === "add" ? "add" : o.t === "del" ? "del" : ""}">
             <span class="ln">${o.a ?? ""}</span><span class="ln">${o.b ?? ""}</span>
             <span class="op">${o.t === "add" ? "+" : o.t === "del" ? "−" : ""}</span>
             <span class="txt">${esc(o.s) || " "}</span>
           </div>`).join("")}
    </div>
  </div>`;
}

function aiExplainHTML() {
  if (EPH.aiExplainState === "running")
    return `<div class="npu-banner"><span class="spinner"></span>⚡ NPU Hexagon Engine: Qwen-Coder-1.5B INT4 · semantic diff pass… 33 tok/s · 0% cloud</div>`;
  if (EPH.aiExplainState === "done")
    return `
    <div class="ai-explain">
      <h5>✨ Semantic Diff — Qwen-Coder @ Hexagon NPU <span class="badge violet" style="margin-left:auto">on-device · 1.4s</span></h5>
      <div class="aie-item"><b>🔴 Breaking Change:</b><span><code>ValidateToken()</code> now requires a structured <code>context.Context</code> parameter — all 14 call sites must be updated.</span></div>
      <div class="aie-item"><b>🛡️ Security Update:</b><span>Deprecated <code>SHA-1</code> token digest replaced with <code>Argon2id</code> hashing (memory-hard, side-channel resistant).</span></div>
      <div class="aie-item"><b>🟢 Risk Assessment:</b><span>Zero breaking regressions detected against the race-enabled test suite (312/312 pass with <code>-race</code>).</span></div>
    </div>`;
  return "";
}

function runAiExplain() {
  if (EPH.aiExplainState === "running") return;
  EPH.aiExplainState = "running";
  setNPU("Inferring");
  $$("#ai-explain-zone").forEach(z => z.innerHTML = aiExplainHTML());
  setTimeout(() => {
    EPH.aiExplainState = "done";
    setNPU("idle");
    $$("#ai-explain-zone").forEach(z => z.innerHTML = aiExplainHTML());
    toast("Semantic diff computed on-device — nothing sent to the cloud", "info", "✨");
  }, 1700);
}

function newBranchModal() {
  openModal(`
    <h3>＋ Create Branch</h3>
    <div class="m-sub">Cut a new branch from <span class="mono" style="color:var(--cyan)">${esc(S.code.branch)}</span>.</div>
    <div class="field"><label>Branch name</label><input id="nb-name" placeholder="feature/TICK-105-…" value="feature/" /></div>
    <div class="m-actions">
      <button class="btn" data-act="close-modal">Cancel</button>
      <button class="btn primary" data-act="create-branch">⎇ Create</button>
    </div>`);
}

/* ============================================================
   MODE 4 — TEAM HUB
   ============================================================ */

function teamsHTML() {
  const tab = S.teamTab;
  return `
  <div class="h-title">💬 Team Hub ${totalUnread() ? `<span class="badge red">${totalUnread()} unread</span>` : ""}</div>
  <div class="h-sub">Channels · DMs · presence · auto-bot CI &amp; Meet alerts</div>
  <div class="team-tabs">
    <button class="${tab === "fav" ? "active" : ""}" data-act="team-tab" data-t="fav">⭐ Favorites</button>
    <button class="${tab === "channels" ? "active" : ""}" data-act="team-tab" data-t="channels"># Channels</button>
    <button class="${tab === "people" ? "active" : ""}" data-act="team-tab" data-t="people">👥 Directory</button>
  </div>
  ${tab === "people" ? directoryHTML() : channelListHTML(tab === "fav")}
  ${tab !== "people" ? chatHTML() : ""}`;
}

function channelListHTML(favOnly) {
  const chans = S.channels.filter(c => !favOnly || c.fav);
  if (!chans.length) return `
    <div class="empty-state">
      <div class="es-icon">⭐</div>
      <div class="es-title">No favorites yet</div>
      <div class="es-sub">Star a channel from the Channels tab to pin it here.</div>
    </div>`;
  return `
  <div class="card flat" style="padding:7px">
    ${chans.map(c => `
      <div class="chan-item ${S.activeChannel === c.id ? "active" : ""}" data-act="pick-channel" data-c="${c.id}">
        <span class="chan-hash">#</span>
        <span class="cname">${esc(c.name)}<span class="cdesc">${esc(c.desc)}</span></span>
        <button class="mini-btn" style="background:none;border:0;font-size:13px;cursor:pointer;color:${c.fav ? "var(--amber)" : "var(--dim)"}" data-act="fav-channel" data-c="${c.id}" title="Toggle favorite">${c.fav ? "★" : "☆"}</button>
        ${unreadFor(c.id) ? `<span class="unread-pip">${unreadFor(c.id)}</span>` : ""}
      </div>`).join("")}
    <div class="chan-item" data-act="new-channel" style="color:var(--cyan)">
      <span class="chan-hash">＋</span><span class="cname" style="color:var(--cyan)">Create channel</span>
    </div>
  </div>`;
}

function chatHTML() {
  const ch = S.channels.find(c => c.id === S.activeChannel) || S.channels[0];
  if (!ch) return "";
  const msgs = S.messages[ch.id] || [];
  msgs.forEach(m => m.read = true);
  save();
  return `
  <div class="card" style="display:flex;flex-direction:column;min-height:300px">
    <div class="chat-header">
      <span class="chan-hash">#</span><b>${esc(ch.name)}</b>
      <span class="dimtx" style="font-size:11px">· ${esc(ch.desc)}</span>
    </div>
    <div class="chat-msgs" id="chat-msgs-${ch.id}">
      ${msgs.length ? msgs.map(m => {
        const isBot = m.who === "bot";
        const p = isBot ? null : person(m.who);
        return `
        <div class="msg ${isBot ? "bot" : ""} ${m.who === "you" ? "me" : ""}">
          ${isBot ? `<span class="avatar" style="background:var(--emerald)">🤖</span>` : avatarHTML(m.who, "", true)}
          <div class="m-body">
            <div class="m-meta"><span class="m-name">${isBot ? "SynapseBot" : m.who === "you" ? "You" : esc(p.name)}</span><span class="m-time">${fmtTime(m.ts)}</span></div>
            <div class="m-text">${md(m.text)}</div>
            ${m.who === "you" ? `<div class="m-receipt">✓✓ Read by 3</div>` : ""}
          </div>
        </div>`;
      }).join("") : `
      <div class="empty-state">
        <div class="es-icon">🌱</div>
        <div class="es-title">#${esc(ch.name)} is brand new</div>
        <div class="es-sub">Be the first to post. Markdown &amp; \`code\` supported.<br>Bots will drop CI and Meet alerts here automatically.</div>
      </div>`}
    </div>
    <div class="chat-input">
      <input id="chat-input-field" placeholder="Message #${esc(ch.name)} — **md**, \`code\`, \`\`\`blocks\`\`\`" />
      <button class="btn primary" data-act="send-msg">➤</button>
    </div>
  </div>`;
}

function directoryHTML() {
  const pres = { online: ["Online", "green"], inmeet: ["In Meet", "amber"], offline: ["Offline", "grey"] };
  return `
  <div class="card flat" style="padding:7px">
    ${PEOPLE.map(p => `
      <div class="person-row">
        ${avatarHTML(p.id, "lg", true)}
        <div class="p-info"><div class="p-name">${esc(p.name)}</div><div class="p-role">${esc(p.role)}</div></div>
        <span class="badge ${pres[p.presence][1]}">● ${pres[p.presence][0]}</span>
      </div>`).join("")}
  </div>`;
}

function sendChatMessage() {
  const input = $("#chat-input-field") || document.getElementById("chat-input-field");
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  if (!S.messages[S.activeChannel]) S.messages[S.activeChannel] = [];
  S.messages[S.activeChannel].push({ who: "you", text, ts: Date.now(), read: true });
  save(); broadcastState();
  renderPanels();
  // simulated teammate reaction in #engineering-core
  if (S.activeChannel === "engineering-core") {
    setTimeout(() => {
      S.messages["engineering-core"].push({ who: "john", text: "👍 On it — pushing to `feature/TICK-101-auth` shortly.", ts: Date.now(), read: S.activeChannel === "engineering-core" });
      save(); broadcastState(); renderPanels();
    }, 1600);
  }
}

function newChannelModal() {
  openModal(`
    <h3>＋ Create Channel</h3>
    <div class="m-sub">Spin up a channel in ${esc(S.org)}.</div>
    <div class="field"><label>Channel name</label><input id="nc-name" placeholder="e.g. npu-benchmarks" /></div>
    <div class="field"><label>Description</label><input id="nc-desc" placeholder="What is it for?" /></div>
    <div class="m-actions">
      <button class="btn" data-act="close-modal">Cancel</button>
      <button class="btn primary" data-act="create-channel">Create</button>
    </div>`);
}

/* ============================================================
   MODE 5 — SETTINGS
   ============================================================ */

function settingsHTML() {
  const st = S.settings;
  const sw = (key, title, sub) => `
    <div class="switchrow">
      <div class="sw-txt"><b>${title}</b><span>${sub}</span></div>
      <button class="toggle ${st[key] ? "on" : ""}" data-act="setting-toggle" data-k="${key}" aria-label="${title}"></button>
    </div>`;
  return `
  <div class="h-title">⚙️ Settings</div>
  <div class="h-sub">Workspace, notifications, on-device AI runtime &amp; theming</div>

  <div class="card setting-card">
    <h4>👤 Account</h4>
    <div style="display:flex;align-items:center;gap:11px;margin:10px 0 4px">
      ${avatarHTML("you", "lg", true)}
      <div><b>Priya Sharma</b><div class="dimtx" style="font-size:11px">priya@acme.dev · Staff Engineer</div></div>
      <span class="badge ${st.twofa ? "green" : "red"}" style="margin-left:auto">${st.twofa ? "🔐 2FA Enabled" : "⚠️ 2FA Off"}</span>
    </div>
    ${sw("twofa", "Two-factor authentication", "TOTP + hardware key fallback")}
    <div class="section-label">Workspace tenant</div>
    <div class="tenant-row">
      <button class="tenant-btn ${st.tenant === "Personal" ? "active" : ""}" data-act="tenant" data-t="Personal">🏠 Personal</button>
      <button class="tenant-btn ${st.tenant === "Enterprise Org" ? "active" : ""}" data-act="tenant" data-t="Enterprise Org">🏢 Enterprise Org</button>
    </div>
  </div>

  <div class="card setting-card">
    <h4>🔔 Notification preferences</h4>
    ${sw("notifCI", "CI build failures", "Push alert when Jenkins / Woodpecker fails")}
    ${sw("notifMentions", "Meeting mentions", "When your name appears in a Meet transcript")}
    ${sw("notifTickets", "Ticket assignment", "Push when a ticket is assigned to you")}
  </div>

  <div class="card setting-card">
    <h4>⚡ On-device AI controls</h4>
    <div class="field" style="margin-top:8px"><label>Model runtime</label>
      <select data-act-change="runtime">
        ${["Snapdragon Hexagon NPU - ONNX", "Gemma-2B-INT4", "Whisper-Tiny"].map(r => `<option ${st.runtime === r ? "selected" : ""}>${r}</option>`).join("")}
      </select>
    </div>
    ${sw("offline", "Offline mode", "All inference stays on-NPU; sync pauses")}
    <button class="btn sm block" data-act="purge-cache" style="margin-top:10px">🧹 Purge model cache &amp; local state (2.1 GB)</button>
  </div>

  <div class="card setting-card">
    <h4>🎨 Theme</h4>
    <div class="theme-row">
      <button class="theme-chip obsidian ${S.theme === "obsidian" ? "active" : ""}" data-act="theme" data-t="obsidian">Obsidian Dark</button>
      <button class="theme-chip neon ${S.theme === "neon" ? "active" : ""}" data-act="theme" data-t="neon">Cyber Neon</button>
      <button class="theme-chip light ${S.theme === "light" ? "active" : ""}" data-act="theme" data-t="light">Clean Light</button>
    </div>
  </div>

  <div class="card flat" style="text-align:center;font-size:11px;color:var(--dim)">
    Shortcuts: <span class="kbd">1</span> Teams · <span class="kbd">2</span> Code · <span class="kbd">3</span> Tickets · <span class="kbd">4</span> Meet · <span class="kbd">5</span> Settings
    <br><br>SynapseDev v0.9 · iQOO 15 · Snapdragon 8-Elite · build ${new Date().toISOString().slice(0, 10)}
  </div>`;
}

/* ============================================================
   Re-render helpers
   ============================================================ */

function renderPanels() {
  // In web view, refresh each dock body; in phone view, refresh phone body + drawers.
  if (S.view === "web") {
    const map = { teams: teamsHTML, meet: () => meetHTML(true), tickets: ticketHTML, code: codeHTML };
    Object.entries(map).forEach(([k, fn]) => {
      const el = document.querySelector(`[data-panel="${k}"]`);
      if (el) el.innerHTML = fn();
    });
    // drawer refresh
    const grid = $(".web-grid");
    document.querySelectorAll(".ci-drawer").forEach(d => d.remove());
    if (EPH.ciDrawerOpen && grid) grid.insertAdjacentHTML("afterend", ciDrawerHTML());
  } else {
    const body = $("#phone-body");
    if (body) body.innerHTML = modeHTML(S.mode);
    const screen = $(".phone-screen");
    if (screen) {
      screen.querySelectorAll(".ci-drawer, .ci-drawer-fab").forEach(d => d.remove());
      if (S.mode === "ticket") {
        screen.insertAdjacentHTML("beforeend", ciFabHTML());
        if (EPH.ciDrawerOpen) screen.insertAdjacentHTML("beforeend", ciDrawerHTML());
      }
    }
    // refresh bottom-nav badge
    const nav = $(".bottom-nav");
    if (nav) nav.outerHTML = `<div class="bottom-nav">${NAV.map(n => `
      <button class="nav-item ${S.mode === n.id ? "active" : ""}" data-act="set-mode" data-m="${n.id}">
        <span class="kbd-hint">${n.key}</span><span class="nico">${n.icon}</span>${n.label}
        ${n.id === "teams" && totalUnread() ? `<span class="nav-badge">${totalUnread()}</span>` : ""}
      </button>`).join("")}</div>`;
  }
  afterRenderPartial();
}

function afterRender() { afterRenderPartial(); bindSearchInput(); }

function afterRenderPartial() {
  bindLaser();
  bindKanbanDnD();
  paintMirrors();
  scrollChats();
  markJustMoved();
}

function markJustMoved() {
  S.tickets.forEach(t => {
    if (t.justMoved) $$(`[data-ticket="${t.id}"]`).forEach(el => el.classList.add("just-moved"));
  });
}

function scrollChats() {
  $$(".chat-msgs").forEach(el => { el.scrollTop = el.scrollHeight; });
}

function bindSearchInput() {
  const inp = $("#global-search");
  if (!inp) return;
  inp.addEventListener("input", () => {
    EPH.searchQ = inp.value;
    const wrap = inp.closest(".searchwrap");
    wrap.querySelectorAll(".search-results").forEach(el => el.remove());
    if (EPH.searchQ) wrap.insertAdjacentHTML("beforeend", searchResultsHTML());
  });
}

/* ============================================================
   Global event delegation
   ============================================================ */

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  // close org menu / search results on outside click
  if (!e.target.closest(".org-switch") && EPH.orgMenuOpen) { EPH.orgMenuOpen = false; render(); }
  if (!e.target.closest(".searchwrap") && EPH.searchQ) { EPH.searchQ = ""; const w = $(".searchwrap"); if (w) w.querySelectorAll(".search-results").forEach(x => x.remove()); const gi = $("#global-search"); if (gi) gi.value = ""; }
  if (!el) return;
  const act = el.dataset.act;

  switch (act) {
    /* shell */
    case "set-view": S.view = el.dataset.v; save(); render(); break;
    case "set-mode": S.mode = el.dataset.m; save(); if (S.view === "web" && S.mode === "settings") { openModal(`<div style="margin:-4px">${settingsHTML()}</div><div class="m-actions"><button class="btn" data-act="close-modal">Close</button></div>`); } else render(); break;
    case "toggle-org": EPH.orgMenuOpen = !EPH.orgMenuOpen; render(); break;
    case "pick-org": S.org = el.dataset.org; EPH.orgMenuOpen = false; save(); render(); toast(`Switched to ${S.org}`, "info", "🏢"); break;
    case "quick-call": S.mode = "meet"; S.meet.inCall = true; save(); render(); toast("Joining audio bridge…", "info", "📞"); break;
    case "quick-video": S.mode = "meet"; S.meet.inCall = true; S.meet.video = true; save(); render(); toast("Camera warming up…", "info", "📹"); break;
    case "modal-overlay": if (e.target === el) closeModal(); break;
    case "close-modal": closeModal(); break;

    /* search results */
    case "sr-ticket": EPH.searchQ = ""; S.mode = "ticket"; save(); render(); openTicketModal(el.dataset.data); break;
    case "sr-file": EPH.searchQ = ""; S.mode = "code"; S.code.file = el.dataset.data; save(); render(); break;
    case "sr-channel": EPH.searchQ = ""; S.mode = "teams"; S.activeChannel = el.dataset.data; S.teamTab = "channels"; save(); render(); break;
    case "sr-person": EPH.searchQ = ""; S.mode = "teams"; S.teamTab = "people"; save(); render(); break;

    /* meet */
    case "meet-video": S.meet.video = !S.meet.video; save(); renderPanels(); break;
    case "meet-mic": S.meet.mic = !S.meet.mic; save(); renderPanels(); toast(S.meet.mic ? "Mic unmuted" : "Mic muted", "info", S.meet.mic ? "🎙️" : "🔇"); break;
    case "meet-nc": S.meet.nc = !S.meet.nc; save(); renderPanels(); toast(`Noise cancellation ${S.meet.nc ? "enabled — NPU voice isolation" : "disabled"}`, "info", "🌊"); break;
    case "meet-spatial": S.meet.spatial = !S.meet.spatial; save(); renderPanels(); toast(`Spatial audio ${S.meet.spatial ? "on — head-tracked" : "off"}`, "info", "🎧"); break;
    case "meet-end": S.meet.inCall = false; save(); renderPanels(); toast("Call ended · summary pipeline still available", "info", "📵"); break;
    case "meet-rejoin": S.meet.inCall = true; save(); renderPanels(); toast("Rejoined the standup", "success", "📹"); break;
    case "voice-sim": runVoiceSim(); break;
    case "auto-ticket": autoCreateTicket(); break;
    case "export-md": exportMarkdown(); break;
    case "open-standup-channel": S.mode = "teams"; S.teamTab = "channels"; S.activeChannel = "standup-notes"; save(); render(); break;

    /* tickets */
    case "new-ticket": newTicketModal(); break;
    case "create-ticket": {
      const title = $("#nt-title").value.trim();
      if (!title) { toast("Give the ticket a title", "error", "✏️"); break; }
      const id = pushTicket({ title, assignee: $("#nt-assignee").value, priority: $("#nt-priority").value, branch: $("#nt-branch").value.trim() || "feature/unlinked" });
      closeModal(); renderPanels();
      toast(`Ticket ${id} created in Backlog`, "success", "🎫");
      break;
    }
    case "open-ticket": if (!e.target.closest("[draggable].dragging")) openTicketModal(el.dataset.id); break;
    case "modal-move": moveTicket(el.dataset.id, el.dataset.col); closeModal(); toast(`${el.dataset.id} moved to ${KANBAN_COLS.find(c => c.id === el.dataset.col).label}`, "info", "🎯"); break;
    case "delete-ticket": S.tickets = S.tickets.filter(t => t.id !== el.dataset.id); save(); broadcastState(); closeModal(); renderPanels(); toast(`${el.dataset.id} deleted`, "error", "🗑"); break;
    case "toggle-ci-drawer": EPH.ciDrawerOpen = !EPH.ciDrawerOpen; renderPanels(); break;
    case "ci-jenkins": triggerJenkins(); break;
    case "ci-woodpecker": triggerWoodpecker(); break;

    /* code */
    case "pick-file": S.code.file = el.dataset.f; save(); renderPanels(); break;
    case "diff-tab": S.code.diffTab = el.dataset.t; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "ai-explain": runAiExplain(); break;
    case "new-branch": newBranchModal(); break;
    case "create-branch": {
      const name = $("#nb-name").value.trim();
      if (!name || name === "feature/") { toast("Branch needs a name", "error", "⎇"); break; }
      const base = S.code.branch;
      if (!REPO.branches.includes(name)) REPO.branches.push(name);
      REPO.files.forEach(f => { if (!(name in f.byBranch)) f.byBranch[name] = f.byBranch[base] ?? null; });
      S.code.branch = name; save();
      closeModal(); renderPanels();
      toast(`Branch ${name} created from ${base}`, "success", "⎇");
      break;
    }

    /* teams */
    case "team-tab": S.teamTab = el.dataset.t; save(); renderPanels(); break;
    case "pick-channel": if (e.target.closest('[data-act="fav-channel"]')) break; S.activeChannel = el.dataset.c; save(); renderPanels(); break;
    case "fav-channel": { e.stopPropagation(); const c = S.channels.find(x => x.id === el.dataset.c); c.fav = !c.fav; save(); renderPanels(); break; }
    case "send-msg": sendChatMessage(); break;
    case "new-channel": newChannelModal(); break;
    case "create-channel": {
      const name = ($("#nc-name").value.trim() || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
      if (!name) { toast("Channel needs a name", "error", "✏️"); break; }
      if (S.channels.some(c => c.id === name)) { toast(`#${name} already exists`, "error", "⚠️"); break; }
      S.channels.push({ id: name, name, desc: $("#nc-desc").value.trim() || "New channel", fav: false });
      S.messages[name] = [];
      S.activeChannel = name; S.teamTab = "channels";
      save(); broadcastState(); closeModal(); renderPanels();
      toast(`#${name} created`, "success", "💬");
      break;
    }

    /* settings */
    case "setting-toggle": {
      const k = el.dataset.k;
      S.settings[k] = !S.settings[k]; save();
      if (S.view === "web" && $("#modal-root .modal")) { openModal(`<div style="margin:-4px">${settingsHTML()}</div><div class="m-actions"><button class="btn" data-act="close-modal">Close</button></div>`); }
      renderPanels(); render();
      if (k === "offline") toast(S.settings.offline ? "Offline mode ON — inference pinned to NPU" : "Back online — sync resumed", "info", S.settings.offline ? "⛔" : "🌐");
      break;
    }
    case "tenant": S.settings.tenant = el.dataset.t; save(); renderPanels(); toast(`Tenant → ${el.dataset.t}`, "info", "🏢"); if (S.view === "web" && $("#modal-root .modal")) openModal(`<div style="margin:-4px">${settingsHTML()}</div><div class="m-actions"><button class="btn" data-act="close-modal">Close</button></div>`); break;
    case "theme": S.theme = el.dataset.t; save(); render(); toast(`Theme → ${el.textContent.trim()}`, "info", "🎨"); break;
    case "runtime": break;
    case "purge-cache":
      openModal(`
        <h3>🧹 Purge local cache?</h3>
        <div class="m-sub">Clears model weights cache and ALL local prototype state (tickets, messages, docs). This resets the demo.</div>
        <div class="m-actions">
          <button class="btn" data-act="close-modal">Cancel</button>
          <button class="btn danger" data-act="purge-confirm">Purge everything</button>
        </div>`);
      break;
    case "purge-confirm":
      localStorage.removeItem(LS_KEY);
      toast("Cache purged — reloading fresh state", "error", "🧹");
      setTimeout(() => location.reload(), 700);
      break;

    /* web docks */
    case "dock-toggle": {
      const p = $(`#dock-${el.dataset.p}`);
      if (p) { p.classList.toggle("collapsed"); el.textContent = p.classList.contains("collapsed") ? "▸ open" : "▾ dock"; }
      break;
    }
  }
});

/* change events (selects) */
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-act-change]");
  if (!el) return;
  const v = el.value.replace(/^⎇ /, "");
  switch (el.dataset.actChange) {
    case "repo-branch": S.code.branch = v; save(); renderPanels(); toast(`Checked out ${v}`, "info", "⎇"); break;
    case "diff-c1": S.code.c1 = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-c2": S.code.c2 = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fa": S.code.fa = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fb": S.code.fb = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fab": S.code.fab = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fbb": S.code.fbb = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "runtime": S.settings.runtime = v; save(); toast(`Runtime → ${v}`, "info", "⚡"); break;
  }
});

/* enter to send chat */
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target && e.target.id === "chat-input-field") { sendChatMessage(); return; }
  if (e.key === "Escape") { closeModal(); return; }
  // number shortcuts (only when not typing)
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  const map = { "1": "teams", "2": "code", "3": "ticket", "4": "meet", "5": "settings" };
  if (map[e.key]) {
    S.mode = map[e.key]; save();
    if (S.view === "web" && S.mode !== "settings") {
      const target = { teams: "teams", code: "code", ticket: "tickets", meet: "meet" }[S.mode];
      render();
      const p = $(`#dock-${target}`);
      if (p) { p.scrollIntoView({ behavior: "smooth", block: "nearest" }); p.style.outline = "2px solid var(--cyan)"; setTimeout(() => p.style.outline = "", 900); }
    } else if (S.view === "web" && S.mode === "settings") {
      openModal(`<div style="margin:-4px">${settingsHTML()}</div><div class="m-actions"><button class="btn" data-act="close-modal">Close</button></div>`);
    } else render();
  }
});

/* ---------------- Ambient timers ---------------- */

/* live clock */
setInterval(() => { $$(".status-time").forEach(el => el.textContent = nowClock()); }, 15000);

/* rotating "speaking" highlight on video tiles */
setInterval(() => {
  const tiles = $$(".vtile");
  if (!tiles.length) return;
  EPH.speakingIdx = (EPH.speakingIdx + 1) % tiles.length;
  tiles.forEach((t, i) => {
    const speaking = i === EPH.speakingIdx && !t.classList.contains("cam-off");
    t.classList.toggle("speaking", i === EPH.speakingIdx);
    const w = t.querySelector(".wave");
    if (w) w.style.display = i === EPH.speakingIdx ? "inline-flex" : "none";
  });
}, 2600);

/* ---------------- Boot ---------------- */
render();
