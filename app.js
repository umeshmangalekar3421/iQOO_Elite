/* ============================================================
   SynapseDev v2 — phone-first unified developer platform
   Fully client-side: mock state + localStorage + simulated AI
   ============================================================ */
"use strict";

/* ---------------- Constants ---------------- */

const LS_KEY = "synapsedev-state-v2";
const HOUR = 3600000, DAY = 86400000;

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
  { id: "todo",       label: "To Do",       icon: "🗂️" },
  { id: "inprogress", label: "In Progress", icon: "🔧" },
  { id: "done",       label: "Done",        icon: "✅" },
];
const GROUP_COLORS = ["#0e7490", "#047857", "#b45309", "#6d28d9", "#be185d", "#4d7c0f"];

const TRANSCRIPT_TEXT = `Standup update: We have a race condition in the auth middleware. John, please refactor v1/auth_handler.go to v2/auth_controller.go and verify the Jenkins build passes today.`;

/* ---------------- Seed source files ---------------- */

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

/* ---------------- Seed state ---------------- */

function seedRepos() {
  const now = Date.now();
  return {
    "acme/auth-service": {
      access: "Contributor · Write Access",
      branches: ["main", "feature/TICK-101-auth", "v2-refactor"],
      files: [
        { path: "src/auth/v1_auth.go",    dir: "src/auth", byBranch: { "main": V1_AUTH_A8, "feature/TICK-101-auth": V1_AUTH_B3, "v2-refactor": V1_AUTH_B3 } },
        { path: "src/auth/v2_auth.go",    dir: "src/auth", byBranch: { "main": null, "feature/TICK-101-auth": null, "v2-refactor": V2_AUTH } },
        { path: "config/ci.yml",          dir: "config",   byBranch: { "main": CI_YML, "feature/TICK-101-auth": CI_YML, "v2-refactor": CI_YML } },
        { path: "dataset/benchmark.json", dir: "dataset",  byBranch: { "main": BENCH_JSON, "feature/TICK-101-auth": BENCH_JSON, "v2-refactor": BENCH_JSON } },
      ],
      commits: [
        { hash: "c7d551", msg: "feat(auth): introduce v2_auth.go with argon2id + ctx", author: "Sam Rivera",   ts: now - 2 * HOUR,  branch: "v2-refactor",           file: "src/auth/v2_auth.go", snapshot: V2_AUTH },
        { hash: "b3e104", msg: "fix(auth): guard session reads with RWMutex",          author: "John Doe",     ts: now - 5 * HOUR,  branch: "feature/TICK-101-auth", file: "src/auth/v1_auth.go", snapshot: V1_AUTH_B3 },
        { hash: "a8f9c2", msg: "chore(auth): baseline v1 token validation",            author: "Priya Sharma", ts: now - 2 * DAY,   branch: "main",                  file: "src/auth/v1_auth.go", snapshot: V1_AUTH_A8 },
        { hash: "9e0f3a", msg: "ci: migrate to universal ci.yml v2 schema",            author: "Ana Petrov",   ts: now - 3 * DAY,   branch: "main",                  file: "config/ci.yml",       snapshot: CI_YML },
      ],
    },
  };
}

function seedChats() {
  return [
    { id: "general",          type: "group", name: "general",          desc: "Org-wide announcements",              members: 24, fav: true,  color: GROUP_COLORS[0] },
    { id: "engineering-core", type: "group", name: "engineering-core", desc: "Platform + backend engineering",     members: 12, fav: true,  color: GROUP_COLORS[1] },
    { id: "standup-notes",    type: "group", name: "standup-notes",    desc: "Auto-posted Meet summaries",          members: 12, fav: false, color: GROUP_COLORS[3] },
    { id: "ci-alerts",        type: "group", name: "ci-alerts",        desc: "Jenkins / Woodpecker build webhooks", members: 8,  fav: false, color: GROUP_COLORS[2] },
    { id: "dm-john",          type: "dm",    name: "John Doe",         personId: "john", fav: true  },
    { id: "dm-mia",           type: "dm",    name: "Mia Kim",          personId: "mia",  fav: false },
  ];
}

function seedMessages() {
  const t = m => Date.now() - m * 60000;
  return {
    "general": [
      { who: "ana",  text: "Companion web view now mirrors the phone laser pointer in real time 🎯 Try it from the Meet hub.", ts: t(190), read: true },
      { who: "you",  text: "Standup Meet in 10 — bring the `v1_auth.go` findings.", ts: t(65), read: true },
    ],
    "engineering-core": [
      { who: "john", text: "Root cause candidate:\n```go\nsession, ok := store[string(hash[:])]\n// read is not guarded — writer can evict mid-read\n```\nWe never took the RLock in the v1 handler.", ts: t(120), read: true },
      { who: "sam",  text: "Also flagging that **SHA-1** is still used for token digests in v1. We should land `argon2id` while we're in there.", ts: t(100), read: true },
      { who: "you",  text: "Agreed — fold both into the `v2-refactor` branch. Run *AI Explain Diff* in Code Hub before review.", ts: t(80), read: true },
    ],
    "standup-notes": [
      { who: "bot", text: "🤖 **SynapseBot** · Daily digest armed. Finalized Meet summaries will be auto-posted here.", ts: t(300), read: true },
    ],
    "ci-alerts": [
      { who: "bot", text: "🟢 **Jenkins #831** succeeded · `chore/TICK-100-ciyml` · 4m 12s · deployed to staging.", ts: t(260), read: true },
      { who: "bot", text: "🟡 **Woodpecker #76** running · `fix/TICK-102-runner` · arm64 matrix (3/5 stages).", ts: t(45), read: true },
    ],
    "dm-john": [
      { who: "john", text: "Sending you the goroutine dump from the flaky auth test — **1 in 40** repro under load.", ts: t(150), read: true },
      { who: "you",  text: "Got it. Cut `feature/TICK-101-auth` and push the RWMutex fix there.", ts: t(140), read: true },
      { who: "john", text: "Pushed as `b3e104` ✅ Can you review before the Jenkins run?", ts: t(20), read: false },
    ],
    "dm-mia": [
      { who: "mia", text: "ARM64 runners are flaking on cold cache again 😤 filed the timeout logs under TICK-102.", ts: t(200), read: true },
    ],
  };
}

function seedTickets() {
  return [
    { id: "TICK-100", title: "Migrate pipeline config to ci.yml v2 schema",    assignee: "ana",  priority: "Low",      branch: "chore/TICK-100-ciyml",  runner: "Jenkins",    col: "done",       fromMeet: false, ci: { state: "passed", label: "✅ CI Passed (Jenkins #831)" } },
    { id: "TICK-101", title: "Fix race condition in auth token expiry path",   assignee: "john", priority: "High",     branch: "feature/TICK-101-auth", runner: "Jenkins",    col: "inprogress", fromMeet: false, ci: null },
    { id: "TICK-102", title: "Woodpecker ARM64 runner flakes on cold cache",   assignee: "mia",  priority: "Critical", branch: "fix/TICK-102-runner",   runner: "Woodpecker", col: "inprogress", fromMeet: false, ci: { state: "running", label: "⏳ CI Running (Woodpecker #76)" } },
    { id: "TICK-103", title: "Benchmark dataset ingestion for NPU eval",       assignee: "you",  priority: "Medium",   branch: "feat/TICK-103-dataset", runner: "Jenkins",    col: "todo",       fromMeet: false, ci: null },
  ];
}

function seedMeetings() {
  const now = Date.now();
  return {
    scheduled: [
      { id: "M-1", title: "Auth v2 Design Review", when: now + 26 * HOUR, agenda: "Walk through argon2id migration, ctx-aware ValidateToken, and rollout plan.", attendees: ["you", "john", "sam"], room: "AUTH-V2" },
      { id: "M-2", title: "CI Infra Sync — ARM64 runners", when: now + 50 * HOUR, agenda: "Woodpecker cold-cache mount timeouts; warm-pool strategy.", attendees: ["you", "mia"], room: "CI-SYNC" },
    ],
    history: [
      {
        id: "H-1", title: "Sprint Planning — Auth Platform", date: now - 2 * DAY, duration: "42m",
        transcript: "…we agreed the v1 handler has to go this sprint. Sam demos the argon2id spike Thursday. Mia owns the ARM64 runner stability track. Priya to split the auth work into TICK-101 and TICK-103…",
        doc: { agenda: ["Sprint scope — Auth Platform", "CI stability review"], decisions: ["Deprecate v1 auth handler this sprint", "Adopt argon2id for token digests"], actions: ["Priya: split auth work into tickets", "Mia: stabilize ARM64 runners"] },
        tickets: ["TICK-101", "TICK-103"],
      },
    ],
  };
}

/* ---------------- State ---------------- */

const defaultState = () => ({
  view: "phone",                 // phone | web
  tab: "meet",                   // team | code | ticket | meet
  theme: "obsidian",
  org: ORGS[0],
  chats: seedChats(),
  messages: seedMessages(),
  activeChat: "engineering-core",
  chatOpen: false,
  teamFilter: "all",             // all | groups | dm | fav
  repos: seedRepos(),
  activeRepo: "acme/auth-service",
  code: { branch: "feature/TICK-101-auth", file: "src/auth/v1_auth.go", mode: "view", diffMode: "same",
          c1: "a8f9c2", c2: "b3e104", fa: "src/auth/v1_auth.go", fab: "main", fb: "src/auth/v2_auth.go", fbb: "v2-refactor" },
  tickets: seedTickets(),
  ticketSeq: 104,
  ticketFilter: "all",           // all | mine | meet
  pending: [
    { id: "REQ-1", title: "Write argon2id migration guide for the wiki", assignee: "sam", priority: "Medium", from: "Sprint Planning — Aug 25" },
  ],
  meetings: seedMeetings(),
  meetSub: "live",               // live | sched | history
  meet: { inCall: true, video: true, mic: true, nc: true, spatial: false, room: "Daily Standup — Auth Platform" },
  settings: {
    tenant: "Enterprise Org", twofa: true,
    notifCI: true, notifMentions: true, notifTickets: true,
    runtime: "Snapdragon Hexagon NPU - ONNX", offline: false,
  },
  ciLog: [],
});

let S = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = defaultState();
      const p = JSON.parse(raw);
      return { ...d, ...p,
        code: { ...d.code, ...(p.code || {}) },
        meet: { ...d.meet, ...(p.meet || {}) },
        meetings: { ...d.meetings, ...(p.meetings || {}) },
        settings: { ...d.settings, ...(p.settings || {}) } };
    }
  } catch (e) {}
  return defaultState();
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }

/* Ephemeral (not persisted) */
const EPH = {
  meMenuOpen: false,
  ciDrawerOpen: false,
  emojiOpen: false,
  searchQ: "",
  voiceRunning: false,
  transcriptDone: (S.meetings.history || []).some(h => h.id.startsWith("H-live")),
  actionTicketed: false,
  aiExplainState: "idle",
  laser: { active: false, x: .5, y: .5, from: "local" },
  speakingIdx: 0,
  lastVoiceHist: null,
};

/* Cross-tab sync */
let laserBC = null, stateBC = null;
try {
  laserBC = new BroadcastChannel("synapse-laser");
  laserBC.onmessage = ev => {
    const d = ev.data || {};
    EPH.laser = { active: !!d.active, x: d.x ?? .5, y: d.y ?? .5, from: "remote" };
    paintMirrors();
  };
  stateBC = new BroadcastChannel("synapse-state");
  stateBC.onmessage = () => { S = loadState(); render(); };
} catch (e) {}
function broadcastState() { try { stateBC && stateBC.postMessage("sync"); } catch (e) {} }

/* ---------------- Utilities ---------------- */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const nowClock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function rel(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "now";
  if (d < HOUR) return Math.floor(d / 60000) + "m ago";
  if (d < DAY) return Math.floor(d / HOUR) + "h ago";
  return Math.floor(d / DAY) + "d ago";
}
function countdown(ts) {
  const d = ts - Date.now();
  if (d <= 0) return "LIVE NOW";
  const h = Math.floor(d / HOUR), m = Math.floor((d % HOUR) / 60000);
  return h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : `in ${h}h ${m}m`;
}
const randHash = () => Math.random().toString(16).slice(2, 8);

