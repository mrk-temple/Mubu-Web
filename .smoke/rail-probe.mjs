/** 侧栏折叠态的原生裁剪图 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://127.0.0.1:5173";
const OUT = path.resolve(".smoke/probe");
const PORT = 9226;
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

const profile = path.join(os.tmpdir(), "mubu-rail-" + Date.now());
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

await cdp.send("Page.navigate", { url: BASE + "/" }); await sleep(1800);
await ev('(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("\\u5f00\\u59cb\\u8bb0\\u5f55")); if (b) b.click(); return true; })()');
await sleep(400);
await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(500);

await cdp.send("Page.navigate", { url: BASE + "/graph" }); await sleep(2200);
await ev('window.__mubu.useWorkspace.getState().resetGraphLayout()');
await sleep(1800);

const geo = JSON.parse(await ev(`(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")];
  const vp = document.querySelector(".react-flow__viewport");
  let zoom = 1; try { zoom = new DOMMatrix(getComputedStyle(vp).transform).a || 1; } catch (e) { zoom = 1; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const n of ns) { const b = n.getBoundingClientRect();
    x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); }
  const pane = document.querySelector(".graph-pane").getBoundingClientRect();
  return JSON.stringify({ zoom: Math.round(zoom * 1000) / 1000, nodes: ns.length,
    contentCss: { w: Math.round((x1 - x0) / zoom), h: Math.round((y1 - y0) / zoom) },
    pane: { w: Math.round(pane.width), h: Math.round(pane.height) },
    fontSizeAtZoom: Math.round(13.5 * zoom * 10) / 10 });
})()`));
process.stdout.write("GRAPH " + JSON.stringify(geo) + NL);

const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 236, y: 56, width: 1204, height: 844, scale: 1 } });
writeFileSync(path.join(OUT, "graph-pane.png"), Buffer.from(shot.data, "base64"));
process.stdout.write("  shot graph-pane" + NL);

// 双击度数最高的节点 → 放大到这一系列
const zoomOf = `(() => { const vp = document.querySelector(".react-flow__viewport");
  let z = 1; try { z = new DOMMatrix(getComputedStyle(vp).transform).a || 1; } catch (e) { z = 1; }
  return Math.round(z * 1000) / 1000; })()`;
await ev(`(() => {
  const nodes = [...document.querySelectorAll(".react-flow__node")];
  let best = null, bestDeg = -1;
  for (const n of nodes) { const t = n.innerText || ""; const m = t.match(/(\d+) 条连接/); const d = m ? +m[1] : 0; if (d > bestDeg) { bestDeg = d; best = n; } }
  if (best) { const r = best.getBoundingClientRect();
    best.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 })); }
  return bestDeg;
})()`);
await sleep(1200);
const clusterZoom = await ev(zoomOf);
process.stdout.write("CLUSTER_ZOOM " + clusterZoom + " (fontSize " + Math.round(13.5 * clusterZoom * 10) / 10 + "px)" + NL);
const shot2 = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 236, y: 56, width: 1204, height: 844, scale: 1 } });
writeFileSync(path.join(OUT, "graph-cluster.png"), Buffer.from(shot2.data, "base64"));
process.stdout.write("  shot graph-cluster" + NL);

try { ws.close(); } catch {}
killAll();
process.stdout.write("done" + NL);
process.exit(0);
