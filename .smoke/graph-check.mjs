/** 图的分块 / 可读性体检 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://127.0.0.1:5173";
const OUT = path.resolve(".smoke/probe");
const PORT = 9229;
const NL = String.fromCharCode(10);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (!m.id || !this.pending.has(m.id)) return;
      const p = this.pending.get(m.id); this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("t " + method)); } }, 12000);
    });
  }
}

const profile = path.join(os.tmpdir(), "mubu-graph-" + Date.now());
const proc = spawn(CHROME, ["--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
  "--headless=new", "--no-first-run", "--no-default-browser-check", "--window-size=1440,900", "about:blank"],
  { stdio: "ignore" });
const killAll = () => { try { spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch {} };

let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) {
  await sleep(250);
  try { const l = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const p = l.find((t) => t.type === "page"); if (p?.webSocketDebuggerUrl) wsUrl = p.webSocketDebuggerUrl; } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
const cdp = new CDP(ws);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

const ev = async (e) => { const r = await cdp.send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.result?.description ?? "err"); return r.result?.value; };
const shot = async (name, clip) => {
  const r = await cdp.send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" });
  writeFileSync(path.join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  process.stdout.write("  shot " + name + NL);
};

await cdp.send("Page.navigate", { url: BASE + "/" }); await sleep(1800);
await ev('(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("\\u5f00\\u59cb\\u8bb0\\u5f55")); if (b) b.click(); return true; })()');
await sleep(400);
await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(400);

await cdp.send("Page.navigate", { url: BASE + "/graph" }); await sleep(2600);

const ZOOM = "(() => { const vp = document.querySelector('.react-flow__viewport'); let z = 1; try { z = new DOMMatrix(getComputedStyle(vp).transform).a || 1; } catch (e) { z = 1; } return Math.round(z * 1000) / 1000; })()";
const zDefault = await ev(ZOOM);
const chips = await ev("(() => { const t = document.body.innerText; return JSON.stringify({ hasAll: t.indexOf('\\u5168\\u90e8') >= 0, n: (t.match(/\\u5168\\u90e8/g) || []).length }); })()");
process.stdout.write("DEFAULT_ZOOM " + zDefault + " (body ~" + Math.round(13.5 * zDefault * 10) / 10 + "px)  chips=" + chips + NL);
await shot("g1-default-block", { x: 236, y: 56, width: 1204, height: 844, scale: 1 });

// 点「全部」看全图
await ev("(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.indexOf('\\u5168\\u90e8') >= 0); if (b) b.click(); return true; })()");
await sleep(1100);
const zAll = await ev(ZOOM);
const labels = await ev("(() => document.body.innerText.match(/(supports|inspired|extends|conflicts|related|source)/g) || []).length");
process.stdout.write("ALL_ZOOM " + zAll + " (body ~" + Math.round(13.5 * zAll * 10) / 10 + "px)  edgeLabels=" + labels + NL);
await shot("g2-all", { x: 236, y: 56, width: 1204, height: 844, scale: 1 });

// 放大到某个主题块
const blockInfo = await ev(`(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter(n => !n.className.includes("blockLabel"));
  // 按屏幕位置把节点分簇，检查同主题是否挨在一起
  const pts = ns.map(n => { const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, topic: (n.innerText || "").split(String.fromCharCode(10)).slice(-1)[0] }; });
  let same = 0, tot = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    tot++; if (pts[i].topic === pts[j].topic && d < 420) same++;
    if (pts[i].topic !== pts[j].topic && d < 130) same += 0; }
  return JSON.stringify({ nodes: ns.length, closeSameTopicRatio: Math.round(100 * same / Math.max(1, tot)) });
})()`);
process.stdout.write("GROUPING " + blockInfo + NL);

await ev("(() => { const b = [...document.querySelectorAll('button')].find(x => { const t = x.textContent || ''; return t.indexOf('\\u4ea7\\u54c1') >= 0 || t.indexOf('AI') >= 0; }); if (b) b.click(); return true; })()");
await sleep(1100);
const zBlock = await ev(ZOOM);
const labels2 = await ev("(() => document.body.innerText.match(/(supports|inspired|extends|conflicts|related|source)/g) || []).length");
process.stdout.write("BLOCK_ZOOM " + zBlock + " (body ~" + Math.round(13.5 * zBlock * 10) / 10 + "px)  edgeLabels=" + labels2 + NL);
await shot("g3-block", { x: 236, y: 56, width: 1204, height: 844, scale: 1 });

// ── 交叉数：用 store 的连接关系 + 节点中心（相似变换下交叉数不变） ──
const crossings = await ev(`(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")]
    .filter(n => !String(n.className).includes("blockLabel"))
    .map(n => { const b = n.getBoundingClientRect();
      return { id: n.getAttribute("data-id"), x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const byId = new Map(ns.map(n => [n.id, n]));
  const conns = window.__mubu.useWorkspace.getState().connections;
  const links = conns.map(c => ({ a: byId.get(c.sourceId), b: byId.get(c.targetId) }))
                     .filter(l => l.a && l.b);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const hit = (p1, p2, q1, q2) => { const d1 = cross(q1,q2,p1), d2 = cross(q1,q2,p2), d3 = cross(p1,p2,q1), d4 = cross(p1,p2,q2); return d1*d2 < 0 && d3*d4 < 0; };
  let n = 0, pairs = 0;
  for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) {
    const A = links[i], B = links[j];
    if (A.a.id === B.a.id || A.a.id === B.b.id || A.b.id === B.a.id || A.b.id === B.b.id) continue;
    pairs++; if (hit(A.a, A.b, B.a, B.b)) n++;
  }
  return JSON.stringify({ edges: links.length, pairCandidates: pairs, crossings: n,
    ratio: pairs ? Math.round(1000 * n / pairs) / 10 : null });
})()`);
process.stdout.write("CROSSINGS " + crossings + NL);

// ── 块的物理分离：跨块最近的两张卡片要留出可见的间距 ──
const sep = await ev(`(() => {
  const st = window.__mubu.useWorkspace.getState();
  const topics = st.topics, ideas = st.ideas;
  const byId = new Map(topics.map(t => [t.id, t]));
  const root = (tid) => { let cur = tid; for (let i = 0; i < 6; i++) { const t = byId.get(cur); if (!t) return cur; if (!t.parentId) return t.id; cur = t.parentId; } return cur; };
  const cluster = (idea) => { for (const t of idea.topicIds) { const r = root(t); if (r) return r; } return "__none__"; };

  const ns = [...document.querySelectorAll(".react-flow__node")]
    .filter(n => !String(n.className).includes("blockLabel"))
    .map(n => ({ id: n.getAttribute("data-id"), r: n.getBoundingClientRect() }));
  const map = new Map(ns.map(n => [n.id, n.r]));
  const grp = new Map();
  for (const idea of ideas) { const r = map.get(idea.id); if (r) grp.set(idea.id, { key: cluster(idea), r }); }

  const dist = (a, b) => {
    const dx = Math.max(a.left - b.right, b.left - a.right, 0);
    const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
    return Math.hypot(dx, dy);
  };
  let min = Infinity, pairs = 0;
  const list = [...grp.values()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (list[i].key === list[j].key) continue;
    pairs++; min = Math.min(min, dist(list[i].r, list[j].r));
  }
  // 同块内最近间距作对照
  let minSame = Infinity;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (list[i].key !== list[j].key) continue;
    minSame = Math.min(minSame, dist(list[i].r, list[j].r));
  }
  return JSON.stringify({ nodes: list.length, crossPairs: pairs,
    minCrossBlockGap: Math.round(min * 10) / 10, minSameBlockGap: Math.round(minSame * 10) / 10 });
})()`);
process.stdout.write("SEPARATION " + sep + NL);

try { ws.close(); } catch {}
killAll();
process.stdout.write("done" + NL);
process.exit(0);