function toast(text, kind = "success", icon) {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  const ic = icon || (kind === "success" ? "✅" : kind === "error" ? "⛔" : kind === "warn" ? "⚠️" : "⚡");
  el.innerHTML = `<span class="t-ico">${ic}</span><span>${text}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 3400);
}

function openModal(html) { $("#modal-root").innerHTML = `<div class="modal-overlay" data-act="modal-overlay"><div class="modal">${html}</div></div>`; }
function closeModal() { $("#modal-root").innerHTML = ""; }
function invalidate(id, msg) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const f = inp.closest(".field");
  if (f) { f.classList.add("invalid"); let e = f.querySelector(".f-err"); if (!e) { e = document.createElement("div"); e.className = "f-err"; f.appendChild(e); } e.textContent = msg; }
  inp.focus();
}

/* Markdown-lite: ```blocks```, `code`, **bold**, *italic* */
function md(text) {
  let out = esc(text);
  out = out.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => `<pre>${c.trim()}</pre>`);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\n/g, "<br>");
  return out;
}

/* Syntax highlight (lightweight) */
function hlLine(line, lang) {
  let out = esc(line);
  out = out.replace(/&quot;([^&]*?)&quot;/g, '<span class="tok-str">&quot;$1&quot;</span>');
  if (lang === "go") out = out.replace(/(\/\/.*)$/, '<span class="tok-com">$1</span>');
  if (lang === "yml") out = out.replace(/(#.*)$/, '<span class="tok-com">$1</span>');
  if (lang === "go") out = out.replace(/\b(package|import|func|return|if|else|var|type|struct|range|for|defer|go|nil|true|false|string|bool|error|byte|int)\b/g, '<span class="tok-kw">$1</span>');
  if (lang === "json" || lang === "yml") out = out.replace(/\b(true|false|null)\b/g, '<span class="tok-kw">$1</span>');
  out = out.replace(/\b(\d+(?:\.\d+)?)\b(?![^<]*&)/g, '<span class="tok-num">$1</span>');
  return out;
}
const langOf = path => path.endsWith(".go") ? "go" : path.endsWith(".yml") || path.endsWith(".yaml") ? "yml" : path.endsWith(".json") ? "json" : "txt";

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
const repo = () => S.repos[S.activeRepo];
const unreadFor = id => (S.messages[id] || []).filter(m => !m.read).length;
const totalUnread = () => S.chats.reduce((s, c) => s + unreadFor(c.id), 0);

function postBot(chatId, text) {
  if (!S.messages[chatId]) S.messages[chatId] = [];
  S.messages[chatId].push({ who: "bot", text, ts: Date.now(), read: S.tab === "team" && S.activeChat === chatId && (S.chatOpen || S.view === "web") });
  save(); broadcastState();
}

function pushTicket({ title, assignee, priority, branch, fromMeet, col = "todo", ci = null, runner = "Jenkins" }) {
  const id = `TICK-${S.ticketSeq++}`;
  S.tickets.unshift({ id, title, assignee, priority, branch, runner, col, fromMeet: !!fromMeet, ci });
  save(); broadcastState();
  return id;
}

/* ============================================================
   Top-level render
   ============================================================ */

function render() {
  document.documentElement.dataset.theme = S.theme;
  document.body.classList.toggle("web-view", S.view === "web");
  $("#app").innerHTML = `
    ${topbarHTML()}
    <div class="stage ${S.view === "web" ? "web-stage" : ""}">
      ${S.view === "phone" ? phoneHTML() : webHTML()}
    </div>`;
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
      <input id="global-search" placeholder="Search workspace… tickets, files, chats, people" value="${esc(EPH.searchQ)}" autocomplete="off" />
      ${EPH.searchQ ? searchResultsHTML() : ""}
    </div>
    ${S.settings.offline ? `<span class="offline-pill">⛔ OFFLINE</span>` : ""}
    <div class="me-menu-wrap">
      <button class="me-btn" data-act="me-menu">${avatarHTML("you", "", true)} <span class="dimtx">⚙️ ▾</span></button>
      ${EPH.meMenuOpen ? `
      <div class="me-menu">
        <div class="mm-head">${avatarHTML("you", "md")}<div><b style="font-size:13px">Priya Sharma</b><div class="dimtx" style="font-size:10.5px">priya@acme.dev · ${esc(S.settings.tenant)}</div></div></div>
        <div class="mm-label">Workspace</div>
        ${ORGS.map(o => `<button class="mm-item" data-act="pick-org" data-org="${esc(o)}">🏢 ${esc(o)} ${o === S.org ? '<span class="check">✓</span>' : ""}</button>`).join("")}
        <div class="mm-label">Account</div>
        <button class="mm-item" data-act="open-settings">⚙️ Settings &amp; AI Controls</button>
        <button class="mm-item" data-act="purge-cache">🧹 Purge cache &amp; reset demo</button>
      </div>` : ""}
    </div>
  </div>`;
}

function searchResultsHTML() {
  const q = EPH.searchQ.toLowerCase();
  const res = [];
  S.tickets.forEach(t => { if ((t.id + " " + t.title).toLowerCase().includes(q)) res.push({ kind: "ticket", label: `${t.id} — ${t.title}`, act: "sr-ticket", data: t.id }); });
  repo().files.forEach(f => { if (f.path.toLowerCase().includes(q)) res.push({ kind: "file", label: f.path, act: "sr-file", data: f.path }); });
  S.chats.forEach(c => { if (c.name.toLowerCase().includes(q)) res.push({ kind: c.type === "dm" ? "dm" : "group", label: (c.type === "group" ? "#" : "") + c.name, act: "sr-chat", data: c.id }); });
  PEOPLE.forEach(p => { if (p.name.toLowerCase().includes(q)) res.push({ kind: "person", label: p.name, act: "sr-person", data: p.id }); });
  const items = res.slice(0, 8).map(r => `
    <div class="sr-item" data-act="${r.act}" data-data="${esc(r.data)}"><span class="sr-kind">${r.kind}</span><span>${esc(r.label)}</span></div>`).join("");
  return `<div class="search-results">${items || `<div class="sr-empty">No matches in ${esc(S.org)} for “${esc(EPH.searchQ)}”</div>`}</div>`;
}

/* ---------------- Shells ---------------- */

