/**
 * 详情栏几何 + 原生裁剪截图。
 * 把 drawer 区域单独截出来，避免看全屏缩略图时把「裁剪边界」误判成「文字被裁」。
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://127.0.0.1:5173";
const OUT = path.resolve(".smoke/probe");
const PORT = 9224;
const NL = String.fromCharCode(10);
const LF = String.fromCharCode(10);

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (!m.id || !this.pending.has(m.id)) return;
      const p = this.pending.get(m.id);
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("timeout " + method));
        }
      }, 12000);
    });
  }
}

const profile = path.join(os.tmpdir(), "mubu-drawer-" + Date.now());
const proc = spawn(
  CHROME,
  [
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const killAll = () => {
  try {
    spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    /* ignore */
  }
};

let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) {
  await sleep(250);
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const page = list.find((t) => t.type === "page");
    if (page?.webSocketDebuggerUrl) wsUrl = page.webSocketDebuggerUrl;
  } catch {
    /* retry */
  }
}
if (!wsUrl) {
  killAll();
  throw new Error("no cdp");
}

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
const cdp = new CDP(ws);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 2, mobile: false,
});

const ev = async (expr) => {
  const r = await cdp.send("Runtime.evaluate", {
    expression: expr, awaitPromise: true, returnByValue: true, userGesture: true,
  });
  if (r.exceptionDetails) throw new Error(r.result?.description ?? "page error");
  return r.result?.value;
};

await cdp.send("Page.navigate", { url: BASE + "/" });
await sleep(1800);

// 欢迎页 → 关掉快速记录浮层
await ev('(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("\\u5f00\\u59cb\\u8bb0\\u5f55")); if (b) b.click(); return true; })()');
await sleep(500);
await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(500);

// 造一条长标题想法并打开
const para = "\\u754c\\u9762\\u662f\\u628a\\u80fd\\u529b\\u7ffb\\u8bd1\\u7ed9\\u4eba\\u770b\\uff0c\\u5982\\u679c\\u6709\\u4e00\\u4e2a\\u80fd\\u542c\\u61c2\\u610f\\u56fe\\u7684\\u4e1c\\u897f\\uff0c\\u4e2d\\u95f4\\u8fd9\\u5c42\\u7ffb\\u8bd1\\u5c31\\u53ef\\u4ee5\\u88ab\\u538b\\u7f29\\u6389\\u5927\\u534a\\u3002";
await ev(`(async () => {
  const st = window.__mubu.useWorkspace.getState();
  const sep = String.fromCharCode(10) + String.fromCharCode(10);
  const idea = await st.createIdea({
    title: "\\u672a\\u6765\\u7684\\u8f6f\\u4ef6\\u4e5f\\u8bb8\\u4e0d\\u62e5\\u6709 UI\\uff0c\\u800c\\u662f\\u62e5\\u6709\\u4e00\\u4e2a Agent",
    content: "\\u4e5f\\u8bb8\\u672a\\u6765\\u7684\\u8f6f\\u4ef6\\u4e0d\\u4f1a\\u62e5\\u6709 UI\\uff0c\\u800c\\u662f\\u62e5\\u6709\\u4e00\\u4e2a Agent\\u3002" + sep + "${para}",
    tags: ["probe"],
  });
  window.__mubu.useUI.getState().openIdea(idea.id);
  return true;
})()`);
await sleep(1500);

const info = JSON.parse(await ev(`(() => {
  const ta = document.querySelector('textarea[aria-label="\\u6807\\u9898"]');
  const drawer = document.querySelector(".shadow-panel");
  const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
  return JSON.stringify({ title: box(ta), drawer: box(drawer), styleH: ta.style.height, scrollH: ta.scrollHeight,
    dialogs: document.querySelectorAll("[role=dialog]").length });
})()`));
process.stdout.write("GEOM " + JSON.stringify(info) + NL);

const clip = await cdp.send("Page.captureScreenshot", {
  format: "png",
  clip: { x: info.drawer.l, y: 0, width: info.drawer.w, height: 600, scale: 1 },
});
writeFileSync(path.join(OUT, "drawer-clip.png"), Buffer.from(clip.data, "base64"));

// 拖窄到 320，验证宽度变化后标题重新换行、重新增高（不被裁）
await ev('window.__mubu.useUI.getState().setDetailWidth(320)');
await sleep(900);
const narrow = await ev(`(() => {
  const ta = document.querySelector('textarea[aria-label="\\u6807\\u9898"]');
  const b = ta.getBoundingClientRect();
  return JSON.stringify({ w: Math.round(b.width), h: Math.round(b.height), styleH: ta.style.height, scrollH: ta.scrollHeight });
})()`);
process.stdout.write("NARROW " + narrow + NL);

const clip2 = await cdp.send("Page.captureScreenshot", {
  format: "png",
  clip: { x: info.drawer.l - 140, y: 0, width: 340, height: 600, scale: 1 },
});
writeFileSync(path.join(OUT, "drawer-narrow.png"), Buffer.from(clip2.data, "base64"));

try { ws.close(); } catch { /* ignore */ }
killAll();
process.stdout.write("done" + NL);
process.exit(0);
