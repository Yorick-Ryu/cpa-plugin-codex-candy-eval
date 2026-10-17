// Local-only preview with synthetic credentials. Never connects to CPA.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const web = path.join(__dirname, '../internal/plugin/web');
const read = name => fs.readFileSync(path.join(web, name), 'utf8');
const result = (ok, error) => ({time: '2026-10-17T12:30:00Z', model:'gpt-6.1-sol', effort:'low', ok, answer:ok ? '**答案：**21。经过逐项计算，共有 21 颗糖果。' : '答案是 18。', error, duration_ms:12540, input_tokens:14449, output_tokens:664, reasoning_tokens:368});
const auths = [
  ['workspace-alpha@example.test', 'team', [result(true), result(true), result(true)]],
  ['workspace-beta@example.test', 'team', [result(true), result(false)]],
  ['workspace-gamma@example.test', 'plus', [result(false, '上游请求超时，请稍后重试。')]],
  ['workspace-delta@example.test', 'pro', []],
].map(([id,plan_type,results],i) => ({id, name:id, source:'auth_files', provider:'codex', plan_type, disabled:i===3, results, fingerprints:[], modeltraces:[], pelicans:[]}));
let html = read('ui.html');
const scripts = {MARKDOWN:'vendor/markdown-it.min.js', CJK_FRIENDLY:'vendor/markdown-it-cjk-friendly.min.js', TEXMATH:'vendor/texmath.js', TEMML:'vendor/temml.min.js', CREDENTIALS:'credentials.js', CATALOG:'catalog.js', COMPONENTS:'components.js', CANDY:'candy.js', FINGERPRINT:'fingerprint.js', MODELTRACE:'modeltrace.js', PELICAN:'pelican.js', THEME:'theme.js', APP:'app.js'};
for (const [marker,file] of Object.entries(scripts)) {
  let script = read(file).replace('/*FINGERPRINT_CONFIG*/{}', JSON.stringify({modes:[{id:'quick',name:'快速',cells:4,samples_per_cell:15}],default_concurrency:2,max_concurrency:6})).replace('/*MODELTRACE_CONFIG*/{}', '{"requests":3,"default_concurrency":3,"max_concurrency":3}');
  if (marker === 'APP') script = script.slice(0,script.lastIndexOf('key = panelKey();')) + `
    credentials = ${JSON.stringify(auths)};
    catalogCache.models = {time: Date.now(), ids: ['gpt-6.1-sol','gpt-6-astra','gpt-5.6-sol']};
    fillModels(); document.getElementById('app').hidden = false; render();
    document.querySelector('.edition').textContent = 'LOCAL PREVIEW';
  `;
  html = html.replace('/*'+marker+'_SCRIPT*/', () => script);
}
html = html.replace('/*APP_STYLES*/', () => read('vendor/temml.css')+'\n'+read('theme.css')+'\n'+read('style.css')).replace('<!--PLUGIN_VERSION-->','0.3.16-omc.1').replace('<!--CANDY_PROMPT-->','此处展示糖果题原文；预览使用合成数据。').replace('<!--PELICAN_PROMPT-->','绘制鹈鹕骑自行车的 SVG 动画。');
const root = (mode) => `<!doctype html><html data-theme-mode="${mode}" style="--bg:${mode==='dark'?'#121214':'#fff'};--fg:${mode==='dark'?'#f4f4f6':'#1c1c1e'};--font-ui:ui-monospace,monospace"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--bg)}nav{padding:12px 24px;color:var(--fg);font:12px monospace;border-bottom:1px solid #71717a}iframe{border:0;width:100%;height:calc(100dvh - 42px)}</style><nav>OH MY CPA / 插件 / Codex 降智测试 <button onclick="document.documentElement.dataset.themeMode=document.documentElement.dataset.themeMode==='dark'?'light':'dark';document.documentElement.style.setProperty('--bg',document.documentElement.dataset.themeMode==='dark'?'#121214':'#fff');document.documentElement.style.setProperty('--fg',document.documentElement.dataset.themeMode==='dark'?'#f4f4f6':'#1c1c1e')">切换主题</button></nav><iframe title="OMC theme shell" src="/shell?mode=${mode}"></iframe></html>`;
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/ui') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(html); }
  if (url.pathname === '/shell') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(`<!doctype html><html data-theme="${url.searchParams.get('mode')==='light'?'light':'dark'}"><style>html,body,iframe{margin:0;border:0;width:100%;height:100%;display:block}</style><iframe title="Codex 降智测试" src="/ui"></iframe></html>`); }
  if (url.pathname === '/') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(root(url.searchParams.get('theme')==='light'?'light':'dark')); }
  // Deliberately disallow all API writes and external forwarding.
  res.writeHead(403, {'Content-Type':'application/json'}); res.end('{"error":"本地预览不执行管理操作或模型请求"}');
});
server.listen(Number(process.env.PREVIEW_PORT || 4178),'127.0.0.1', () => console.log('Synthetic OMC preview: http://127.0.0.1:'+server.address().port));