const NAV = [
  { id: "team",   label: "Team Hub",   icon: "💬", key: "1" },
  { id: "code",   label: "Code Hub",   icon: "⌥",  key: "2" },
  { id: "ticket", label: "Ticket Hub", icon: "🎯", key: "3" },
  { id: "meet",   label: "Meet Hub",   icon: "📹", key: "4" },
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
          <span>5G</span><span>▂▄▆█</span><span>🔋 87%</span>
        </div>
        <div class="phone-body" id="phone-body">${tabHTML(S.tab)}</div>
        ${S.tab === "ticket" ? ciFabHTML() : ""}
        ${EPH.ciDrawerOpen && S.tab === "ticket" ? ciDrawerHTML() : ""}
        ${bottomNavHTML()}
      </div>
    </div>
  </div>`;
}

function bottomNavHTML() {
  return `<div class="bottom-nav">
    ${NAV.map(n => `
      <button class="nav-item ${S.tab === n.id ? "active" : ""}" data-act="set-tab" data-m="${n.id}">
        <span class="kbd-hint">${n.key}</span>
        <span class="nico">${n.icon}</span>${n.label.replace(" Hub", "")}
        ${n.id === "team" && totalUnread() ? `<span class="nav-badge">${totalUnread()}</span>` : ""}
      </button>`).join("")}
  </div>`;
}

function tabHTML(tab) {
  switch (tab) {
    case "team": return teamHTML();
    case "code": return codeHTML();
    case "ticket": return ticketHTML();
    case "meet": return meetHTML(false);
  }
  return "";
}

function webHTML() {
  const panel = (area, icon, title, body) => `
    <div class="dock-panel dock-${area}" id="dock-${area}">
      <div class="dock-head"><span class="live-dot"></span> ${icon} ${title}
        <div class="dk-actions"><button class="mini-btn" data-act="dock-toggle" data-p="${area}">▾ dock</button></div>
      </div>
      <div class="dock-body" data-panel="${area}">${body}</div>
    </div>`;
  return `
  <div class="web-grid">
    ${panel("team", "💬", "Team Hub", teamHTML())}
    ${panel("meet", "📹", "Meet Hub — Live", meetHTML(true))}
    ${panel("ticket", "🎯", "Ticket Hub — Kanban + CI/CD", ticketHTML())}
    ${panel("code", "⌥", "Code Hub — VCS & Diff Engine", codeHTML())}
  </div>
  ${ciFabHTML()}
  ${EPH.ciDrawerOpen ? ciDrawerHTML() : ""}`;
}

/* Universal action bar */
function actionBarHTML(tab) {
  const labels = {
    team:   ["＋ Create", "⇲ Join via Invite"],
    code:   ["＋ Create", "⇲ Clone / Fork"],
    ticket: ["＋ Create", "⇲ Connect Webhook"],
    meet:   ["＋ Create", "⇲ Join via Code"],
  };
  return `<div class="action-bar">
    <button class="btn primary sm" data-act="ab-create" data-tab="${tab}">${labels[tab][0]}</button>
    <button class="btn sm" data-act="ab-join" data-tab="${tab}">${labels[tab][1]}</button>
  </div>`;
}

/* ============================================================
   TAB 1 — TEAM HUB (Telegram-style)
   ============================================================ */

function teamHTML() {
  const showDetail = S.chatOpen && S.chats.some(c => c.id === S.activeChat);
  if (showDetail) return chatDetailHTML();
  return `
  <div class="h-title">💬 Team Hub ${totalUnread() ? `<span class="badge red">${totalUnread()} unread</span>` : ""}</div>
  <div class="h-sub">Groups · DMs · presence · direct calling into Meet Hub</div>
  ${actionBarHTML("team")}
  <div class="chips">
    ${[["all", "All Chats"], ["groups", "Groups"], ["dm", "Direct (DMs)"], ["fav", "⭐ Favorites"]].map(([id, l]) => {
      const n = S.chats.filter(c => filterChat(c, id)).length;
      return `<button class="chip ${S.teamFilter === id ? "active" : ""}" data-act="team-filter" data-f="${id}">${l}<span class="chip-n">${n}</span></button>`;
    }).join("")}
  </div>
  <div class="card flat" style="padding:6px">
    ${chatListHTML()}
  </div>
  <div class="section-label">👥 Directory</div>
  <div class="card flat" style="padding:6px">
    ${PEOPLE.map(p => {
      const pres = { online: ["Online", "green"], inmeet: ["In Meet", "amber"], offline: ["Offline", "grey"] }[p.presence];
      return `<div class="person-row" data-act="start-dm" data-p="${p.id}" style="cursor:pointer">
        ${avatarHTML(p.id, "md", true)}
        <div class="p-info"><div class="p-name">${esc(p.name)}</div><div class="p-role">${esc(p.role)}</div></div>
        <span class="badge ${pres[1]}">● ${pres[0]}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function filterChat(c, f) {
  if (f === "groups") return c.type === "group";
  if (f === "dm") return c.type === "dm";
  if (f === "fav") return c.fav;
  return true;
}

function lastMsg(chatId) {
  const arr = S.messages[chatId] || [];
  return arr.length ? arr[arr.length - 1] : null;
}
function snippet(m) {
  if (!m) return "No messages yet — say hi 👋";
  let t = m.text.replace(/```[\s\S]*?```/g, "⌨️ code block").replace(/[*`#>]/g, "").replace(/\n/g, " ");
  const who = m.who === "bot" ? "🤖 " : m.who === "you" ? "You: " : "";
  return (who + t).slice(0, 46) + (t.length > 46 ? "…" : "");
}

function chatListHTML() {
  const chats = S.chats.filter(c => filterChat(c, S.teamFilter))
    .slice().sort((a, b) => ((lastMsg(b.id) || {}).ts || 0) - ((lastMsg(a.id) || {}).ts || 0));
  if (!chats.length) return `
    <div class="empty-state">
      <div class="es-icon">${S.teamFilter === "fav" ? "⭐" : "💬"}</div>
      <div class="es-title">Nothing here yet</div>
      <div class="es-sub">${S.teamFilter === "fav" ? "Star a chat with ☆ to pin it here." : "Use ＋ Create to start a group or DM."}</div>
    </div>`;
  return chats.map(c => {
    const lm = lastMsg(c.id);
    const un = unreadFor(c.id);
    const av = c.type === "dm"
      ? avatarHTML(c.personId, "md", true)
      : `<span class="gavatar" style="background:${c.color || GROUP_COLORS[4]}">#</span>`;
    return `
    <div class="chat-li ${S.activeChat === c.id ? "active" : ""}" data-act="open-chat" data-c="${c.id}">
      ${av}
      <div class="cl-main">
        <div class="cl-top">
          <span class="cl-name">${c.type === "group" ? "#" : ""}${esc(c.name)}</span>
          <span class="cl-time">${lm ? rel(lm.ts) : ""}</span>
        </div>
        <div class="cl-bottom">
          <span class="cl-snippet">${esc(snippet(lm))}</span>
          ${un ? `<span class="unread-pip">${un}</span>` : ""}
        </div>
      </div>
      <button class="cl-fav" data-act="fav-chat" data-c="${c.id}" title="Favorite" style="color:${c.fav ? "var(--amber)" : "var(--dim)"}">${c.fav ? "★" : "☆"}</button>
    </div>`;
  }).join("");
}

function chatDetailHTML() {
  const ch = S.chats.find(c => c.id === S.activeChat);
  const msgs = S.messages[ch.id] || [];
  msgs.forEach(m => m.read = true); save();
  const sub = ch.type === "group" ? `${ch.members || S.chats.length} members · ${esc(ch.desc || "")}` : `${person(ch.personId).role} · ${person(ch.personId).presence === "online" ? "🟢 Online" : person(ch.personId).presence === "inmeet" ? "🟡 In Meet" : "⚪ Offline"}`;
  return `
  <div class="chat-detail">
    <div class="chat-dhead">
      <button class="back-btn" data-act="back-chat">←</button>
      ${ch.type === "dm" ? avatarHTML(ch.personId, "md", true) : `<span class="gavatar" style="background:${ch.color || GROUP_COLORS[4]}">#</span>`}
      <div class="ch-info">
        <div class="ch-name">${ch.type === "group" ? "#" : ""}${esc(ch.name)}</div>
        <div class="ch-sub">${sub}</div>
      </div>
      <button class="call-btn" data-act="team-call" data-kind="voice" title="Voice call">📞</button>
      <button class="call-btn" data-act="team-call" data-kind="video" title="Video call">📹</button>
    </div>
    <div class="chat-msgs" id="chat-msgs">
      ${msgs.length ? msgs.map(m => {
        const isBot = m.who === "bot";
        return `
        <div class="msg ${isBot ? "bot" : ""} ${m.who === "you" ? "me" : ""}">
          ${isBot ? `<span class="avatar" style="background:var(--emerald)">🤖</span>` : avatarHTML(m.who, "", true)}
          <div class="m-body">
            <div class="m-meta"><span class="m-name">${isBot ? "SynapseBot" : m.who === "you" ? "You" : esc(person(m.who).name)}</span><span class="m-time">${fmtTime(m.ts)}</span></div>
            <div class="m-text">${md(m.text)}</div>
            ${m.who === "you" ? `<div class="m-receipt">✓✓ Read</div>` : ""}
          </div>
        </div>`;
      }).join("") : `
      <div class="empty-state">
        <div class="es-icon">🌱</div>
        <div class="es-title">${ch.type === "group" ? "#" + esc(ch.name) : esc(ch.name)} is brand new</div>
        <div class="es-sub">Be the first to post. **Markdown**, *italic*, \`code\`<br>and \`\`\`blocks\`\`\` all render. Bots post CI &amp; Meet alerts.</div>
      </div>`}
    </div>
    <div class="chat-input">
      <button class="ci-tool" data-act="chat-attach" title="Attach file">📎</button>
      <button class="ci-tool" data-act="chat-codefmt" title="Insert code block">{}</button>
      <input id="chat-input-field" placeholder="Message ${ch.type === "group" ? "#" + esc(ch.name) : esc(ch.name)}…" autocomplete="off" />
      <button class="ci-tool" data-act="chat-emoji" title="Emoji">😊</button>
      <button class="btn primary" style="padding:9px 13px" data-act="send-msg">➤</button>
      ${EPH.emojiOpen ? `<div class="emoji-pop">${["👍", "🚀", "🔥", "😄", "🎯", "✅", "👀", "❤️"].map(e => `<button data-act="emoji-pick" data-e="${e}">${e}</button>`).join("")}</div>` : ""}
    </div>
  </div>`;
}

function openChat(id) {
  S.activeChat = id; S.chatOpen = true;
  (S.messages[id] || []).forEach(m => m.read = true);
  save(); renderPanels();
}

function sendChatMessage() {
  const input = $("#chat-input-field");
  if (!input || !input.value.trim()) return;
  if (!S.messages[S.activeChat]) S.messages[S.activeChat] = [];
  S.messages[S.activeChat].push({ who: "you", text: input.value.trim(), ts: Date.now(), read: true });
  EPH.emojiOpen = false;
  save(); broadcastState(); renderPanels();
  const ch = S.chats.find(c => c.id === S.activeChat);
  if (ch && (ch.id === "engineering-core" || ch.id === "dm-john")) {
    setTimeout(() => {
      S.messages[ch.id].push({ who: "john", text: "👍 On it — pushing to `feature/TICK-101-auth` shortly.", ts: Date.now(), read: S.activeChat === ch.id });
      save(); broadcastState(); renderPanels();
    }, 1600);
  }
}

function startDM(pid) {
  if (pid === "you") { toast("That's you 🙂 — pick a teammate", "info", "👤"); return; }
  let dm = S.chats.find(c => c.type === "dm" && c.personId === pid);
  if (!dm) {
    dm = { id: "dm-" + pid, type: "dm", name: person(pid).name, personId: pid, fav: false };
    S.chats.push(dm);
    S.messages[dm.id] = [];
    toast(`DM with ${person(pid).name} started`, "success", "💬");
  }
  openChat(dm.id);
}

/* ============================================================
   TAB 2 — CODE HUB
   ============================================================ */

function codeHTML() {
  const R = repo();
  const c = S.code;
  const dirs = {};
  R.files.forEach(f => { (dirs[f.dir] = dirs[f.dir] || []).push(f); });
  const activeFile = R.files.find(f => f.path === c.file);
  const content = activeFile ? activeFile.byBranch[c.branch] : null;
  const [owner, name] = S.activeRepo.split("/");

  return `
  <div class="h-title">⌥ Code Hub</div>
  <div class="h-sub">Version control · branching · file editing · on-demand diff engine</div>
  ${actionBarHTML("code")}

  <div class="repo-crumbs">
    <select class="diff-select" style="width:auto;max-width:180px" data-act-change="pick-repo">
      ${Object.keys(S.repos).map(r => `<option ${r === S.activeRepo ? "selected" : ""}>${esc(r)}</option>`).join("")}
    </select>
    <span class="badge green">🔓 ${esc(R.access)}</span>
  </div>
  <div class="repo-bar">
    <div class="branch-select">⎇ <select data-act-change="repo-branch">
      ${R.branches.map(b => `<option ${b === c.branch ? "selected" : ""}>${b}</option>`).join("")}
    </select></div>
    <button class="btn sm" data-act="new-branch">＋ Branch</button>
    <button class="btn sm" data-act="new-file">＋ File</button>
  </div>

  ${R.files.length ? `
  <div class="card flat">
    <div class="section-label" style="margin-top:0">📁 ${esc(owner)} / ${esc(name)} — files</div>
    <div class="file-tree">
      ${Object.entries(dirs).map(([dir, files]) => `
        <div class="ft-dir">📂 ${esc(dir)}/</div>
        ${files.map(f => {
          const missing = f.byBranch[c.branch] == null;
          const size = ((f.byBranch[c.branch] || "").length / 1024).toFixed(1);
          return `<div class="ft-file ${c.file === f.path ? "active" : ""}" data-act="pick-file" data-f="${esc(f.path)}" style="${missing ? "opacity:.4" : ""}">
            📄 ${esc(f.path.split("/").pop())} ${missing ? '<span class="badge grey">not on branch</span>' : ""} <span class="fsize">${missing ? "—" : size + " KB"}</span>
          </div>`;
        }).join("")}`).join("")}
    </div>
  </div>` : `
  <div class="empty-state card">
    <div class="es-icon">📦</div>
    <div class="es-title">${esc(S.activeRepo)} is empty</div>
    <div class="es-sub">Create your first file to initialize <span class="mono">main</span>.</div>
    <button class="btn primary sm" data-act="new-file" style="margin-top:10px">＋ Create file</button>
  </div>`}

  ${activeFile ? fileAreaHTML(activeFile, content) : ""}

  <div class="card flat">
    <div class="section-label" style="margin-top:0">🕘 Commit history</div>
    ${R.commits.length ? R.commits.map(cm => `
      <div class="commit-row">
        <span class="commit-hash">${cm.hash}</span>
        <div><div class="commit-msg">${esc(cm.msg)}</div>
        <div class="commit-meta">${esc(cm.author)} · ${rel(cm.ts)} · ⎇ ${esc(cm.branch)}</div></div>
      </div>`).join("") : `<div class="dimtx" style="font-size:12px;padding:6px">No commits yet.</div>`}
  </div>`;
}

function fileAreaHTML(file, content) {
  const c = S.code;
  if (c.mode === "diff") return diffAreaHTML();
  if (content == null) return `
    <div class="empty-state card">
      <div class="es-icon">🌿</div>
      <div class="es-title">File not on this branch</div>
      <div class="es-sub"><span class="mono">${esc(file.path)}</span> doesn't exist on <span class="mono">${esc(c.branch)}</span>.<br>Switch branches or create it here.</div>
    </div>`;
  if (c.mode === "edit") return `
    <div class="card flat editor-wrap">
      <div class="file-toolbar">
        <span class="ft-name">✏️ Editing ${esc(file.path)} @ ${esc(c.branch)}</span>
        <button class="btn success sm" data-act="commit-open">✔ Commit changes</button>
        <button class="btn sm" data-act="code-cancel">✕ Discard</button>
      </div>
      <textarea id="file-editor" spellcheck="false">${esc(content)}</textarea>
    </div>`;
  const lang = langOf(file.path);
  return `
  <div class="card flat">
    <div class="file-toolbar">
      <span class="ft-name">📄 ${esc(file.path)} <span class="dimtx">@ ${esc(c.branch)}</span></span>
      <button class="btn sm" data-act="code-edit">✏️ Edit / Modify</button>
      <button class="btn primary sm" data-act="code-diff">🔀 Diff View</button>
    </div>
    <div class="code-view"><div class="code-body">
      ${content.split("\n").map((l, i) => `<div class="code-line"><span class="ln">${i + 1}</span><span class="txt">${hlLine(l, lang) || " "}</span></div>`).join("")}
    </div></div>
  </div>`;
}

function diffAreaHTML() {
  const R = repo(), c = S.code;
  const commitsWithSnap = R.commits.filter(x => x.snapshot != null);
  return `
  <div class="card flat">
    <div class="file-toolbar">
      <span class="ft-name">🔀 Diff Engine</span>
      <button class="btn sm" data-act="code-back">← Back to file</button>
    </div>
    <div class="tabs">
      <button class="${c.diffMode === "same" ? "active" : ""}" data-act="diff-mode" data-t="same">Same-File Commit Diff</button>
      <button class="${c.diffMode === "cross" ? "active" : ""}" data-act="diff-mode" data-t="cross">Cross-File Diff</button>
    </div>
    ${c.diffMode === "same" ? (commitsWithSnap.length >= 2 ? `
    <div class="diff-controls">
      <select class="diff-select" data-act-change="diff-c1">
        ${commitsWithSnap.map(x => `<option value="${x.hash}" ${x.hash === c.c1 ? "selected" : ""}>C1: ${x.hash} · ${esc(x.msg.slice(0, 24))}…</option>`).join("")}
      </select>
      <span class="vs">⇢</span>
      <select class="diff-select" data-act-change="diff-c2">
        ${commitsWithSnap.map(x => `<option value="${x.hash}" ${x.hash === c.c2 ? "selected" : ""}>C2: ${x.hash} · ${esc(x.msg.slice(0, 24))}…</option>`).join("")}
      </select>
    </div>
    ${renderDiff(commitSnap(c.c1), commitSnap(c.c2), `${commitFile(c.c1)} @ ${c.c1}`, `@ ${c.c2}`)}` : `
    <div class="empty-state"><div class="es-icon">🕘</div><div class="es-title">Need at least two commits</div><div class="es-sub">Edit a file and commit to build history.</div></div>`) : `
    <div class="diff-controls">
      <div>
        <select class="diff-select" data-act-change="diff-fa" style="margin-bottom:5px">
          ${R.files.map(f => `<option value="${esc(f.path)}" ${f.path === c.fa ? "selected" : ""}>A: ${esc(f.path)}</option>`).join("")}
        </select>
        <select class="diff-select" data-act-change="diff-fab">
          ${R.branches.map(b => `<option ${b === c.fab ? "selected" : ""}>⎇ ${b}</option>`).join("")}
        </select>
      </div>
      <span class="vs">⇢</span>
      <div>
        <select class="diff-select" data-act-change="diff-fb" style="margin-bottom:5px">
          ${R.files.map(f => `<option value="${esc(f.path)}" ${f.path === c.fb ? "selected" : ""}>B: ${esc(f.path)}</option>`).join("")}
        </select>
        <select class="diff-select" data-act-change="diff-fbb">
          ${R.branches.map(b => `<option ${b === c.fbb ? "selected" : ""}>⎇ ${b}</option>`).join("")}
        </select>
      </div>
    </div>
    ${renderDiff(fileSnap(c.fa, c.fab), fileSnap(c.fb, c.fbb), `${c.fa} @ ${c.fab}`, `${c.fb} @ ${c.fbb}`)}`}
    <div id="ai-explain-zone">${aiExplainHTML()}</div>
  </div>`;
}

function commitSnap(hash) { const cm = repo().commits.find(x => x.hash === hash); return cm ? cm.snapshot : ""; }
function commitFile(hash) { const cm = repo().commits.find(x => x.hash === hash); return cm ? cm.file : ""; }
function fileSnap(path, branch) {
  const f = repo().files.find(x => x.path === path);
  return f ? (f.byBranch[branch] ?? `// ${path}\n// (file does not exist on branch ${branch})`) : "";
}

function renderDiff(aText, bText, labelA, labelB) {
  const ops = diffLines(aText, bText);
  const adds = ops.filter(o => o.t === "add").length;
  const dels = ops.filter(o => o.t === "del").length;
  const rows = [];
  let run = [];
  const flush = () => {
    if (run.length > 6) {
      rows.push(run[0], run[1]);
      rows.push({ t: "hunk", s: `@@ … ${run.length - 4} unchanged lines … @@` });
      rows.push(run[run.length - 2], run[run.length - 1]);
    } else rows.push(...run);
    run = [];
  };
  ops.forEach(o => { if (o.t === "ctx") run.push(o); else { flush(); rows.push(o); } });
  flush();
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
    return `<div class="npu-banner"><span class="spinner"></span>⚡ NPU Hexagon Engine: Analyzing AST &amp; patches… Qwen-Coder INT4 · 33 tok/s · 0% cloud</div>`;
  if (EPH.aiExplainState === "done")
    return `
    <div class="ai-explain">
      <h5>✨ Semantic Diff — Qwen-Coder @ Hexagon NPU <span class="badge violet" style="margin-left:auto">on-device · 1.4s</span></h5>
      <div class="aie-item"><b>🔴 Breaking Changes:</b><span><code>ValidateToken()</code> signature changed — now requires a structured <code>context.Context</code> parameter; 14 call sites need updates.</span></div>
      <div class="aie-item"><b>🛡️ Security / Logic:</b><span>Deprecated <code>SHA-1</code> digest replaced with <code>Argon2id</code>; session reads now guarded by <code>RWMutex</code>, fixing the eviction race.</span></div>
      <div class="aie-item"><b>🟢 Risk Assessment:</b><span>Regression danger score <b>2/10</b> — 312/312 tests pass with <code>-race</code>; no behavioral drift detected outside auth path.</span></div>
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

function commitEdit(message) {
  const ed = $("#file-editor");
  const R = repo(), c = S.code;
  const f = R.files.find(x => x.path === c.file);
  if (!ed || !f) return;
  f.byBranch[c.branch] = ed.value;
  R.commits.unshift({ hash: randHash(), msg: message, author: "Priya Sharma", ts: Date.now(), branch: c.branch, file: f.path, snapshot: ed.value });
  S.code.mode = "view";
  save(); broadcastState(); closeModal(); renderPanels();
  toast(`Committed to ${c.branch} — ${R.commits[0].hash}`, "success", "✔");
  postBot("ci-alerts", `📦 New commit \`${R.commits[0].hash}\` on \`${c.branch}\` by **Priya** — _${message}_`);
}

/* ============================================================
   TAB 3 — TICKET HUB
   ============================================================ */

function ticketHTML() {
  const visible = S.tickets.filter(t =>
    S.ticketFilter === "mine" ? t.assignee === "you" :
    S.ticketFilter === "meet" ? t.fromMeet : true);
  return `
  <div class="h-title">🎯 Ticket Hub <span class="badge cyan">${S.tickets.length} tickets</span></div>
  <div class="h-sub">Simplified Kanban · meeting-driven intake · visual Git → CI/CD pipeline</div>
  ${actionBarHTML("ticket")}
  ${S.pending.length ? `
  <div class="pending-banner">
    <div class="pb-head">📥 Pending Requests <span class="badge amber">${S.pending.length} from Meet</span></div>
    ${S.pending.map(r => `
      <div class="req-row">
        <div class="rq-txt"><b>${esc(r.title)}</b><div class="rq-sub">✨ ${esc(r.from)} · ${avatarHTML(r.assignee)} ${esc(person(r.assignee).short)} · ${r.priority}</div></div>
        <button class="btn success sm" data-act="approve-req" data-id="${r.id}">✔ Approve</button>
        <button class="btn sm" data-act="dismiss-req" data-id="${r.id}">✕</button>
      </div>`).join("")}
  </div>` : ""}
  <div class="chips">
    ${[["all", "All Tasks"], ["mine", "Assigned to Me"], ["meet", "✨ From Meeting Summaries"]].map(([id, l]) =>
      `<button class="chip ${S.ticketFilter === id ? "active" : ""}" data-act="ticket-filter" data-f="${id}">${l}</button>`).join("")}
  </div>
  <div class="kanban">
    ${KANBAN_COLS.map(col => {
      const cards = visible.filter(t => t.col === col.id);
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

function pipeHTML(t) {
  const st = t.ci ? t.ci.state : null;
  const stNode = st === "passed" ? `<span class="pnode ok">✅ Passed</span>` :
                 st === "failed" ? `<span class="pnode fail">❌ Failed</span>` :
                 st === "running" ? `<span class="pnode run">⏳ Running</span>` :
                 `<span class="pnode">· Queued</span>`;
  return `<div class="pipe">
    <span class="pnode">📌 ${t.id}</span><span class="parrow">──►</span>
    <span class="pnode" title="${esc(t.branch)}">⎇ ${esc(t.branch.length > 14 ? t.branch.slice(0, 13) + "…" : t.branch)}</span><span class="parrow">──►</span>
    <span class="pnode">⚙️ ${esc(t.runner || "Jenkins")}</span><span class="parrow">──►</span>
    ${stNode}
  </div>`;
}

function tcardHTML(t) {
  return `
  <div class="tcard" draggable="true" data-ticket="${t.id}" data-act="open-ticket" data-id="${t.id}">
    <div class="trow"><span class="tid">${t.id}</span>
      ${t.fromMeet ? '<span class="badge violet glow">✨ Created from Meet Doc</span>' : ""}
    </div>
    <div class="ttitle">${esc(t.title)}</div>
    <div class="trow">
      ${avatarHTML(t.assignee)}
      ${priBadge(t.priority)}
      ${t.ci ? `<span class="badge ${t.ci.state === "passed" ? "green" : t.ci.state === "failed" ? "red" : "amber"}">${esc(t.ci.label)}</span>` : ""}
    </div>
    ${pipeHTML(t)}
  </div>`;
}

function ciFabHTML() { return `<button class="ci-drawer-fab" data-act="toggle-ci-drawer">🛠️ CI/CD Webhook Simulator</button>`; }

function ciDrawerHTML() {
  return `
  <div class="ci-drawer">
    <div style="display:flex;align-items:center;margin-bottom:10px">
      <b style="font-size:13px">🛠️ CI/CD Webhook Simulator</b>
      <button class="mini-btn" style="margin-left:auto" data-act="toggle-ci-drawer">✕</button>
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

function ciLog(text, cls) { S.ciLog.push({ text, cls }); if (S.ciLog.length > 30) S.ciLog = S.ciLog.slice(-30); save(); }

function moveTicket(id, col, animate = true) {
  const t = S.tickets.find(x => x.id === id);
  if (!t || t.col === col) return;
  t.col = col;
  t.justMoved = animate;
  save(); broadcastState(); renderPanels();
  setTimeout(() => { delete t.justMoved; }, 700);
}

function triggerJenkins() {
  const t = S.tickets.find(x => x.id === "TICK-101");
  if (!t) { toast("TICK-101 not found (was it deleted?)", "error"); return; }
  ciLog("→ POST /hooks/jenkins  payload={job:842, ref:feature/TICK-101-auth}", "lg-info");
  ciLog("Jenkins #842 · checkout ✓ · go vet ✓ · go test -race ✓ (312 tests)");
  toast("Jenkins Webhook Received — build #842 running", "info", "🟢");
  t.col = "inprogress"; t.ci = { state: "running", label: "⏳ CI Running (Jenkins #842)" };
  save(); renderPanels();
  setTimeout(() => {
    t.ci = { state: "passed", label: "✅ CI Passed (Jenkins #842)" };
    moveTicket("TICK-101", "done");
    ciLog("Jenkins #842 · SUCCESS in 3m 41s → TICK-101 auto-closed");
    postBot("ci-alerts", "🟢 **Jenkins #842** succeeded · `feature/TICK-101-auth` · 3m 41s · **TICK-101** auto-moved to **Done**. ✅");
    toast("✅ TICK-101 → Done — CI Passed (Jenkins #842)", "success");
    renderPanels();
  }, 1600);
}

function triggerWoodpecker() {
  const t = S.tickets.find(x => x.id === "TICK-102");
  if (!t) { toast("TICK-102 not found (was it deleted?)", "error"); return; }
  ciLog("→ POST /hooks/woodpecker  payload={run:77, ref:fix/TICK-102-runner}", "lg-info");
  ciLog("Woodpecker #77 · arm64 stage 4/5 FAILED: cache mount timeout", "lg-fail");
  t.ci = { state: "failed", label: "❌ CI Failed (Woodpecker #77)" };
  t.col = "inprogress"; t.justMoved = true;
  save(); broadcastState();
  postBot("ci-alerts", "🔴 **Woodpecker #77** failed · `fix/TICK-102-runner` · stage `test-arm64` — cache mount timeout. **TICK-102** stays **In Progress**.");
  toast("❌ Woodpecker #77 failed — TICK-102 flagged", "error");
  renderPanels();
  setTimeout(() => { delete t.justMoved; }, 700);
}

function openTicketModal(id) {
  const t = S.tickets.find(x => x.id === id);
  if (!t) return;
  openModal(`
    <h3><span class="tid mono" style="color:var(--cyan)">${t.id}</span> ${t.fromMeet ? '<span class="badge violet">✨ Created from Meet Doc</span>' : ""}</h3>
    <div class="m-sub">${esc(t.title)}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      ${avatarHTML(t.assignee)} <b style="font-size:12px">${esc(person(t.assignee).name)}</b>
      ${priBadge(t.priority)}
      ${t.ci ? `<span class="badge ${t.ci.state === "passed" ? "green" : t.ci.state === "failed" ? "red" : "amber"}">${esc(t.ci.label)}</span>` : ""}
    </div>
    ${pipeHTML(t)}
    <div class="section-label">Move to column</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px">
      ${KANBAN_COLS.map(c => `<button class="btn sm ${t.col === c.id ? "primary" : ""}" data-act="modal-move" data-id="${t.id}" data-col="${c.id}">${c.icon} ${c.label}</button>`).join("")}
    </div>
    <div class="m-actions">
      <button class="btn danger sm" data-act="delete-ticket" data-id="${t.id}">🗑 Delete</button>
      <button class="btn sm" data-act="close-modal">Close</button>
    </div>`);
}

function approveRequest(id) {
  const r = S.pending.find(x => x.id === id);
  if (!r) return;
  const tid = pushTicket({ title: r.title, assignee: r.assignee, priority: r.priority, branch: `feat/${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 22)}`, fromMeet: true });
  S.pending = S.pending.filter(x => x.id !== id);
  save(); broadcastState(); renderPanels();
  toast(`${tid} approved into sprint — assigned ${person(r.assignee).short}`, "success", "📥");
}

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
      if (id) { moveTicket(id, col.dataset.col); toast(`${id} moved to ${KANBAN_COLS.find(c => c.id === col.dataset.col).label}`, "info", "🎯"); }
    });
  });
}

