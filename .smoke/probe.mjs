/**
 * 定点截图：复现 problom/ 里的两个问题，修完后对比。
 *   1) 侧栏折叠态
 *   2) 右侧详情栏长标题被裁
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://127.0.0.1:5173";
const OUT = path.resolve(".smoke/probe");
const PORT = 9223;
const NL = String.fromCharCode(10);
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0;
    this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else if (msg.method) for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("timeout " + method)); } }, 12000);
    });
  }
  on(m, fn) { if (!this.listeners.has(m)) this.listeners.set(m, []); this.listeners.get(m).push(fn); }
}

async function launch() {
  const profile = path.join(os.tmpdir(), "mubu-probe-" + Date.now());
  const proc = spawn(CHROME, [
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  const killAll = () => { try { spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch {} };
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return { killAll, wsUrl: page.webSocketDebuggerUrl };
    } catch {}
  }
  killAll(); throw new Error("no cdp");
}

const { killAll, wsUrl } = await launch();
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
const cdp = new CDP(ws);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

const evalJs = async (expr) => {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.result?.description ?? "err");
  return r.result?.value;
};
const shot = async (name) => {
  const r = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  process.stdout.write("  shot " + name + NL);
};
const goto = async (u) => { await cdp.send("Page.navigate", { url: u }); await sleep(1600); };

await goto(BASE + "/");
await evalJs(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("\u5f00\u59cb\u8bb0\u5f55")); if (b) b.click(); })()`);
await sleep(600);

// 造一条长标题的想法，专门复现「字体看不见」
await evalJs(`(async () => {
  const st = window.__mubu.useWorkspace.getState();
  await st.createIdea({
    title: "\u672a\u6765\u7684\u8f6f\u4ef6\u4e5f\u8bb8\u4e0d\u62e5\u6709 UI\uff0c\u800c\u662f\u62e5\u6709\u4e00\u4e2a Agent",
    content: "\u4e5f\u8bb8\u672a\u6765\u7684\u8f6f\u4ef6\u4e0d\u4f1a\u62e5\u6709 UI\uff0c\u800c\u662f\u62e5\u6709\u4e00\u4e2a Agent\u3002\\n\\n\u754c\u9762\u662f\u628a\u80fd\u529b\u7ffb\u8bd1\u7ed9\u4eba\u770b\uff0c\u5982\u679c\u6709\u4e00\u4e2a\u80fd\u542c\u61c2\u610f\u56fe\u7684\u4e1c\u897f\uff0c\u4e2d\u95f4\u8fd9\u5c42\u7ffb\u8bd1\u5c31\u53ef\u4ee5\u88ab\u538b\u7f29\u6389\u5927\u534a\u3002",
    tags: ["probe"]
  });
})()`);
await sleep(500);
await evalJs(`(() => { window.__mubu.useUI.getState().openIdea(window.__mubu.useWorkspace.getState().ideas[0].id); })()`);
await sleep(1500);
await shot("drawer-long-title");
const diag = await evalJs(`(() => {
  const ta = document.querySelector('textarea[aria-label="标题"]');
  const body = document.querySelector('[data-testid=idea-content]');
  const aside = document.querySelector('[role="dialog"]');
  const g = (el) => el ? {
    tag: el.tagName,
    cls: el.className.slice(0, 90),
    clientW: el.clientWidth, scrollW: el.scrollWidth, scrollH: el.scrollHeight,
    ws: getComputedStyle(el).whiteSpace,
    wb: getComputedStyle(el).wordBreak,
    ow: getComputedStyle(el).overflowWrap,
    value: (el.value || '').slice(0, 30)
  } : null;
  return JSON.stringify({ title: g(ta), body: g(body), aside: aside ? aside.getBoundingClientRect().width : null,
    rail: document.querySelector('aside[data-collapsed]') ? 'rail' : 'expanded',
    asideW: document.querySelector('aside') ? document.querySelector('aside').getBoundingClientRect().width : null }, null, 1);
})()`);
process.stdout.write("DIAG " + diag + NL);

// 折叠侧栏
await evalJs(`window.__mubu.useUI.getState().setSidebarCollapsed(true)`);
await sleep(700);
await shot("sidebar-collapsed");

// 折叠 + 深色
await evalJs(`window.__mubu.useUI.getState().setTheme("dark")`);
await sleep(600);
await shot("sidebar-collapsed-dark");

// 图：力导向重排
await evalJs(`window.__mubu.useUI.getState().setTheme("light"); window.__mubu.useUI.getState().setSidebarCollapsed(false)`);
await goto(BASE + "/graph");
await evalJs(`window.__mubu.useWorkspace.getState().resetGraphLayout()`);
await sleep(1600);
await shot("graph-relayout");

// 展开态对照
await evalJs(`window.__mubu.useUI.getState().setSidebarCollapsed(false)`);
await sleep(600);
await shot("sidebar-expanded-dark");

try { ws.close(); } catch {}
killAll();
process.stdout.write("done -> .smoke/probe/" + NL);
process.exit(0);
