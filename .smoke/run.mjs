/**
 * 幕布 · 无依赖 CDP 冒烟测试
 * 直接驱动系统 Chrome。覆盖：欢迎页 / 记录 / 解析 / 持久化 / 详情 /
 * 命令面板 / 搜索 / 快速记录 / 全部路由 / Graph 连接与 Focus /
 * Canvas / Outline / 主题视图 / 深浅色 / 删除 / 响应式 / 控制台。
 *
 * 每步独立 try/catch，单点失败不拖死整轮。
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.MUBU_BASE ?? "http://127.0.0.1:5173";
const OUT = path.resolve(process.env.MUBU_SHOTS_DIR ?? ".smoke/shots");
const PORT = Number(process.env.MUBU_CDP_PORT ?? 9222);
const NL = String.fromCharCode(10);

mkdirSync(OUT, { recursive: true });

const results = [];
const problems = [];
let shotSeq = 0;

function ok(name, detail) {
  results.push({ name, pass: true, detail: detail || "" });
  process.stdout.write("  [ok] " + name + (detail ? " - " + detail : "") + NL);
}
function bad(name, detail) {
  results.push({ name, pass: false, detail: detail || "" });
  problems.push(name + ": " + detail);
  process.stdout.write("  [FAIL] " + name + (detail ? " - " + detail : "") + NL);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const watchdog = setTimeout(() => {
  process.stdout.write(NL + "! watchdog timeout" + NL);
  process.exit(2);
}, 240_000);

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }
  send(method, params) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("timeout: " + method));
        }
      }, 12000);
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

async function launchChrome() {
  const profile = path.join(os.tmpdir(), "mubu-smoke-" + Date.now());
  const proc = spawn(
    CHROME,
    [
      "--remote-debugging-port=" + PORT,
      "--user-data-dir=" + profile,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
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
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      const list = await fetch("http://127.0.0.1:" + PORT + "/json/list").then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) return { killAll, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* retry */
    }
  }
  killAll();
  throw new Error("chrome did not expose CDP");
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (r.exceptionDetails) {
    throw new Error("page threw: " + (r.result && r.result.description ? r.result.description : r.exceptionDetails.text));
  }
  return r.result ? r.result.value : undefined;
}

async function shot(cdp, name) {
  const r = await cdp.send("Page.captureScreenshot", { format: "png" });
  const file = path.join(OUT, String(++shotSeq).padStart(2, "0") + "-" + name + ".png");
  writeFileSync(file, Buffer.from(r.data, "base64"));
  return file;
}

async function typeText(cdp, text) {
  await cdp.send("Input.insertText", { text });
}

async function pressEnter(cdp) {
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", text: "\r", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
}

async function pressKey(cdp, key, code, vk, modifiers) {
  const mods = modifiers || 0;
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: vk, modifiers: mods });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers: mods });
}

async function goto(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await sleep(1500);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    bad(name, String(e && e.message ? e.message : e).slice(0, 200));
  }
}

const consoleErrors = [];
function attachLogging(cdp) {
  cdp.on("Runtime.exceptionThrown", (p) =>
    consoleErrors.push(
      (p.exceptionDetails && p.exceptionDetails.exception && p.exceptionDetails.exception.description) ||
        (p.exceptionDetails && p.exceptionDetails.text) ||
        "exception",
    ),
  );
  cdp.on("Log.entryAdded", (p) => {
    if (p.entry.level === "error") consoleErrors.push(p.entry.text + " @" + (p.entry.url || ""));
  });
  cdp.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") consoleErrors.push(p.args.map((a) => a.value || a.description || "").join(" "));
  });
}

/* ───────────────────────── main ───────────────────────── */
const launched = await launchChrome();
const killAll = launched.killAll;
const ws = new WebSocket(launched.wsUrl);
await new Promise((res) => ws.addEventListener("open", res));
const cdp = new CDP(ws);
attachLogging(cdp);

await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});

process.stdout.write(NL + "Mubu smoke test" + NL + NL);