/* ============================================================
   TAB 4 — MEET HUB
   ============================================================ */

function meetHTML(companion) {
  return `
  <div class="h-title">📹 Meet Hub ${S.meet.inCall ? '<span class="badge green">● LIVE</span>' : ""}</div>
  <div class="h-sub">Live rooms · scheduling · laser pointer · voice-to-action AI</div>
  ${actionBarHTML("meet")}
  <div class="tabs">
    <button class="${S.meetSub === "live" ? "active" : ""}" data-act="meet-sub" data-t="live">Live Call</button>
    <button class="${S.meetSub === "sched" ? "active" : ""}" data-act="meet-sub" data-t="sched">Scheduled <span class="dimtx">(${S.meetings.scheduled.length})</span></button>
    <button class="${S.meetSub === "history" ? "active" : ""}" data-act="meet-sub" data-t="history">History &amp; Docs</button>
  </div>
  ${S.meetSub === "live" ? liveCallHTML(companion) : S.meetSub === "sched" ? schedHTML() : historyHTML()}`;
}

function liveCallHTML(companion) {
  const m = S.meet;
  if (!m.inCall) return `
    <div class="empty-state card">
      <div class="es-icon">📵</div>
      <div class="es-title">No live call</div>
      <div class="es-sub">Start an instant meeting or join with a room code.</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn primary sm" data-act="instant-meet">⚡ Instant Meeting</button>
        <button class="btn sm" data-act="ab-join" data-tab="meet">⇲ Join via Code</button>
      </div>
    </div>
    ${voiceEngineHTML()}`;
  const tiles = [
    { pid: "you",  cam: m.video, mic: m.mic },
    { pid: "john", cam: true,    mic: true },
    { pid: "mia",  cam: true,    mic: false },
    { pid: "sam",  cam: false,   mic: true },
  ];
  const grads = { you: "linear-gradient(135deg,#083344,#0e7490)", john: "linear-gradient(135deg,#052e1f,#047857)", mia: "linear-gradient(135deg,#451a03,#b45309)", sam: "linear-gradient(135deg,#2e1065,#6d28d9)" };
  return `
  <div class="card flat" style="padding:9px 11px;display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <b style="font-size:12.5px">🟢 ${esc(m.room)}</b>
    <span class="dimtx" style="font-size:10.5px;margin-left:auto">E2E encrypted · 24:18</span>
    <button class="btn sm" data-act="instant-invite">👥 Invite</button>
  </div>
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
    <button class="ctl-btn ${m.video ? "" : "off"}" data-act="meet-video">${m.video ? "📹" : "🚫"}<span class="ctl-lbl">Video</span></button>
    <button class="ctl-btn ${m.mic ? "" : "off"}" data-act="meet-mic">${m.mic ? "🎙️" : "🔇"}<span class="ctl-lbl">Mic</span></button>
    <button class="ctl-btn ${m.nc ? "fx-on" : ""}" data-act="meet-nc">🌊<span class="ctl-lbl">Noise NC</span></button>
    <button class="ctl-btn ${m.spatial ? "fx-on" : ""}" data-act="meet-spatial">🎧<span class="ctl-lbl">Spatial</span></button>
    <button class="ctl-btn end" data-act="meet-end">📞<span class="ctl-lbl">End</span></button>
  </div>
  <div class="fx-badges">
    ${m.nc ? '<span class="badge green">🌊 Noise Suppression ON</span>' : '<span class="badge grey">🌊 Noise Suppression OFF</span>'}
    ${m.spatial ? '<span class="badge green">🎧 Spatial Audio ON</span>' : '<span class="badge grey">🎧 Spatial Audio OFF</span>'}
  </div>

  <div class="section-label">🔦 Access-to-Pointer — shared screen (drag to point · WebRTC DataChannel)</div>
  <div class="laser-stage" id="laser-stage">
    <div class="fake-ui">
      <div class="fl" style="width:42%"></div><div class="fl" style="width:88%"></div>
      <div class="fl" style="width:74%"></div><div class="fl" style="width:60%"></div>
      <div class="fl" style="width:81%"></div><div class="fl" style="width:35%"></div>
    </div>
    <div class="laser-coords" id="laser-coords">(x: —, y: —) · broadcasting on DataChannel</div>
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
  ${voiceEngineHTML()}`;
}

