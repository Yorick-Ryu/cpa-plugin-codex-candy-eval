import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require("../web/node_modules/esbuild");
const bundled = await build({
  entryPoints: ["web/src/model.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const module = { exports: {} };
new Function("module", "exports", bundled.outputFiles[0].text)(
  module,
  module.exports,
);
const { parseState, verdict, available, provider, compareCredentialPriority } = module.exports;
globalThis.window = {CANDY_CONFIG: {detection: {aliases: {"gpt-6.1-sol":"gpt-6-astra", "deepseek-flash":"deepseek-v4.1-flash-1017"}}}};
const auth = {
  id: "synthetic",
  provider: "codex",
  source: "auth_files",
  disabled: false,
  results: [],
  detections: [],
  pelicans: [],
};
assert.equal(parseState({ credentials: [{...auth, candies: [], fingerprints: []}] })[0].id, "synthetic");
for (const malformed of [
  null,
  {},
  [],
  { credentials: [{ ...auth, candies: null, fingerprints: [] }] },
  { credentials: [{ ...auth, candies: [], fingerprints: [], pelicans: [null] }] },
])
  assert.throws(() => parseState(malformed));
assert.equal(available(auth), true);
const ordering = [
  { ...auth, id: 'supplier-first', source: 'ai_providers', priority: 100 },
  { ...auth, id: 'low', priority: -3 },
  { ...auth, id: 'same-first', priority: 10 },
  { ...auth, id: 'supplier-second', source: 'ai_providers', priority: 1000 },
  { ...auth, id: 'same-second', priority: 10 },
  { ...auth, id: 'high', priority: 100 },
];
assert.deepEqual(ordering.sort(compareCredentialPriority).map(a => a.id),
  ['high', 'same-first', 'same-second', 'low', 'supplier-first', 'supplier-second'],
  'credentials sort by priority; suppliers remain below every credential in their previous order');
assert.equal(available({ ...auth, unavailable: true }), true);
assert.equal(available({ ...auth, detection_running: { done: 0 } }), false);
assert.equal(
  provider({ ...auth, provider: "openai-compatible-synthetic" }),
  "openai-compatibility",
);
assert.equal(verdict({ ok: true }, "candy").tone, "success");
assert.equal(verdict({ ok: false }, "candy").tone, "danger");
assert.equal(verdict({ ok: true, error: "timeout" }, "candy").tone, "danger");
assert.equal(
  verdict({ skipped: true, error: "unsupported" }, "candy").tone,
  "neutral",
);
assert.equal(
  verdict(
    {
      status: "completed",
      model: "vendor/gpt-6.1-sol",
      attribution: { prediction: "gpt-6.1-sol" },
    },
    "detection",
  ).tone,
  "success",
);
assert.equal(
  verdict(
    {
      status: "completed",
      model: "gpt-6.1-sol",
      attribution: { prediction: "another-model" },
    },
    "detection",
  ).tone,
  "warn",
);
assert.equal(
  verdict(
    { status: "completed", model: "gpt-6.1-sol", attribution: { decision: "not_model" } },
    "detection",
  ).tone,
  "warn",
);
assert.equal(verdict({ status: "cancelled" }, "detection").tone, "neutral");
for (const [model, prediction] of [["vendor/gpt-6.1-sol", "gpt-6-astra"], ["deepseek-flash", "deepseek-v4.1-flash-1017"]]) {
  assert.equal(verdict({status:"completed", model, attribution:{prediction}}, "detection").tone,"success");
}
assert.equal(verdict({status:"partial", error:"one request failed", model:"gpt-6.1-sol", attribution:{prediction:"gpt-6-astra", probability:null}}, "detection").tone, "success");
assert.throws(() => parseState({auths:[{...auth,detections:null}]}));
const apiBundle = await build({
  entryPoints: ["web/src/api.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const apiModule = { exports: {} };
new Function("module", "exports", apiBundle.outputFiles[0].text)(
  apiModule,
  apiModule.exports,
);
const { api, setSessionKey, AuthError } = apiModule.exports;
const originalFetch = globalThis.fetch;
let resolve;
globalThis.fetch = () =>
  new Promise((done) => {
    resolve = done;
  });
setSessionKey("synthetic-old");
const stale = api("/fixture");
setSessionKey("synthetic-new");
resolve({ status: 401, ok: false, text: async () => '{"error":"expired"}' });
await assert.rejects(
  stale,
  (e) => !(e instanceof AuthError) && e.status === 401,
);
globalThis.fetch = async () => ({
  status: 401,
  ok: false,
  text: async () => '{"error":"expired"}',
});
await assert.rejects(api("/fixture"), (e) => e instanceof AuthError);
globalThis.fetch = originalFetch;
console.log(
  "React contracts passed: validated state, availability, verdicts, provider grouping, stale authentication.",
);

assert.equal(verdict({method:"ciallo", verdict:"pass", ok:true}, "candy").label, "Ciallo 通过");
assert.equal(verdict({method:"ciallo", verdict:"fail", ok:false}, "candy").label, "Ciallo 未通过");
assert.equal(verdict({method:"ciallo", verdict:"inconclusive", ok:false}, "candy").tone, "neutral");
assert.equal(verdict({method:"ciallo", error:"timeout"}, "candy").label, "请求出错");

const mixed = {...auth, results:[{ok:true}, {method:"ciallo", verdict:"pass", ok:true}]};
assert.equal(module.exports.recordsFor(mixed, "candy").length, 1);
assert.equal(module.exports.recordsFor(mixed, "ciallo")[0].method, "ciallo");
assert.equal(module.exports.progress({...auth, running:{method:"ciallo", total:1}}, "candy"), undefined);
assert.equal(module.exports.progress({...auth, running:{method:"ciallo", total:1}}, "ciallo").total, 1);
assert.equal(verdict({method:"ciallo", verdict:"pass"}, "ciallo").tone, "success");

const { initialKey } = apiModule.exports;
globalThis.location = {host: "fixture.test"};
Object.defineProperty(globalThis, "navigator", {value: {userAgent: "fixture-agent"}, configurable: true});
globalThis.sessionStorage = {getItem: () => "fallback"};
for (const [prefix, scope] of [["enc::v1::", "fixture.test|fixture-agent"], ["enc::v2::", "fixture.test"], ["enc::v2::", "v2|fixture.test"]]) {
  const secret = new TextEncoder().encode("cli-proxy-api-webui::secure-storage|" + scope);
  const bytes = new TextEncoder().encode(JSON.stringify({state:{managementKey:"synthetic-panel"}}));
  const encoded = Buffer.from(bytes.map((b,i) => b ^ secret[i % secret.length])).toString("base64");
  globalThis.localStorage = {getItem: () => prefix + encoded};
  assert.equal(initialKey(), "synthetic-panel");
}
globalThis.localStorage = {getItem: () => "enc::v2::invalid"};
assert.equal(initialKey(), "fallback");

// The native state projects historical Ciallo replies through the current rule.
for (const answer of ["Ciallo! 👋 What can I help you with?", "Ciallo～ 👋", "Ciallo～ 👋 What can I help you with?"]) {
  const rows = parseState({credentials:[{...auth,candies:[{method:"ciallo",answer,status:"correct",verdict:"pass",verdict_rule:"ciallo-word-v1"}],fingerprints:[]}]});
  const record = module.exports.recordsFor(rows[0], "ciallo")[0];
  assert.equal(verdict(record,"ciallo").label,"Ciallo 通过");
  assert.equal(record.ok,true);
  assert.equal(record.answer,answer);
}
assert.equal(verdict({method:"ciallo",status:"inconclusive",verdict:"inconclusive"},"ciallo").tone,"neutral");

// SIWC state is optional for older hosts; malformed new history is rejected.
assert.equal(parseState({credentials:[{...auth,candies:[],fingerprints:[]} ]})[0].siwc.length, 0);
assert.throws(() => parseState({credentials:[{...auth,candies:[],fingerprints:[],siwc:[null]}]}));
const siwc = {...auth, siwc_bound:true, use_siwc:true, siwc:[]};
assert.equal(module.exports.runBlocker(siwc, "siwc"), "");
for (const change of [{siwc_bound:false}, {use_siwc:false}, {source:"ai_providers"}, {provider:"claude"}, {siwc_running:{done:0}}])
  assert(module.exports.runBlocker({...siwc,...change}, "siwc"));
for (const [status,label,tone] of [["available","SIWC 可用","success"],["restricted","订阅共享受限","danger"],["limited","额度或频率受限","warn"],["auth_error","认证异常","danger"],["failed","检测未完成","danger"]])
  assert.deepEqual(verdict({status,error:status === "available" ? undefined : "fixture"},"siwc"),{label,tone});
const parsedSIWC = parseState({credentials:[{...siwc,candies:[],fingerprints:[],running:{test:"siwc",done:0,total:1}}]})[0];
assert.equal(module.exports.busy(parsedSIWC),true);
assert.equal(module.exports.progress(parsedSIWC,"siwc").total,1);
// Hosted OMC ignores stale CPA keys and does not expose a fabricated Authorization header.
globalThis.location.href = "https://fixture.test/omc/api/v1/plugin-host/v0/resource/plugins/omcpa-codex-candy-eval/ui";
assert.equal(initialKey(), apiModule.exports.HOST_SESSION);
let hostHeaders;
setSessionKey(initialKey());
globalThis.fetch = async (_url, options) => {hostHeaders = options.headers; return {ok:true,status:200,text:async()=>"{}"};};
await api("/fixture");
assert.equal(hostHeaders.Authorization,undefined);
await api("/fixture", {apiKey:"synthetic-client"});
assert.equal(hostHeaders.Authorization,"Bearer synthetic-client");
globalThis.fetch = async () => ({ok:false,status:401,text:async()=>"{}"});
await assert.rejects(api("/fixture"), /面板登录已过期/);
globalThis.fetch = originalFetch;
console.log("SIWC contracts and OMC session authentication passed.");