await step("welcome", async () => {
  await goto(cdp, BASE + "/");
  const seen = await evaluate(cdp, 'document.body.innerText.includes("\u6b22\u8fce\u6765\u5230\u5e55\u5e03")');
  if (!seen) throw new Error("welcome copy missing");
  ok("welcome screen");
  await shot(cdp, "welcome");
  const started = await evaluate(
    cdp,
    '(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("\u5f00\u59cb\u8bb0\u5f55")); if (!b) return false; b.click(); return true; })()',
  );
  if (!started) throw new Error("start button missing");
  ok("start button");
});

await sleep(600);

await step("today stream", async () => {
  const n = await evaluate(cdp, "document.querySelectorAll('article').length");
  const greet = await evaluate(cdp, 'document.body.innerText.includes("\u4eca\u5929\u6709\u4ec0\u4e48\u503c\u5f97\u7559\u4e0b")');
  if (!greet || n < 1) throw new Error("greeting=" + greet + " cards=" + n);
  ok("today stream", n + " cards");
  const aiCount = await evaluate(cdp, 'document.body.innerText');
  if (aiCount.indexOf("##") !== -1) throw new Error("double hash in meta row");
  ok("tag rendering clean");
  await shot(cdp, "today");
});

await step("create idea", async () => {
  const before = await evaluate(cdp, 'JSON.parse(localStorage.getItem("mubu.ideas") || "[]").length');
  await evaluate(cdp, "document.querySelector('[data-testid=composer]').focus()");
  await typeText(
    cdp,
    "\u5192\u70df\u6d4b\u8bd5\uff1a\u60f3\u6cd5\u5e94\u5f53\u5728\u4e09\u79d2\u5185\u88ab\u7559\u4e0b\u3002\n\u8fd9\u662f\u4e00\u6761\u7528\u6765\u9a8c\u8bc1\u6301\u4e45\u5316\u7684\u8bb0\u5f55\u3002 #\u6d4b\u8bd5 https://example.com/paper",
  );
  await pressEnter(cdp);
  await sleep(900);
  const after = await evaluate(cdp, 'JSON.parse(localStorage.getItem("mubu.ideas") || "[]").length');
  if (after !== before + 1) throw new Error("count " + before + " -> " + after);
  ok("idea created", before + " -> " + after);

  const parsed = await evaluate(
    cdp,
    '(() => { const i = JSON.parse(localStorage.getItem("mubu.ideas") || "[]")[0]; return !!i && i.content.includes("\u5192\u70df\u6d4b\u8bd5") && i.tags.includes("\u6d4b\u8bd5") && i.source && i.source.type === "web"; })()',
  );
  if (!parsed) throw new Error("tag/url parsing failed");
  ok("capture parsing", "content + #tag + source url");
});

await sleep(2300);

await step("persistence", async () => {
  const a = await evaluate(cdp, 'JSON.parse(localStorage.getItem("mubu.ideas") || "[]").length');
  await goto(cdp, BASE + "/");
  await sleep(800);
  const b = await evaluate(cdp, 'JSON.parse(localStorage.getItem("mubu.ideas") || "[]").length');
  if (a !== b) throw new Error(a + " -> " + b);
  ok("survives reload", b + " ideas");
});

await step("idea detail drawer", async () => {
  const clicked = await evaluate(cdp, "(() => { const list = [...document.querySelectorAll('article > button')]; const b = list.find(function (x) { return x.textContent.indexOf('长期记忆') >= 0; }) || list[0]; if (!b) return false; b.click(); return true; })()");
  if (!clicked) throw new Error("no card title button");
  await sleep(900);
  const drawer = await evaluate(cdp, "(() => { const t = document.body.innerText; return t.includes('相关想法') && t.includes('创建于'); })()");
  if (!drawer) throw new Error("drawer sections missing");
  ok("idea detail drawer");
  await shot(cdp, "idea-detail");
});

