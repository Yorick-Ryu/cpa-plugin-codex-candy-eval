// Local-only CPA fixture. Every credential and response below is synthetic.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const web = path.join(__dirname, "../internal/plugin/web");
const read = (n) => fs.readFileSync(path.join(web, n), "utf8");
const models = ["gpt-6.1-sol", "gpt-6-astra", "gpt-5.6-sol"];
const result = (ok, error) => ({
  time: "2026-10-17T12:30:00Z",
  model: models[0],
  effort: "low",
  ok,
  answer: ok
    ? "**答案：**21。经过逐项计算，共有 $3 \\times 7 = 21$ 颗糖果。"
    : "答案是 18。",
  error,
  duration_ms: 12540,
  input_tokens: 14449,
  output_tokens: 664,
  reasoning_tokens: 368,
});
const detection = {
  ...result(true), id: "detection-demo", status: "completed", concurrency: 3,
  attribution: {
    decision: "model", prediction: "gpt-6-astra", prediction_name: "gpt-6-astra / 6.1-sol",
    probability: 0.91, family_prediction_name: "GPT", used_outputs: 3,
    results: [
      {model: "gpt-6-astra", display_name: "gpt-6-astra / 6.1-sol", probability: 0.91},
      {model: "gpt-5.6-sol", display_name: "gpt-5.6-sol", probability: 0.09},
    ],
  },
  samples: [{instructions: "Generate independent samples.", prompt: "生成一组 1–355 的随机整数。", text: "123 42 355", parsed_numbers: 300, expected_count: 300, attempts: 1, accepted: true}],
};
const pl = {
  ...result(true),
  id: "pl-demo",
  html: "<!doctype html><style>body{display:grid;place-items:center;font:28px sans-serif;background:#edf6ff}span{animation:move 2s infinite alternate}@keyframes move{to{transform:translateX(100px)}}</style><span>🦤 🚲</span>",
};
const auths = [
  [
    "workspace-alpha@example.test",
    "team",
    [result(true), result(true), result(true)],
  ],
  ["workspace-beta@example.test", "team", [result(true), result(false)]],
  [
    "workspace-gamma@example.test",
    "plus",
    [result(false, "上游请求超时，请稍后重试。")],
  ],
  ["workspace-delta@example.test", "pro", []],
].map(([id, plan_type, results], i) => ({
  id,
  name: id,
  source: "auth_files",
  provider: "codex",
  plan_type,
  priority: 10,
  disabled: i === 3,
  results,
  detections: i === 0 ? [detection] : [],
  pelicans: i === 0 ? [{ ...pl, html: undefined }] : [],
}));
const config = {detection: {requests: 3, aliases: {"gpt-6.1-sol": "gpt-6-astra", "deepseek-flash": "deepseek-v4.1-flash-1017"}}};
function page() {
  let html = read("ui.html");
  const replacements = {
    APP: "react/app.js",
    THEME: "theme.js",
    MARKDOWN: "vendor/markdown-it.min.js",
    CJK_FRIENDLY: "vendor/markdown-it-cjk-friendly.min.js",
    TEXMATH: "vendor/texmath.js",
    TEMML: "vendor/temml.min.js",
  };
  for (const [marker, file] of Object.entries(replacements))
    html = html.replace("/*" + marker + "_SCRIPT*/", () => read(file));
  const prompt = (file) => {
    const text = fs.readFileSync(
      path.join(__dirname, "../internal/plugin", file),
      "utf8",
    );
    const raw = text.match(/const candyPrompt = `([\s\S]*?)`/);
    const value = raw
      ? raw[1]
      : text
          .match(/const pelicanPrompt = ([\s\S]*?)\n\n/)[1]
          .match(/"(?:\\.|[^"\\])*"/g)
          .map((part) => JSON.parse(part))
          .join("");
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  };
  return html
    .replace(
      "/*APP_STYLES*/",
      () =>
        read("vendor/temml.css") +
        "\n" +
        read("theme.css") +
        "\n" +
        read("react/app.css"),
    )
    .replace("/*REACT_CONFIG*/{}", () => JSON.stringify(config))
    .replace("<!--PLUGIN_VERSION-->", "0.4.0-omc.1")
    .replace("<!--CANDY_PROMPT-->", () => prompt("candy.go"))
    .replace("<!--PELICAN_PROMPT-->", () => prompt("pelican.go"))
    .replace(
      "<script>window.CANDY_CONFIG",
      '<script>sessionStorage.setItem("cpa-codex-candy-eval.key","synthetic-preview-management");</script><script>window.CANDY_CONFIG',
    );
}
const root = (mode) =>
  `<!doctype html><html data-theme-mode="${mode}" style="--bg:${mode === "dark" ? "#121214" : "#fff"};--fg:${mode === "dark" ? "#f4f4f6" : "#1c1c1e"};--font-ui:ui-monospace,monospace"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--bg)}nav{display:flex;gap:16px;align-items:center;padding:12px 24px;color:var(--fg);font:12px monospace;border-bottom:1px solid #71717a}iframe{border:0;width:100%;height:calc(100dvh - 46px)}</style><nav>OH MY CPA / 插件 / Codex 降智测试 <span style="opacity:.5">本地合成数据</span><button onclick="document.documentElement.dataset.themeMode=document.documentElement.dataset.themeMode==='dark'?'light':'dark';document.documentElement.style.setProperty('--bg',document.documentElement.dataset.themeMode==='dark'?'#121214':'#fff');document.documentElement.style.setProperty('--fg',document.documentElement.dataset.themeMode==='dark'?'#f4f4f6':'#1c1c1e')">切换主题</button><button onclick="document.documentElement.style.setProperty('--accent','#0f766e');document.documentElement.style.setProperty('--accent-hover','#0b5f59');document.documentElement.style.setProperty('--accent-active','#084c47')">自定义绿色</button></nav><iframe title="OMC theme shell" src="/shell?mode=${mode}"></iframe></html>`;