function voiceEngineHTML() {
  return `
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
    ${!EPH.transcriptDone && !EPH.voiceRunning ? `
    <div class="empty-state" style="padding:18px 10px">
      <div class="es-icon">📄</div>
      <div class="es-title">No live meeting doc yet</div>
      <div class="es-sub">Tap <b>Simulate Voice Input</b> to run the on-device<br>transcribe → summarize → auto-ticket pipeline.</div>
    </div>` : ""}
  </div>`;
}

function meetArtifactsHTML() {
  const ticketed = S.tickets.some(t => t.fromMeet && /auth middleware/i.test(t.title));
  return `
  <div class="summary-doc">
    <div class="doc-head">📄 standup_2026-08-27.md · generated on-device · Gemma-2B-INT4 <span style="margin-left:auto" class="badge violet">✨ AI</span></div>
    <h4>🗒️ Agenda</h4>
    <ul><li>Daily standup — Auth Platform squad</li><li>Auth middleware stability &amp; CI health</li></ul>
    <h4>✅ Key Decisions</h4>
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
      <button class="btn sm" data-act="open-standup-chat">💬 View in #standup-notes</button>
    </div>
  </div>
  ${!ticketed ? `
  <div class="action-banner">
    <span style="font-size:18px">⚡</span>
    <div class="ab-txt"><b>Action Item Detected:</b> Refactor auth middleware<br><span class="dimtx">assignee: John · priority: High · linked branch ready</span></div>
    <button class="btn success sm" data-act="auto-ticket">Auto-Create Ticket</button>
  </div>` : `
  <div class="action-banner" style="border-color:var(--border2);box-shadow:none;background:var(--panel3)">
    <span style="font-size:16px">✅</span>
    <div class="ab-txt">Ticket created from this doc — see <b>Ticket Hub</b> <span class="badge violet">✨ Created from Meet Doc</span></div>
  </div>`}`;
}

function schedHTML() {
  const list = S.meetings.scheduled.slice().sort((a, b) => a.when - b.when);
  return `
  <div style="display:flex;gap:8px;margin-bottom:11px">
    <button class="btn primary sm" data-act="instant-meet">⚡ Instant Meeting</button>
    <button class="btn sm" data-act="schedule-open">🗓️ Schedule Meeting</button>
  </div>
  ${list.length ? list.map(mt => {
    const d = new Date(mt.when);
    return `
    <div class="card sched-card">
      <div class="sc-date"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleString([], { month: "short" })}</div></div>
      <div class="sc-main">
        <div class="sc-title">${esc(mt.title)}</div>
        <div class="sc-agenda">🕒 ${d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} · room <span class="mono" style="color:var(--cyan)">${esc(mt.room)}</span><br>${esc(mt.agenda)}</div>
        <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
          <span class="avatar-stack">${mt.attendees.map(a => avatarHTML(a)).join("")}</span>
          <span class="countdown">⏳ ${countdown(mt.when)}</span>
          <button class="btn success sm" style="margin-left:auto" data-act="join-sched" data-id="${mt.id}">▶ Join When Ready</button>
          <button class="btn sm" data-act="cancel-sched" data-id="${mt.id}">✕</button>
        </div>
      </div>
    </div>`;
  }).join("") : `
  <div class="empty-state card">
    <div class="es-icon">🗓️</div>
    <div class="es-title">Nothing scheduled</div>
    <div class="es-sub">Use <b>Schedule Meeting</b> to book a room with agenda &amp; attendees.</div>
  </div>`}`;
}

