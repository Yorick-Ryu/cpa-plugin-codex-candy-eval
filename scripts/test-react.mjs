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
const { parseState, verdict, available, provider } = module.exports;
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
assert.equal(parseState({ auths: [auth] })[0].id, "synthetic");
for (const malformed of [
  null,
  {},
  [],
  { auths: [{ ...auth, results: null }] },
  { auths: [{ ...auth, pelicans: [null] }] },
])
  assert.throws(() => parseState(malformed));
assert.equal(available(auth), true);
assert.equal(available({ ...auth, unavailable: true }), false);
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