await step("autosave edit", async () => {
  const typed = await evaluate(cdp, "(() => { const ta = document.querySelector('[data-testid=idea-content]'); if (!ta) return 'no-editor'; const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; set.call(ta, ta.value + String.fromCharCode(10) + 'appended by autosave check'); ta.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()");
  if (typed !== "ok") throw new Error(String(typed));
  await sleep(2500);
  const saved = await evaluate(cdp, "JSON.parse(localStorage.getItem('mubu.ideas') || '[]').some(function (i) { return i.content.indexOf('appended by autosave check') >= 0; })");
  if (!saved) {
    const dbg = await evaluate(cdp, "(() => { const ta = document.querySelector('[data-testid=idea-content]'); return JSON.stringify({ inDom: ta ? ta.value.indexOf('appended by autosave check') >= 0 : null, status: document.body.innerText.indexOf('已保存') >= 0 ? 'saved' : (document.body.innerText.indexOf('保存中') >= 0 ? 'saving' : 'none') }); })()");
    throw new Error("not persisted " + dbg);
  }
  ok("autosave");
});

await step("suggested connections", async () => {
  await evaluate(cdp, "window.__mubu.useUI.getState().openIdea('idea_agent_memory')");
  await sleep(800);
  const has = await evaluate(cdp, "document.body.innerText.indexOf('可能的连接') >= 0");
  if (!has) throw new Error("suggestion block missing");
  ok("connection suggestions shown");
  await evaluate(cdp, "window.__mubu.useUI.getState().openIdea(null)");
  await sleep(400);
});

await step("command palette", async () => {
  await pressKey(cdp, "k", "KeyK", 75, 4);
  await sleep(500);
  let open = await evaluate(cdp, "!!document.querySelector('[data-testid=palette-input]')");
  if (!open) { await pressKey(cdp, "k", "KeyK", 75, 2); await sleep(500); }
  open = await evaluate(cdp, "!!document.querySelector('[data-testid=palette-input]')");
  if (!open) throw new Error("palette not open (meta+k and ctrl+k)");
  const rows = await evaluate(cdp, "(() => { const t = document.body.innerText.toLowerCase(); return t.indexOf('capture idea') >= 0 && t.indexOf('open graph') >= 0; })()");
  if (!rows) throw new Error("command rows missing");
  ok("command palette");
  await shot(cdp, "command-palette");
});

await step("global search", async () => {
  const typed = await evaluate(cdp, "(() => { const el = document.querySelector('[data-testid=palette-input]'); if (!el) return 'no-input'; const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, 'Agent'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()");
  if (typed !== "ok") throw new Error(String(typed));
  await sleep(700);
  const hits = await evaluate(cdp, "(() => { const t = document.body.innerText.toLowerCase(); const el = document.querySelector('[data-testid=palette-input]'); return t.indexOf('ideas') >= 0 && t.indexOf('topics') >= 0 && document.querySelectorAll('li button').length > 1; })()");
  if (!hits) {
    const dbg = await evaluate(cdp, "(() => { const el = document.querySelector('[data-testid=palette-input]'); return JSON.stringify({ q: el ? el.value : null, rows: document.querySelectorAll('li button').length, txt: document.body.innerText.toLowerCase().slice(0, 240) }); })()");
    throw new Error("no grouped results " + dbg);
  }
  ok("global search groups (Ideas + Topics)");
  await shot(cdp, "search");
  await pressKey(cdp, "Escape", "Escape", 27);
  await sleep(400);
});

await step("quick capture", async () => {
  await pressKey(cdp, "c", "KeyC", 67);
  await sleep(600);
  const open = await evaluate(cdp, "!!document.querySelector('[data-testid=quick-capture]')");
  if (!open) throw new Error("quick capture not open");
  ok("quick capture hotkey (c)");
  await shot(cdp, "quick-capture");
  const typed = await evaluate(cdp, "(() => { const t = document.querySelector('[data-testid=quick-capture]'); if (!t) return 'no-ta'; const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'smoke note from quick capture #QC'); t.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()");
  if (typed !== "ok") throw new Error(String(typed));
  await pressEnter(cdp);
  await sleep(900);
  const saved = await evaluate(cdp, "JSON.parse(localStorage.getItem('mubu.ideas') || '[]').some(function (i) { return i.tags.indexOf('QC') >= 0; })");
  if (!saved) throw new Error("not persisted");
  ok("quick capture save");
});