function historyHTML() {
  const list = S.meetings.history.slice().sort((a, b) => b.date - a.date);
  if (!list.length) return `
  <div class="empty-state card">
    <div class="es-icon">🗄️</div>
    <div class="es-title">No meeting history</div>
    <div class="es-sub">Finished calls archive here with transcripts,<br>summary docs and linked tickets.</div>
  </div>`;
  return list.map(h => `
  <div class="card hist-card">
    <div class="hc-top">
      <span class="hc-title">📼 ${esc(h.title)}</span>
      <span class="hc-meta">${new Date(h.date).toLocaleDateString([], { month: "short", day: "numeric" })} · ${h.duration}</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${(h.tickets || []).map(tid => `<button class="badge cyan" style="cursor:pointer;border-width:1px" data-act="hist-ticket" data-id="${tid}">🎫 ${tid}</button>`).join("")}
      <span class="badge violet">✨ AI summary</span>
      <button class="mini-btn" style="margin-left:auto" data-act="hist-toggle" data-id="${h.id}">${h.expanded ? "▾ collapse" : "▸ transcript & doc"}</button>
    </div>
    ${h.expanded ? `
    <div class="hist-transcript">🎙️ ${esc(h.transcript)}</div>
    <div class="summary-doc">
      <div class="doc-head">📄 ${esc(h.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"))}.md</div>
      <h4>🗒️ Agenda</h4><ul>${h.doc.agenda.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>✅ Key Decisions</h4><ul>${h.doc.decisions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>⚡ Action Items</h4><ul>${h.doc.actions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div style="margin-top:10px"><button class="btn sm" data-act="export-hist" data-id="${h.id}">⬇ Export Markdown / PDF</button></div>
    </div>` : ""}
  </div>`).join("");
}

/* Voice pipeline */
function runVoiceSim() {
  if (EPH.voiceRunning) return;
  EPH.voiceRunning = true;
  EPH.transcriptDone = false;
  renderPanels();
  setNPU("Listening…");
  let i = 0;
  const timer = setInterval(() => {
    i += 1 + Math.floor(Math.random() * 2);
    if (i >= TRANSCRIPT_TEXT.length) { i = TRANSCRIPT_TEXT.length; clearInterval(timer); finishTranscription(); }
    const el = $("#transcript-text");
    if (el) el.textContent = TRANSCRIPT_TEXT.slice(0, i);
  }, 28);
}

function finishTranscription() {
  setNPU("Inferring");
  const b = $("#npu-pipeline-banner");
  if (b) b.innerHTML = `<div class="npu-banner"><span class="spinner"></span>⚡ NPU Hexagon Engine: Transcribing &amp; Extracting Action Items…</div>`;
  setTimeout(() => {
    EPH.voiceRunning = false;
    EPH.transcriptDone = true;
    setNPU("idle");
    if (!S.meetings.history.some(h => h.id.startsWith("H-live"))) {
      const h = {
        id: "H-live-" + Date.now(), title: "Daily Standup — Auth Platform", date: Date.now(), duration: "24m",
        transcript: TRANSCRIPT_TEXT,
        doc: { agenda: ["Daily standup — Auth Platform squad", "Auth middleware stability & CI health"],
               decisions: ["Confirmed race condition in auth middleware", "Migrate v1/auth_handler.go → v2/auth_controller.go"],
               actions: ["John: refactor auth middleware to v2 controller (today)", "John: verify Jenkins build passes"] },
        tickets: [],
      };
      S.meetings.history.unshift(h);
      EPH.lastVoiceHist = h.id;
      if (!S.pending.some(r => /refactor auth middleware/i.test(r.title)))
        S.pending.push({ id: "REQ-" + Date.now(), title: "Refactor auth middleware to v2 controller", assignee: "john", priority: "High", from: "Daily Standup — today" });
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
    assignee: "john", priority: "High", branch: "feature/TICK-101-auth", fromMeet: true,
  });
  const h = S.meetings.history.find(x => x.id === EPH.lastVoiceHist) || S.meetings.history[0];
  if (h) { h.tickets = h.tickets || []; h.tickets.push(id); }
  S.pending = S.pending.filter(r => !/refactor auth middleware/i.test(r.title));
  save(); broadcastState();
  postBot("ci-alerts", `🎫 **${id}** created from Meet doc · assigned **John Doe** · linked \`feature/TICK-101-auth\`.`);
  toast(`Ticket ${id} created and assigned to John`, "success", "🎫");
  renderPanels();
}

function exportDoc(title, doc, transcript) {
  const lines = [`# ${title}`, "", "## Agenda", ...doc.agenda.map(a => "- " + a), "", "## Key Decisions", ...doc.decisions.map(a => "- " + a), "", "## Action Items", ...doc.actions.map(a => "- [ ] " + a), ""];
  if (transcript) lines.push("## Transcript", "> " + transcript, "");
  lines.push("_Generated on-device by SynapseDev · Gemma-2B-INT4 @ Snapdragon Hexagon NPU_");
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = title.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".md";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Markdown exported — PDF render queued", "info", "⬇");
}

/* Laser pointer */
function bindLaser() {
  $$(".laser-stage").forEach(stage => {
    const dot = stage.querySelector(".laser-dot");
    const label = stage.querySelector(".laser-label");
    const coords = stage.querySelector(".laser-coords");
    let down = false;
    const move = e => {
      const r = stage.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
      dot.style.display = label.style.display = "block";
      dot.style.left = label.style.left = x + "px";
      dot.style.top = label.style.top = y + "px";
      const nx = +(x / r.width).toFixed(3), ny = +(y / r.height).toFixed(3);
      coords.textContent = `(x: ${nx}, y: ${ny}) · broadcasting on DataChannel`;
      const tr = document.createElement("div");
      tr.className = "laser-trail";
      tr.style.left = x + "px"; tr.style.top = y + "px";
      stage.appendChild(tr);
      setTimeout(() => tr.remove(), 520);
      EPH.laser = { active: true, x: nx, y: ny, from: "local" };
      try { laserBC && laserBC.postMessage({ active: true, x: nx, y: ny }); } catch (err) {}
      paintMirrors();
    };
    stage.addEventListener("pointerdown", e => { down = true; try { stage.setPointerCapture(e.pointerId); } catch (err) {} move(e); });
    stage.addEventListener("pointermove", e => { if (down) move(e); });
    const up = () => {
      down = false;
      setTimeout(() => {
        if (!down) {
          dot.style.display = label.style.display = "none";
          coords.textContent = "(x: —, y: —) · broadcasting on DataChannel";
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
   Modals — Create / Join per tab, Settings
   ============================================================ */

function createMenuModal(tab) {
  const opts = {
    team: [
      ["👥", "New Group Channel", "Shared channel with topic & members", "form-new-group"],
      ["💬", "Direct Message (DM)", "1:1 conversation with a teammate", "form-new-dm"],
    ],
    code: [
      ["📦", "Create Repository", "Fresh repo initialized with main", "form-new-repo"],
      ["⎇", "Cut New Branch", `Branch off ${S.code.branch}`, "form-new-branch"],
      ["📄", "Create New File", `Add file on ${S.code.branch}`, "form-new-file"],
    ],
    ticket: [
      ["🎫", "Create Manual Ticket", "File a ticket into the board", "form-new-ticket"],
      ["📥", "Import Pending Meeting Actions", `${S.pending.length} awaiting approval`, "form-import-pending"],
    ],
    meet: [
      ["⚡", "Start Instant Meeting", "Spawn a room & invite the team now", "form-instant"],
      ["🗓️", "Schedule Future Meeting", "Date-time, agenda & participants", "form-schedule"],
    ],
  };
  openModal(`
    <h3>＋ Create</h3>
    <div class="m-sub">${{ team: "Team Hub", code: "Code Hub", ticket: "Ticket Hub", meet: "Meet Hub" }[tab]} · pick an action</div>
    <div class="option-grid">
      ${opts[tab].map(([i, t, s, act]) => `
        <button class="option-btn" data-act="${act}"><span class="ob-ico">${i}</span><span><span class="ob-t">${t}</span><br><span class="ob-s">${s}</span></span></button>`).join("")}
    </div>
    <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button></div>`);
}

function joinMenuModal(tab) {
  const forms = {
    team: `
      <h3>⇲ Join Group</h3><div class="m-sub">Enter an invite link or channel code.</div>
      <div class="field"><label>Invite link / channel code</label><input id="j-code" placeholder="synapse.dev/j/ENG-CORE-42 or ENG-42" /></div>
      <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="do-join-team">Join Group</button></div>`,
    code: `
      <h3>⇲ Clone / Fork Repository</h3><div class="m-sub">Pull an external repository into ${esc(S.org)}.</div>
      <div class="field"><label>Repository URL</label><input id="j-url" placeholder="https://git.acme.dev/acme/notify-service.git" /></div>
      <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="do-clone-repo">⎇ Clone</button></div>`,
    ticket: `
      <h3>⇲ Connect External CI/CD Webhook</h3><div class="m-sub">Register a build system to push status into the board.</div>
      <div class="field"><label>Provider</label><select id="j-provider"><option>Jenkins</option><option>GitHub Actions</option><option>Woodpecker</option></select></div>
      <div class="field"><label>Webhook endpoint</label><input id="j-hook" placeholder="https://ci.acme.dev/hooks/synapse" /></div>
      <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="do-connect-hook">🔗 Connect</button></div>`,
    meet: `
      <h3>⇲ Join Meeting</h3><div class="m-sub">Enter a room code or paste a meeting link.</div>
      <div class="field"><label>Room code / link</label><input id="j-room" placeholder="AUTH-V2 or synapse.dev/m/AUTH-V2" /></div>
      <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="do-join-room">▶ Join</button></div>`,
  };
  openModal(forms[tab]);
}

function settingsModal() {
  const st = S.settings;
  const sw = (key, title, sub) => `
    <div class="switchrow">
      <div class="sw-txt"><b>${title}</b><span>${sub}</span></div>
      <button class="toggle ${st[key] ? "on" : ""}" data-act="setting-toggle" data-k="${key}"></button>
    </div>`;
  openModal(`
    <h3>⚙️ Settings &amp; Workspace</h3>
    <div class="m-sub">Account · notifications · on-device AI · theming</div>
    <div class="card flat setting-card">
      <h4>👤 Account</h4>
      <div style="display:flex;align-items:center;gap:11px;margin:8px 0 4px">
        ${avatarHTML("you", "lg", true)}
        <div><b>Priya Sharma</b><div class="dimtx" style="font-size:11px">priya@acme.dev · Staff Engineer</div></div>
        <span class="badge ${st.twofa ? "green" : "red"}" style="margin-left:auto">${st.twofa ? "🔐 2FA On" : "⚠️ 2FA Off"}</span>
      </div>
      ${sw("twofa", "Two-factor authentication", "TOTP + hardware key fallback")}
      <div class="section-label">Workspace tenant</div>
      <div class="tenant-row">
        <button class="tenant-btn ${st.tenant === "Personal" ? "active" : ""}" data-act="tenant" data-t="Personal">🏠 Personal</button>
        <button class="tenant-btn ${st.tenant === "Enterprise Org" ? "active" : ""}" data-act="tenant" data-t="Enterprise Org">🏢 Enterprise Org</button>
      </div>
    </div>
    <div class="card flat setting-card">
      <h4>🔔 Notifications</h4>
      ${sw("notifCI", "CI build failures", "Push when Jenkins / Woodpecker fails")}
      ${sw("notifMentions", "Meeting mentions", "When your name appears in a transcript")}
      ${sw("notifTickets", "Ticket assignment", "Push when assigned to you")}
    </div>
    <div class="card flat setting-card">
      <h4>⚡ On-device AI</h4>
      <div class="field" style="margin-top:8px"><label>Model runtime</label>
        <select data-act-change="runtime">
          ${["Snapdragon Hexagon NPU - ONNX", "Gemma-2B-INT4", "Whisper-Tiny"].map(r => `<option ${st.runtime === r ? "selected" : ""}>${r}</option>`).join("")}
        </select>
      </div>
      ${sw("offline", "Offline mode", "All inference stays on-NPU; sync pauses")}
    </div>
    <div class="card flat setting-card">
      <h4>🎨 Theme</h4>
      <div class="theme-row">
        <button class="theme-chip obsidian ${S.theme === "obsidian" ? "active" : ""}" data-act="theme" data-t="obsidian">Obsidian Dark</button>
        <button class="theme-chip neon ${S.theme === "neon" ? "active" : ""}" data-act="theme" data-t="neon">Cyber Neon</button>
        <button class="theme-chip light ${S.theme === "light" ? "active" : ""}" data-act="theme" data-t="light">Clean Light</button>
      </div>
    </div>
    <div class="dimtx" style="font-size:11px;text-align:center;margin-top:4px">
      <span class="kbd">1</span> Team · <span class="kbd">2</span> Code · <span class="kbd">3</span> Ticket · <span class="kbd">4</span> Meet · <span class="kbd">5</span> Settings
    </div>
    <div class="m-actions"><button class="btn" data-act="close-modal">Close</button></div>`);
}

function inviteModal() {
  openModal(`
    <h3>⚡ Instant Meeting — Invite</h3>
    <div class="m-sub">Pull in whole groups or individual teammates.</div>
    <div class="field"><label>Room name</label><input id="im-room" value="War Room — ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}" /></div>
    <div class="section-label" style="margin-top:2px">Groups</div>
    ${S.chats.filter(c => c.type === "group").map(c => `
      <label class="checkrow"><input type="checkbox" class="im-group" value="${c.id}" ${c.id === "engineering-core" ? "checked" : ""}/> <span class="gavatar" style="width:22px;height:22px;font-size:11px;background:${c.color}">#</span> ${esc(c.name)} <span class="dimtx" style="margin-left:auto;font-size:10px">${c.members} members</span></label>`).join("")}
    <div class="section-label">People</div>
    ${PEOPLE.filter(p => p.id !== "you").map(p => `
      <label class="checkrow"><input type="checkbox" class="im-person" value="${p.id}" ${p.presence !== "offline" ? "checked" : ""}/> ${avatarHTML(p.id, "", true)} ${esc(p.name)}</label>`).join("")}
    <div class="m-actions">
      <button class="btn" data-act="close-modal">Cancel</button>
      <button class="btn success" data-act="start-instant">📹 Start &amp; Send Invites</button>
    </div>`);
}

function scheduleModal() {
  const dt = new Date(Date.now() + DAY);
  dt.setMinutes(0, 0, 0);
  const pad = n => String(n).padStart(2, "0");
  const val = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours() + 1)}:00`;
  openModal(`
    <h3>🗓️ Schedule Meeting</h3>
    <div class="m-sub">Book a room with agenda &amp; participants.</div>
    <div class="field"><label>Title</label><input id="sm-title" placeholder="e.g. Token migration checkpoint" /></div>
    <div class="field"><label>Date &amp; time</label><input id="sm-when" type="datetime-local" value="${val}" /></div>
    <div class="field"><label>Agenda</label><textarea id="sm-agenda" rows="2" placeholder="What will be covered?"></textarea></div>
    <div class="section-label" style="margin-top:2px">Participants</div>
    ${PEOPLE.filter(p => p.id !== "you").map(p => `
      <label class="checkrow"><input type="checkbox" class="sm-person" value="${p.id}"/> ${avatarHTML(p.id, "", true)} ${esc(p.name)} <span class="dimtx" style="margin-left:auto;font-size:10px">${esc(p.role.split("·")[0])}</span></label>`).join("")}
    <div class="m-actions">
      <button class="btn" data-act="close-modal">Cancel</button>
      <button class="btn primary" data-act="do-schedule">🗓️ Schedule</button>
    </div>`);
}

/* ============================================================
   Re-render helpers
   ============================================================ */

function renderPanels() {
  if (S.view === "web") {
    const map = { team: teamHTML, meet: () => meetHTML(true), ticket: ticketHTML, code: codeHTML };
    Object.entries(map).forEach(([k, fn]) => {
      const el = document.querySelector(`[data-panel="${k}"]`);
      if (el) el.innerHTML = fn();
    });
    document.querySelectorAll(".ci-drawer").forEach(d => d.remove());
    const grid = $(".web-grid");
    if (EPH.ciDrawerOpen && grid) grid.insertAdjacentHTML("afterend", ciDrawerHTML());
  } else {
    const body = $("#phone-body");
    if (body) body.innerHTML = tabHTML(S.tab);
    const screen = $(".phone-screen");
    if (screen) {
      screen.querySelectorAll(".ci-drawer, .ci-drawer-fab").forEach(d => d.remove());
      if (S.tab === "ticket") {
        screen.insertAdjacentHTML("beforeend", ciFabHTML());
        if (EPH.ciDrawerOpen) screen.insertAdjacentHTML("beforeend", ciDrawerHTML());
      }
    }
    const nav = $(".bottom-nav");
    if (nav) nav.outerHTML = bottomNavHTML();
  }
  afterRenderPartial();
}

function afterRender() { afterRenderPartial(); bindSearchInput(); }

function afterRenderPartial() {
  bindLaser();
  bindKanbanDnD();
  paintMirrors();
  $$(".chat-msgs").forEach(el => { el.scrollTop = el.scrollHeight; });
  S.tickets.forEach(t => { if (t.justMoved) $$(`[data-ticket="${t.id}"]`).forEach(el => el.classList.add("just-moved")); });
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

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!e.target.closest(".me-menu-wrap") && EPH.meMenuOpen) { EPH.meMenuOpen = false; render(); }
  if (!e.target.closest(".searchwrap") && EPH.searchQ) {
    EPH.searchQ = "";
    $$(".search-results").forEach(x => x.remove());
    const gi = $("#global-search"); if (gi) gi.value = "";
  }
  if (!e.target.closest(".chat-input") && EPH.emojiOpen) { EPH.emojiOpen = false; $$(".emoji-pop").forEach(x => x.remove()); }
  if (!el) return;
  const act = el.dataset.act;

  switch (act) {
    /* ---- shell ---- */
    case "set-view": S.view = el.dataset.v; save(); render(); break;
    case "set-tab": S.tab = el.dataset.m; save(); render(); break;
    case "me-menu": EPH.meMenuOpen = !EPH.meMenuOpen; render(); break;
    case "pick-org": S.org = el.dataset.org; EPH.meMenuOpen = false; save(); render(); toast(`Workspace → ${S.org}`, "info", "🏢"); break;
    case "open-settings": EPH.meMenuOpen = false; render(); settingsModal(); break;
    case "modal-overlay": if (e.target === el) closeModal(); break;
    case "close-modal": closeModal(); break;
    case "dock-toggle": {
      const p = $(`#dock-${el.dataset.p}`);
      if (p) { p.classList.toggle("collapsed"); el.textContent = p.classList.contains("collapsed") ? "▸ open" : "▾ dock"; }
      break;
    }

    /* search */
    case "sr-ticket": EPH.searchQ = ""; S.tab = "ticket"; save(); render(); openTicketModal(el.dataset.data); break;
    case "sr-file": EPH.searchQ = ""; S.tab = "code"; S.code.file = el.dataset.data; S.code.mode = "view"; save(); render(); break;
    case "sr-chat": EPH.searchQ = ""; S.tab = "team"; save(); openChat(el.dataset.data); render(); break;
    case "sr-person": EPH.searchQ = ""; S.tab = "team"; save(); render(); startDM(el.dataset.data); break;

    /* ---- universal action bar ---- */
    case "ab-create": createMenuModal(el.dataset.tab); break;
    case "ab-join": joinMenuModal(el.dataset.tab); break;

    /* team create/join */
    case "form-new-group":
      openModal(`
        <h3>👥 New Group Channel</h3><div class="m-sub">Spin up a channel in ${esc(S.org)}.</div>
        <div class="field"><label>Channel name</label><input id="ng-name" placeholder="e.g. npu-benchmarks" /></div>
        <div class="field"><label>Description</label><input id="ng-desc" placeholder="What is it for?" /></div>
        <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="create-group">Create</button></div>`);
      break;
    case "create-group": {
      const name = ($("#ng-name").value.trim() || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
      if (!name) { invalidate("ng-name", "Channel needs a name"); break; }
      if (S.chats.some(c => c.id === name)) { invalidate("ng-name", `#${name} already exists`); break; }
      S.chats.push({ id: name, type: "group", name, desc: $("#ng-desc").value.trim() || "New channel", members: 1, fav: false, color: GROUP_COLORS[S.chats.length % GROUP_COLORS.length] });
      S.messages[name] = [];
      save(); broadcastState(); closeModal();
      openChat(name);
      toast(`#${name} created`, "success", "💬");
      break;
    }
    case "form-new-dm":
      openModal(`
        <h3>💬 New Direct Message</h3><div class="m-sub">Pick a teammate.</div>
        <div class="option-grid">
          ${PEOPLE.filter(p => p.id !== "you").map(p => `
          <button class="option-btn" data-act="create-dm" data-p="${p.id}"><span class="ob-ico">${avatarHTML(p.id, "", true)}</span><span><span class="ob-t">${esc(p.name)}</span><br><span class="ob-s">${esc(p.role)}</span></span></button>`).join("")}
        </div>
        <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button></div>`);
      break;
    case "create-dm": closeModal(); S.tab = "team"; save(); render(); startDM(el.dataset.p); break;
    case "start-dm": startDM(el.dataset.p); break;
    case "do-join-team": {
      const code = $("#j-code").value.trim();
      if (!code) { invalidate("j-code", "Enter an invite link or code"); break; }
      const name = ("joined-" + code.split("/").pop().toLowerCase().replace(/[^a-z0-9-]+/g, "-")).slice(0, 24);
      if (!S.chats.some(c => c.id === name)) {
        S.chats.push({ id: name, type: "group", name, desc: `Joined via invite ${code}`, members: 9, fav: false, color: GROUP_COLORS[5] });
        S.messages[name] = [{ who: "bot", text: `🤖 **SynapseBot** · You joined via invite \`${code}\`. Say hi! 👋`, ts: Date.now(), read: true }];
      }
      save(); broadcastState(); closeModal(); openChat(name);
      toast(`Joined #${name}`, "success", "🔗");
      break;
    }

    /* code create/join */
    case "form-new-repo":
      openModal(`
        <h3>📦 Create Repository</h3><div class="m-sub">Initialized with an empty <span class="mono">main</span> branch.</div>
        <div class="field"><label>Repository name</label><input id="nr-name" placeholder="acme/notify-service" value="acme/" /></div>
        <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="create-repo">Create</button></div>`);
      break;
    case "create-repo": {
      const name = $("#nr-name").value.trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-");
      if (!name || name === "acme/" || !name.includes("/")) { invalidate("nr-name", "Use owner/name format"); break; }
      if (S.repos[name]) { invalidate("nr-name", "Repository already exists"); break; }
      S.repos[name] = { access: "Owner · Admin", branches: ["main"], files: [], commits: [] };
      S.activeRepo = name; S.code = { ...S.code, branch: "main", file: null, mode: "view" };
      save(); broadcastState(); closeModal(); renderPanels();
      toast(`Repository ${name} created`, "success", "📦");
      break;
    }
    case "new-branch": case "form-new-branch":
      openModal(`
        <h3>⎇ Cut New Branch</h3><div class="m-sub">Branch off <span class="mono" style="color:var(--cyan)">${esc(S.code.branch)}</span> in ${esc(S.activeRepo)}.</div>
        <div class="field"><label>Branch name</label><input id="nb-name" placeholder="feature/TICK-105-…" value="feature/" /></div>
        <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="create-branch">⎇ Create</button></div>`);
      break;
    case "create-branch": {
      const name = $("#nb-name").value.trim();
      if (!name || name === "feature/") { invalidate("nb-name", "Branch needs a name"); break; }
      const R = repo();
      if (R.branches.includes(name)) { invalidate("nb-name", "Branch already exists"); break; }
      const base = S.code.branch;
      R.branches.push(name);
      R.files.forEach(f => { f.byBranch[name] = f.byBranch[base] ?? null; });
      S.code.branch = name;
      save(); broadcastState(); closeModal(); renderPanels();
      toast(`Branch Created — ${name} (from ${base})`, "success", "⎇");
      break;
    }
    case "new-file": case "form-new-file":
      openModal(`
        <h3>📄 Create New File</h3><div class="m-sub">Added on <span class="mono" style="color:var(--cyan)">${esc(S.code.branch)}</span> · ${esc(S.activeRepo)}</div>
        <div class="field"><label>File path</label><input id="nf-path" placeholder="src/notify/webhook.go" /></div>
        <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="create-file">Create &amp; open</button></div>`);
      break;
    case "create-file": {
      const path = $("#nf-path").value.trim().replace(/^\/+/, "");
      if (!path || !path.includes(".")) { invalidate("nf-path", "Give a path like src/foo.go"); break; }
      const R = repo();
      if (R.files.some(f => f.path === path)) { invalidate("nf-path", "File already exists"); break; }
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
      const tmpl = path.endsWith(".go") ? `package ${dir.split("/").pop() || "main"}\n\n// ${path}\n// TODO: implement\n` : `# ${path}\n`;
      const byBranch = {};
      R.branches.forEach(b => byBranch[b] = b === S.code.branch ? tmpl : null);
      R.files.push({ path, dir, byBranch });
      R.commits.unshift({ hash: randHash(), msg: `feat: add ${path}`, author: "Priya Sharma", ts: Date.now(), branch: S.code.branch, file: path, snapshot: tmpl });
      S.code.file = path; S.code.mode = "edit";
      save(); broadcastState(); closeModal(); renderPanels();
      toast(`${path} created on ${S.code.branch}`, "success", "📄");
      break;
    }
    case "do-clone-repo": {
      const url = $("#j-url").value.trim();
      if (!/^https?:\/\/.+\/.+/.test(url)) { invalidate("j-url", "Enter a valid https repo URL"); break; }
      const name = url.replace(/\.git$/, "").split("/").slice(-2).join("/").toLowerCase();
      if (!S.repos[name]) {
        S.repos[name] = {
          access: "Fork · Write Access", branches: ["main"],
          files: [{ path: "README.md", dir: ".", byBranch: { main: `# ${name}\n\nCloned from ${url}\nvia SynapseDev universal VCS bridge.\n` } }],
          commits: [{ hash: randHash(), msg: "clone: import external repository", author: "Priya Sharma", ts: Date.now(), branch: "main", file: "README.md", snapshot: `# ${name}` }],
        };
      }
      S.activeRepo = name; S.code = { ...S.code, branch: "main", file: "README.md", mode: "view" };
      save(); broadcastState(); closeModal(); renderPanels();
      toast(`Cloned ${name} — fork ready`, "success", "📦");
      break;
    }

    /* ticket create/join */
    case "form-new-ticket":
      openModal(`
        <h3>🎫 Create Manual Ticket</h3><div class="m-sub">Files into To Do on the ${esc(S.org)} board.</div>
        <div class="field"><label>Title</label><input id="nt-title" placeholder="e.g. Harden token refresh path" /></div>
        <div class="field"><label>Assignee</label><select id="nt-assignee">${PEOPLE.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Priority</label><select id="nt-priority"><option>Critical</option><option selected>High</option><option>Medium</option><option>Low</option></select></div>
        <div class="field"><label>Linked Git branch</label><input id="nt-branch" placeholder="feature/TICK-…" value="feature/" /></div>
        <div class="field"><label>CI Runner</label><select id="nt-runner"><option>Jenkins</option><option>GitHub Actions</option><option>Woodpecker</option></select></div>
        <div class="m-actions"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="create-ticket">Create Ticket</button></div>`);
      break;
    case "create-ticket": {
      const title = $("#nt-title").value.trim();
      if (!title) { invalidate("nt-title", "Give the ticket a title"); break; }
      const id = pushTicket({ title, assignee: $("#nt-assignee").value, priority: $("#nt-priority").value, branch: $("#nt-branch").value.trim() || "feature/unlinked", runner: $("#nt-runner").value });
      closeModal(); renderPanels();
      toast(`Ticket ${id} created in To Do`, "success", "🎫");
      break;
    }
    case "form-import-pending":
      closeModal();
      if (!S.pending.length) { toast("No pending meeting actions right now", "info", "📥"); break; }
      S.tab = "ticket"; save(); render();
      toast(`${S.pending.length} pending request(s) awaiting approval below`, "warn", "📥");
      break;
    case "approve-req": approveRequest(el.dataset.id); break;
    case "dismiss-req": S.pending = S.pending.filter(x => x.id !== el.dataset.id); save(); renderPanels(); toast("Request dismissed", "info", "✕"); break;
    case "do-connect-hook": {
      const hook = $("#j-hook").value.trim();
      if (!/^https?:\/\/.+/.test(hook)) { invalidate("j-hook", "Enter a valid webhook URL"); break; }
      const prov = $("#j-provider").value;
      ciLog(`✓ registered ${prov} webhook → ${hook}`, "lg-info");
      closeModal();
      toast(`${prov} webhook connected`, "success", "🔗");
      postBot("ci-alerts", `🔗 **${prov}** webhook registered → \`${hook}\` — build events will stream here.`);
      renderPanels();
      break;
    }
    case "ticket-filter": S.ticketFilter = el.dataset.f; save(); renderPanels(); break;
    case "open-ticket": openTicketModal(el.dataset.id); break;
    case "modal-move": moveTicket(el.dataset.id, el.dataset.col); closeModal(); toast(`${el.dataset.id} moved to ${KANBAN_COLS.find(c => c.id === el.dataset.col).label}`, "info", "🎯"); break;
    case "delete-ticket": S.tickets = S.tickets.filter(t => t.id !== el.dataset.id); save(); broadcastState(); closeModal(); renderPanels(); toast(`${el.dataset.id} deleted`, "error", "🗑"); break;
    case "toggle-ci-drawer": EPH.ciDrawerOpen = !EPH.ciDrawerOpen; renderPanels(); break;
    case "ci-jenkins": triggerJenkins(); break;
    case "ci-woodpecker": triggerWoodpecker(); break;

    /* team hub interactions */
    case "team-filter": S.teamFilter = el.dataset.f; save(); renderPanels(); break;
    case "open-chat": if (e.target.closest('[data-act="fav-chat"]')) break; openChat(el.dataset.c); break;
    case "back-chat": S.chatOpen = false; EPH.emojiOpen = false; save(); renderPanels(); break;
    case "fav-chat": { const c = S.chats.find(x => x.id === el.dataset.c); if (c) { c.fav = !c.fav; save(); renderPanels(); } break; }
    case "send-msg": sendChatMessage(); break;
    case "chat-attach": toast("Attachment picker — drag files here in the full build", "info", "📎"); break;
    case "chat-codefmt": {
      const inp = $("#chat-input-field");
      if (inp) { inp.value = inp.value + "\n```go\n\n```"; inp.focus(); }
      break;
    }
    case "chat-emoji": EPH.emojiOpen = !EPH.emojiOpen; renderPanels(); setTimeout(() => { const i = $("#chat-input-field"); if (i) i.focus(); }, 0); break;
    case "emoji-pick": {
      const inp = $("#chat-input-field");
      if (inp) { inp.value += el.dataset.e; inp.focus(); }
      break;
    }
    case "team-call": {
      const ch = S.chats.find(c => c.id === S.activeChat);
      S.tab = "meet"; S.meetSub = "live";
      S.meet.inCall = true;
      S.meet.video = el.dataset.kind === "video";
      S.meet.mic = true;
      S.meet.room = ch ? (ch.type === "group" ? "#" + ch.name : ch.name) + " — direct call" : "Direct call";
      save(); render();
      toast(`${el.dataset.kind === "video" ? "📹 Video" : "📞 Voice"} call started with ${ch ? ch.name : "team"}`, "success");
      break;
    }
    case "open-standup-chat": S.tab = "team"; save(); openChat("standup-notes"); render(); break;

    /* code hub interactions */
    case "pick-file": S.code.file = el.dataset.f; S.code.mode = "view"; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "code-edit": S.code.mode = "edit"; save(); renderPanels(); break;
    case "code-cancel": S.code.mode = "view"; save(); renderPanels(); toast("Edit discarded", "info", "↩"); break;
    case "code-diff": S.code.mode = "diff"; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "code-back": S.code.mode = "view"; save(); renderPanels(); break;
    case "diff-mode": S.code.diffMode = el.dataset.t; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "ai-explain": runAiExplain(); break;
    case "commit-open": {
      const ed = $("#file-editor");
      if (!ed) break;
      EPH.pendingEdit = ed.value;
      openModal(`
        <h3>✔ Commit Changes</h3><div class="m-sub">${esc(S.code.file)} @ <span class="mono" style="color:var(--cyan)">${esc(S.code.branch)}</span></div>
        <div class="field"><label>Commit message</label><input id="cm-msg" placeholder="fix(auth): tighten expiry handling" /></div>
        <div class="m-actions"><button class="btn" data-act="commit-abort">Back</button><button class="btn success" data-act="commit-confirm">✔ Commit</button></div>`);
      break;
    }
    case "commit-abort": closeModal(); renderPanels(); { const ed = $("#file-editor"); if (ed && EPH.pendingEdit != null) ed.value = EPH.pendingEdit; } break;
    case "commit-confirm": {
      const msg = $("#cm-msg").value.trim();
      if (!msg) { invalidate("cm-msg", "Write a commit message"); break; }
      const R = repo(), f = R.files.find(x => x.path === S.code.file);
      if (f && EPH.pendingEdit != null) {
        f.byBranch[S.code.branch] = EPH.pendingEdit;
        R.commits.unshift({ hash: randHash(), msg, author: "Priya Sharma", ts: Date.now(), branch: S.code.branch, file: f.path, snapshot: EPH.pendingEdit });
        S.code.mode = "view";
        EPH.pendingEdit = null;
        save(); broadcastState(); closeModal(); renderPanels();
        toast(`Committed ${R.commits[0].hash} to ${S.code.branch}`, "success", "✔");
        postBot("ci-alerts", `📦 New commit \`${R.commits[0].hash}\` on \`${S.code.branch}\` by **Priya** — _${msg}_`);
      }
      break;
    }

    /* meet hub interactions */
    case "meet-sub": S.meetSub = el.dataset.t; save(); renderPanels(); break;
    case "meet-video": S.meet.video = !S.meet.video; save(); renderPanels(); break;
    case "meet-mic": S.meet.mic = !S.meet.mic; save(); renderPanels(); toast(S.meet.mic ? "Mic unmuted" : "Mic muted", "info", S.meet.mic ? "🎙️" : "🔇"); break;
    case "meet-nc": S.meet.nc = !S.meet.nc; save(); renderPanels(); toast(`Noise suppression ${S.meet.nc ? "on — NPU voice isolation" : "off"}`, "info", "🌊"); break;
    case "meet-spatial": S.meet.spatial = !S.meet.spatial; save(); renderPanels(); toast(`Spatial audio ${S.meet.spatial ? "on — head-tracked" : "off"}`, "info", "🎧"); break;
    case "meet-end": {
      S.meet.inCall = false;
      S.meetings.history.unshift({
        id: "H-" + Date.now(), title: S.meet.room || "Ad-hoc call", date: Date.now(), duration: "24m",
        transcript: "Call ended — transcript archived. " + TRANSCRIPT_TEXT,
        doc: { agenda: ["Ad-hoc discussion"], decisions: ["—"], actions: ["—"] }, tickets: [],
      });
      save(); broadcastState(); renderPanels();
      toast("Call ended — archived to Meeting History", "info", "📼");
      break;
    }
    case "instant-meet": case "form-instant": closeModal(); inviteModal(); break;
    case "instant-invite": inviteModal(); break;
    case "start-instant": {
      const room = ($("#im-room") || {}).value || "Instant Meeting";
      const g = $$(".im-group:checked").length, p = $$(".im-person:checked").length;
      S.meet = { ...S.meet, inCall: true, video: true, mic: true, room };
      S.meetSub = "live"; S.tab = "meet";
      save(); closeModal(); render();
      toast(`Room "${room}" live — invites sent to ${g} group(s), ${p} member(s)`, "success", "⚡");
      postBot("general", `📹 **${room}** started by **Priya** — join from Meet Hub.`);
      break;
    }
    case "schedule-open": case "form-schedule": closeModal(); scheduleModal(); break;
    case "do-schedule": {
      const title = $("#sm-title").value.trim();
      const when = $("#sm-when").value;
      if (!title) { invalidate("sm-title", "Meeting needs a title"); break; }
      if (!when || new Date(when).getTime() < Date.now()) { invalidate("sm-when", "Pick a future date & time"); break; }
      const attendees = ["you", ...$$(".sm-person:checked").map(x => x.value)];
      S.meetings.scheduled.push({
        id: "M-" + Date.now(), title, when: new Date(when).getTime(),
        agenda: $("#sm-agenda").value.trim() || "No agenda provided.",
        attendees, room: title.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 12),
      });
      S.meetSub = "sched";
      save(); broadcastState(); closeModal(); renderPanels();
      toast("Meeting Scheduled ✅ Invites sent", "success", "🗓️");
      break;
    }
    case "join-sched": {
      const mt = S.meetings.scheduled.find(x => x.id === el.dataset.id);
      if (!mt) break;
      S.meet = { ...S.meet, inCall: true, video: true, room: mt.title };
      S.meetSub = "live";
      save(); renderPanels();
      toast(`Joined "${mt.title}"`, "success", "▶");
      break;
    }
    case "cancel-sched": S.meetings.scheduled = S.meetings.scheduled.filter(x => x.id !== el.dataset.id); save(); renderPanels(); toast("Meeting cancelled", "info", "🗓️"); break;
    case "do-join-room": {
      const code = $("#j-room").value.trim();
      if (!code) { invalidate("j-room", "Enter a room code or link"); break; }
      S.meet = { ...S.meet, inCall: true, room: "Room " + code.split("/").pop().toUpperCase() };
      S.meetSub = "live"; S.tab = "meet";
      save(); closeModal(); render();
      toast(`Joined ${S.meet.room}`, "success", "▶");
      break;
    }
    case "voice-sim": runVoiceSim(); break;
    case "auto-ticket": autoCreateTicket(); break;
    case "export-md": exportDoc("Standup — Auth Platform (2026-08-27)", {
      agenda: ["Daily standup — Auth Platform squad", "Auth middleware stability & CI health"],
      decisions: ["Confirmed race condition in the auth middleware session path", "Migrate v1/auth_handler.go → v2/auth_controller.go"],
      actions: ["John — refactor auth middleware to v2 controller (due today)", "John — verify Jenkins build passes on refactor branch"],
    }, TRANSCRIPT_TEXT); break;
    case "hist-toggle": {
      const h = S.meetings.history.find(x => x.id === el.dataset.id);
      if (h) { h.expanded = !h.expanded; save(); renderPanels(); }
      break;
    }
    case "hist-ticket": S.tab = "ticket"; save(); render(); openTicketModal(el.dataset.id); break;
    case "export-hist": {
      const h = S.meetings.history.find(x => x.id === el.dataset.id);
      if (h) exportDoc(h.title, h.doc, h.transcript);
      break;
    }

    /* settings */
    case "setting-toggle": {
      const k = el.dataset.k;
      S.settings[k] = !S.settings[k];
      save();
      el.classList.toggle("on", S.settings[k]);
      if (k === "offline") { render(); settingsModal(); toast(S.settings.offline ? "Offline mode ON — inference pinned to NPU" : "Back online — sync resumed", "info", S.settings.offline ? "⛔" : "🌐"); }
      if (k === "twofa") settingsModal();
      break;
    }
    case "tenant": S.settings.tenant = el.dataset.t; save(); settingsModal(); toast(`Tenant → ${el.dataset.t}`, "info", "🏢"); break;
    case "theme": S.theme = el.dataset.t; save(); render(); settingsModal(); toast(`Theme → ${el.textContent.trim()}`, "info", "🎨"); break;
    case "purge-cache":
      EPH.meMenuOpen = false;
      openModal(`
        <h3>🧹 Purge local cache?</h3>
        <div class="m-sub">Clears model weights cache and ALL prototype state (chats, tickets, repos, meetings). Resets the demo.</div>
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
  }
});

/* change events */
document.addEventListener("change", e => {
  const el = e.target.closest("[data-act-change]");
  if (!el) return;
  const v = el.value.replace(/^⎇ /, "");
  switch (el.dataset.actChange) {
    case "pick-repo": S.activeRepo = v; S.code = { ...S.code, branch: S.repos[v].branches[0], file: (S.repos[v].files[0] || {}).path || null, mode: "view" }; save(); renderPanels(); toast(`Switched to ${v}`, "info", "📦"); break;
    case "repo-branch": S.code.branch = v; S.code.mode = "view"; save(); renderPanels(); toast(`Checked out ${v}`, "info", "⎇"); break;
    case "diff-c1": S.code.c1 = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-c2": S.code.c2 = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fa": S.code.fa = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fb": S.code.fb = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fab": S.code.fab = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "diff-fbb": S.code.fbb = v; EPH.aiExplainState = "idle"; save(); renderPanels(); break;
    case "runtime": S.settings.runtime = v; save(); toast(`Runtime → ${v}`, "info", "⚡"); break;
  }
});

/* keyboard */
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target && e.target.id === "chat-input-field" && !e.shiftKey) { sendChatMessage(); return; }
  if (e.key === "Escape") { closeModal(); return; }
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  const map = { "1": "team", "2": "code", "3": "ticket", "4": "meet" };
  if (map[e.key]) {
    S.tab = map[e.key]; save(); render();
    if (S.view === "web") {
      const p = $(`#dock-${S.tab}`);
      if (p) { p.scrollIntoView({ behavior: "smooth", block: "nearest" }); p.style.outline = "2px solid var(--cyan)"; setTimeout(() => p.style.outline = "", 900); }
    }
  }
  if (e.key === "5") settingsModal();
});

/* ---------------- Ambient timers ---------------- */

setInterval(() => { $$(".status-time").forEach(el => el.textContent = nowClock()); }, 15000);
setInterval(() => { $$(".countdown").length && S.meetSub === "sched" && renderPanels(); }, 60000);

setInterval(() => {
  const tiles = $$(".vtile");
  if (!tiles.length) return;
  EPH.speakingIdx = (EPH.speakingIdx + 1) % tiles.length;
  tiles.forEach((t, i) => {
    t.classList.toggle("speaking", i === EPH.speakingIdx);
    const w = t.querySelector(".wave");
    if (w) w.style.display = i === EPH.speakingIdx ? "inline-flex" : "none";
  });
}, 2600);

/* ---------------- Boot ---------------- */
render();