const send = (res, data, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let body = {};
  try {
    let text = "";
    for await (const chunk of req) text += chunk;
    if (text) body = JSON.parse(text);
  } catch {
    return send(res, { error: "invalid fixture request" }, 400);
  }
  if (url.pathname === "/ui") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    );
    return res.end(page());
  }
  if (url.pathname === "/shell") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      `<!doctype html><html data-theme="${url.searchParams.get("mode") === "light" ? "light" : "dark"}"><style>html,body,iframe{margin:0;border:0;width:100%;height:100%;display:block}</style><iframe title="Codex 降智测试" src="/ui"></iframe></html>`,
    );
  }
  if (url.pathname === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      root(url.searchParams.get("theme") === "light" ? "light" : "dark"),
    );
  }
  if (url.pathname === "/v0/management/config")
    return send(res, { "api-keys": ["synthetic-preview-client"] });
  if (url.pathname === "/v8/management/config/api-keys") return send(res, {});
  if (url.pathname === "/v1/models")
    return send(res, { data: models.map((id) => ({ id })) });
  if (url.pathname === "/v0/management/auth-files/models")
    return send(res, { models: models.map((id) => ({ id })) });
  if (url.pathname === "/v0/management/auth-files/status") {
    const a = auths.find((a) => a.id === body.name);
    if (a) a.disabled = body.disabled;
    return send(res, { status: "ok" });
  }
  const base = "/v0/management/plugins/cpa-codex-candy-eval";
  if (url.pathname === base + "/credentials/sync")
    return send(res, { ok: true });
  if (url.pathname === base + "/state")
    return send(res, { auths, storage_error: "" });
  if (url.pathname.endsWith("/record"))
    return send(
      res,
      url.pathname.includes("/detection/") ? detection : pl,
    );
  if (url.pathname.startsWith(base) && url.pathname.endsWith("/run")) {
    const test = url.pathname.includes("/detection/")
      ? "detection"
        : url.pathname.includes("/pelican/")
          ? "pelican"
          : "candy";
    const fields = {
      candy: "results",
      detection: "detections",
      pelican: "pelicans",
    };
    const running = {
      candy: "running",
      detection: "detection_running",
      pelican: "pelican_running",
    };
    const targets = auths.filter(
      (a) => body.auth_ids?.includes(a.id) && !a.disabled,
    );
    for (const a of targets) {
      a[running[test]] =
        test === "pelican"
          ? true
          : {
              done: 0,
              total: 3,
              model: body.model,
            };
      const task = a[running[test]];
      setTimeout(() => {
        if (a[running[test]] !== task) return;
        delete a[running[test]];
        a[fields[test]].push({
          ...{
            candy: result(true),
            detection,
            pelican: { ...pl, html: undefined },
          }[test],
          model: body.model,
          time: new Date().toISOString(),
        });
      }, 3500);
    }
    return send(res, {
      started: targets.length,
      skipped: 0,
      busy: 0,
      unchecked: 0,
    });
  }
  if (url.pathname.startsWith(base) && url.pathname.endsWith("/cancel")) {
    for (const a of auths) {
      delete a.detection_running;
    }
    return send(res, { ok: true });
  }
  if (
    req.method === "DELETE" &&
    url.pathname.startsWith(base) &&
    url.pathname.endsWith("/results")
  ) {
    for (const a of auths) {
      const fields = url.pathname.includes("/all/")
        ? ["results", "detections", "pelicans"]
        : [
            url.pathname.includes("/detection/")
              ? "detections"
                : url.pathname.includes("/pelican/")
                  ? "pelicans"
                  : "results",
          ];
      for (const field of fields) a[field] = [];
    }
    return send(res, { ok: true });
  }
  send(res, { error: "Local fixture refuses this operation" }, 403);
});
module.exports = { server, page, auths, models, detection };
if (require.main === module)
  server.listen(Number(process.env.PREVIEW_PORT || 4178), "127.0.0.1", () =>
    console.log(
      "Synthetic OMC preview: http://127.0.0.1:" + server.address().port,
    ),
  );