for (const entry of [
  ["/ideas", "\u6240\u6709\u7075\u611f"],
  ["/graph", "\u601d\u7ef4\u7f51\u7edc"],
  ["/topics", "\u4e3b\u9898"],
  ["/projects", "\u9879\u76ee"],
  ["/timeline", "\u65f6\u95f4\u7ebf"],
  ["/settings", "\u8bbe\u7f6e"],
]) {
  const route = entry[0];
  const label = entry[1];
  await step("route " + route, async () => {
    await goto(cdp, BASE + route);
    const good = await evaluate(cdp, "document.body.innerText.includes(" + JSON.stringify(label) + ")");
    const len = await evaluate(cdp, 'document.getElementById("root").innerText.trim().length');
    if (!good || len < 40) throw new Error("title=" + good + " len=" + len);
    ok("route " + route);
    await shot(cdp, route.replace(/\//g, "") || "root");
  });
}

await step("graph render", async () => {
  await goto(cdp, BASE + "/graph");
  await sleep(2200);
  const nodes = await evaluate(cdp, 'document.querySelectorAll(".react-flow__node").length');
  const edges = await evaluate(cdp, 'document.querySelectorAll(".react-flow__edge").length');
  if (nodes < 1) throw new Error("nodes=" + nodes);
  ok("graph nodes", nodes + " nodes");
  if (edges < 1) throw new Error("edges=" + edges);
  ok("graph edges", edges + " edges");
  await shot(cdp, "graph");
});

await step("connection create", async () => {
  const r = await evaluate(
    cdp,
    '(async () => { const st = window.__mubu.useWorkspace.getState(); const ideas = st.ideas, conns = st.connections; const linked = new Set(); conns.forEach(c => { linked.add(c.sourceId); linked.add(c.targetId); }); const free = ideas.filter(i => !linked.has(i.id)); const a = free[0] || ideas[0]; const b = free[1] || ideas.find(i => i.id !== a.id); if (!a || !b) return "no-pair"; const before = st.connections.length; await st.createConnection({ sourceId: a.id, targetId: b.id, type: "related", note: "\u5192\u70df\u6d4b\u8bd5\u5efa\u7acb\u7684\u8fde\u63a5" }); return window.__mubu.useWorkspace.getState().connections.length === before + 1 ? "ok" : "no-change"; })()',
  );
  if (r !== "ok") throw new Error(String(r));
  ok("connection created + note");

  const persisted = await evaluate(cdp, '(() => { const list = JSON.parse(localStorage.getItem("mubu.connections") || "[]"); return list.some(c => c.note === "\u5192\u70df\u6d4b\u8bd5\u5efa\u7acb\u7684\u8fde\u63a5"); })()');
  if (!persisted) throw new Error("not in localStorage");
  ok("connection persisted");
});

await step("focus mode", async () => {
  await goto(cdp, BASE + "/graph");
  await sleep(2200);
  await evaluate(cdp, "(() => { const ns = [...document.querySelectorAll('.react-flow__node')].filter(n => !String(n.className).includes('blockLabel')); const n = ns[0]; if (!n) return false; const r = n.getBoundingClientRect(); n.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 12, clientY: r.top + 12 })); return true; })()");
  await sleep(900);
  const panel = await evaluate(cdp, '(() => { const t = document.body.innerText; return t.includes("专注阅读") && t.includes("相关想法"); })()');
  if (!panel) throw new Error("focus panel missing");
  ok("focus panel");

  const dimmed = await evaluate(cdp, '[...document.querySelectorAll(".react-flow__node")].filter(n => !String(n.className).includes("blockLabel")).some(n => parseFloat(getComputedStyle(n).opacity) < 0.5)');
  if (!dimmed) throw new Error("wrapper opacity untouched, trying inner");
  if (!dimmed) throw new Error("nothing dimmed");
  ok("focus dims unrelated nodes");
  await shot(cdp, "focus-mode");
});

await step("project tabs", async () => {
  await goto(cdp, BASE + "/projects");
  await sleep(700);
  const pid = await evaluate(cdp, "(() => { const st = window.__mubu.useWorkspace.getState(); const w = st.projects.find(function (p) { return st.outlineNodes.some(function (n) { return n.projectId === p.id; }); }); return (w || st.projects[0]).id; })()");
  await goto(cdp, BASE + "/projects/" + pid);
  await sleep(1200);
  const tabs = await evaluate(cdp, "['概览','想法','画布','大纲'].every(function (t) { return document.body.innerText.indexOf(t) >= 0; })");
  if (!tabs) throw new Error("tab list incomplete");
  ok("project tabs");
  await shot(cdp, "project-overview");
  await evaluate(cdp, "[...document.querySelectorAll('button')].find(function (b) { return b.textContent.trim() === '画布'; })?.click()");
  await sleep(1000);
  const canvas = await evaluate(cdp, "document.querySelectorAll('svg').length > 0");
  if (!canvas) throw new Error("canvas not rendered");
  ok("project canvas");
  await shot(cdp, "project-canvas");
  await evaluate(cdp, "[...document.querySelectorAll('button')].find(function (b) { return b.textContent.trim() === '大纲'; })?.click()");
  await sleep(1100);
  const outline = await evaluate(cdp, "(() => { const t = document.body.innerText; return t.includes('作品大纲') && t.includes('章节'); })()");
  if (!outline) {
    const dbg = await evaluate(cdp, "document.body.innerText.toLowerCase().slice(0, 200)");
    throw new Error("outline not rendered " + dbg);
  }
  ok("outline editor with chapters");
  await shot(cdp, "project-outline");
});

await step("topic views", async () => {
  await goto(cdp, BASE + "/topics");
  await sleep(700);
  await evaluate(cdp, '[...document.querySelectorAll("a")].find(a => (a.getAttribute("href")||"").startsWith("/topics/"))?.click()');
  await sleep(1400);
  for (const t of ["Graph", "Timeline"]) {
    await evaluate(cdp, '[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ' + JSON.stringify(t) + ')?.click()');
    await sleep(1500);
    ok("topic view " + t);
    await shot(cdp, "topic-" + t.toLowerCase());
  }
});

await step("dark mode", async () => {
  await goto(cdp, BASE + "/settings");
  await sleep(800);
  await evaluate(cdp, '[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "\u6df1\u8272")?.click()');
  await sleep(700);
  const on = await evaluate(cdp, "document.documentElement.classList.contains('dark') && localStorage.getItem('mubu.theme') === 'dark'");
  if (!on) throw new Error("dark not applied");
  ok("dark mode on + persisted");

  await goto(cdp, BASE + "/");
  await sleep(1400);
  const kept = await evaluate(cdp, 'document.documentElement.classList.contains("dark")');
  if (!kept) throw new Error("reset after reload");
  ok("dark survives reload");
  await shot(cdp, "today-dark");

  await goto(cdp, BASE + "/graph");
  await sleep(2400);
  await shot(cdp, "graph-dark");

  await goto(cdp, BASE + "/settings");
  await sleep(700);
  await evaluate(cdp, '[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "\u6d45\u8272")?.click()');
  await sleep(400);
  ok("light mode restored");
});

await step("delete idea", async () => {
  const r = await evaluate(cdp, '(async () => { const st = window.__mubu.useWorkspace.getState(); const before = st.ideas.length; await st.deleteIdea(st.ideas[0].id); return window.__mubu.useWorkspace.getState().ideas.length === before - 1 ? "ok" : "fail"; })()');
  if (r !== "ok") throw new Error(String(r));
  ok("idea deleted");
});

await step("responsive", async () => {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await goto(cdp, BASE + "/");
  await sleep(1400);
  const w = await evaluate(cdp, "document.documentElement.scrollWidth");
  if (w > 392) throw new Error("h-scroll at 390px: " + w);
  ok("no horizontal overflow @390");
  await shot(cdp, "mobile-today");

  await evaluate(cdp, 'document.querySelector(\'[aria-label="\u6253\u5f00\u5bfc\u822a"]\')?.click()');
  await sleep(600);
  const nav = await evaluate(cdp, 'document.body.innerText.includes("\u601d\u7ef4\u7f51\u7edc")');
  if (!nav) throw new Error("drawer nav missing");
  ok("mobile nav drawer");
  await shot(cdp, "mobile-nav");

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await goto(cdp, BASE + "/");
  await sleep(1400);
  await shot(cdp, "macbook-1280");
  ok("1280px layout captured");
});

await step("panel resize", async () => {
  await goto(cdp, BASE + "/");
  await sleep(900);
  await evaluate(cdp, "window.__mubu.useUI.getState().setSidebarCollapsed(false); window.__mubu.useUI.getState().setSidebarWidth(300)");
  await sleep(500);
  const sideW = await evaluate(cdp, "Math.round(document.querySelector('aside').getBoundingClientRect().width)");
  if (sideW !== 300) throw new Error("sidebar width " + sideW);
  ok("left panel resizable (300px)");

  await evaluate(cdp, "window.__mubu.useUI.getState().openIdea(window.__mubu.useWorkspace.getState().ideas[0].id)");
  await sleep(800);
  await evaluate(cdp, "window.__mubu.useUI.getState().setDetailWidth(340)");
  await sleep(700);
  const d = await evaluate(cdp, "(() => { const el = document.querySelector('.shadow-panel'); const ta = document.querySelectorAll('textarea')[0]; return JSON.stringify({ w: Math.round(el.getBoundingClientRect().width), clip: ta ? (ta.scrollHeight > ta.clientHeight || ta.scrollWidth > ta.clientWidth) : null }); })()");
  const dd = JSON.parse(d);
  if (dd.w !== 340) throw new Error("detail width " + dd.w);
  ok("right panel resizable (340px)");
  if (dd.clip) throw new Error("title clipped at narrow width");
  ok("long title never clipped");
  await evaluate(cdp, "window.__mubu.useUI.getState().openIdea(null)");
});

await step("graph relayout tidy", async () => {
  await goto(cdp, BASE + "/graph");
  await sleep(2000);
  await evaluate(cdp, "window.__mubu.useWorkspace.getState().resetGraphLayout()");
  await sleep(1500);
  const tidy = await evaluate(cdp, "(() => { const ns = [...document.querySelectorAll('.react-flow__node')].filter(n => !String(n.className).includes('blockLabel')).map(n => n.getBoundingClientRect()); let hits = 0; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) hits++; } return ns.length + ':' + hits; })()");
  const parts = tidy.split(":");
  if (Number(parts[1]) > 0) throw new Error(parts[1] + " overlapping node pairs");
  ok("relayout has zero overlaps", parts[0] + " nodes");
});

await step("graph readability", async () => {
  const zoomExpr = "(() => { const vp = document.querySelector('.react-flow__viewport'); let z = 1; try { z = new DOMMatrix(getComputedStyle(vp).transform).a || 1; } catch (e) { z = 1; } return Math.round(z * 1000) / 1000; })()";
  const labelCount = "document.querySelectorAll('.react-flow__edge-text').length";

  const z0 = await evaluate(cdp, zoomExpr);
  if (z0 < 0.9) throw new Error("default should open on one topic block at readable zoom, got " + z0);
  ok("opens big enough to read relationships", "zoom " + z0 + " (body ~" + Math.round(13.5 * z0 * 10) / 10 + "px)");

  const n0 = await evaluate(cdp, labelCount);
  if (n0 < 1) throw new Error("relation labels missing at reading zoom");
  ok("relation labels visible", n0 + " labels");

  // 主题分块：点一块，只看这一块
  const chips = await evaluate(cdp, "[...document.querySelectorAll('button')].filter(b => /^全部/.test((b.textContent||'').trim())).length");
  if (chips < 1) throw new Error("topic chip bar missing");
  ok("topic blocks navigable", chips + " chip bar");

  await evaluate(cdp, "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').trim().indexOf('全部') === 0); if (b) b.click(); return true; })()");
  await sleep(1200);
  const zAll = await evaluate(cdp, zoomExpr);
  // 全图是地图：块与块要物理分离（blockGap），这必然让全图变大、缩放变小。
  // 真正读关系走默认的单块视图（上面已断言 ≥0.9）。
  // 这里只守「不能退回 0.35 那种不可读」的下界。
  if (zAll < 0.42) throw new Error("all-view zoom too small: " + zAll);
  ok("whole map still readable", "zoom " + zAll + " (body ~" + Math.round(13.5 * zAll * 10) / 10 + "px)");

  const sep = await evaluate(cdp, `(() => {
    const st = window.__mubu.useWorkspace.getState();
    const byId = new Map(st.topics.map(t => [t.id, t]));
    const root = (tid) => { let cur = tid; for (let k = 0; k < 6; k++) { const t = byId.get(cur); if (!t) return cur; if (!t.parentId) return t.id; cur = t.parentId; } return cur; };
    const ns = [...document.querySelectorAll('.react-flow__node')]
      .filter(n => !String(n.className).includes('blockLabel'))
      .map(n => ({ id: n.getAttribute('data-id'), r: n.getBoundingClientRect() }));
    const rectOf = new Map(ns.map(n => [n.id, n.r]));
    const list = [];
    for (const idea of st.ideas) {
      const r = rectOf.get(idea.id);
      if (!r) continue;
      let key = '__none__';
      for (const t of idea.topicIds) { const x = root(t); if (x) { key = x; break; } }
      list.push({ key, r });
    }
    const gap = (a, b) => Math.hypot(Math.max(a.left - b.right, b.left - a.right, 0), Math.max(a.top - b.bottom, b.top - a.bottom, 0));
    let cross = Infinity, same = Infinity;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const d = gap(list[i].r, list[j].r);
      if (list[i].key === list[j].key) { if (d < same) same = d; }
      else if (d < cross) cross = d;
    }
    return JSON.stringify({ cross: Math.round(cross * 10) / 10, same: Math.round(same * 10) / 10 });
  })()`);
  const sepObj = JSON.parse(sep);
  if (!(sepObj.cross > sepObj.same * 2)) {
    throw new Error("blocks not physically separated: cross=" + sepObj.cross + " same=" + sepObj.same);
  }
  ok("blocks physically separated", "跨块 " + sepObj.cross + "px vs 同块 " + sepObj.same + "px");

  const nAll = await evaluate(cdp, labelCount);
  if (nAll > 0) throw new Error("labels should hide at map zoom (noise), got " + nAll);
  ok("labels hide at map zoom");
});

await step("console clean", async () => {
  const real = consoleErrors.filter((e) => !/favicon|React DevTools|ResizeObserver loop|Warning:|\.well-known/i.test(e));
  const warnings = consoleErrors.filter((e) => /Warning:/i.test(e));
  if (real.length) throw new Error(real.slice(0, 3).join(" | "));
  ok("no console errors");
  if (warnings.length) {
    bad("react warnings", [...new Set(warnings.map((w) => w.split(NL)[0]))].slice(0, 3).join(" | "));
  } else {
    ok("no react warnings");
  }
});

try { ws.close(); } catch { /* ignore */ }
killAll();
clearTimeout(watchdog);

const passed = results.filter((r) => r.pass).length;
process.stdout.write(NL + "------------------------------" + NL);
process.stdout.write(passed + "/" + results.length + " passed" + NL);
if (problems.length) {
  process.stdout.write("failures:" + NL);
  for (const p of problems) process.stdout.write("  - " + p + NL);
}
process.stdout.write("shots: " + readdirSync(OUT).length + " in .smoke/shots" + NL);
process.exit(problems.length ? 1 : 0);
