"use strict";
const BASE = "/v0/management/plugins/omcpa-codex-candy-eval";
const KEY_STORE = "omcpa-codex-candy-eval.key";
const VIEW_STORE = "omcpa-codex-candy-eval.view.v1.";
const DEFAULT_MODEL = "gpt-6.1-sol";
const DEFAULT_EFFORT = "low";
const DEFAULT_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"];
const HIDDEN_MODEL = (id) => id.toLowerCase().includes("image");
const tabNames = ["candy", "detection", "pelican"];
const tabPrefixes = ["", "dt-", "pl-"];

let key = "";
let credentials = [];
let pollTimer = 0;
let loadError = "";
let loadController = null;
// Whether a refresh started with the button is running; polling never shows progress.
let refreshing = false;
let pending = false;
let storageError = "";
let clearScope = "candy";
// Enable changes in flight, by credential ID; reloads keep these requested states.
const switching = new Map();
const credentialFilter = {
  enabledOnly: preference("credential-filter.enabledOnly", false),
  type: preference("credential-filter.type", "auth_files:codex"),
  plan: preference("credential-filter.plan", "all"),
};

// The CPA management panel keeps its state in same-origin localStorage, optionally obfuscated.
function panelValue(name) {
  try {
    let raw = localStorage.getItem(name);
    if (!raw) return null;
    const prefix = "enc::v1::";
    if (raw.startsWith(prefix)) {
      const secret = new TextEncoder().encode("cli-proxy-api-webui::secure-storage|" + location.host + "|" + navigator.userAgent);
      const bin = atob(raw.slice(prefix.length));
      const bytes = Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ secret[i % secret.length]);
      raw = new TextDecoder().decode(bytes);
    }
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function panelKey() {
  const k = panelValue("cli-proxy-auth")?.state?.managementKey;
  return typeof k === "string" ? k.trim() : "";
}

class AuthError extends Error {}

async function api(path, { method = "GET", body, apiKey, signal } = {}) {
  const timeout = AbortSignal.timeout(30000);
  const requestKey = apiKey ?? key;
  const init = { method, cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Authorization: "Bearer " + requestKey } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let resp, text;
  try {
    resp = await fetch(path, init);
    text = await resp.text();
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error(err.name === "TimeoutError" ? "连接超时，请稍后重试。" : "无法连接 CPA，请检查网络后重试。");
  }
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  // A 401 for a key replaced by a newer login must not sign that login out.
  if (resp.status === 401 && apiKey === undefined && requestKey === key) throw new AuthError("管理密钥无效，请重新输入。");
  if (!resp.ok) {
    const err = data?.error;
    throw Object.assign(new Error(String((typeof err === "string" ? err : err?.message) || text || "HTTP " + resp.status).slice(0, 500)), { status: resp.status });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("服务器返回了无效数据，请稍后重试。");
  return data;
}

function stored(name) {
  try { return JSON.parse(localStorage.getItem(name)); } catch (_) { return null; }
}
function store(name, value) {
  try { localStorage.setItem(name, JSON.stringify(value)); } catch (_) {}
}
// Page choices are kept across visits; a saved value replaces its default only when the types match.
function preference(name, fallback) {
  const value = stored(VIEW_STORE + name);
  return value !== null && typeof value === typeof fallback ? value : fallback;
}
function savePreference(name, value) {
  store(VIEW_STORE + name, value);
}
function fillModels() {
  const ids = [...new Set(catalogCache.models?.ids || [])].sort(compareModels);
  const unsuffixed = ids.filter((id) => !/[()]/.test(id));
  for (const [id, models] of [["model", ids], ["dt-model", unsuffixed], ["pl-model", ids]]) {
    fillSelect(id, models, $(id).value || preference(id, DEFAULT_MODEL), DEFAULT_MODEL);
  }
}
// Rows are keyed by credential, and an update patches only the markup that changed, so the rest keeps its
// state, such as focus or a loaded preview.
const renderedLists = new Map();
function renderList(prefix, renderRow) {
  const list = $(prefix + "rows"), previous = renderedLists.get(list) || { rows: new Map(), empty: "" };
  const visible = visibleCredentials();
  if (!visible.length) {
    const message = loadController && !credentials.length ? "正在读取凭证和测试记录…" : "没有符合筛选条件的凭证，请调整筛选或在 CPA 中添加凭证。";
    const empty = `<div class="empty">${esc(loadError || message)}</div>`;
    if (previous.empty !== empty) list.innerHTML = empty;
    renderedLists.set(list, { rows: new Map(), empty });
    return;
  }
  const rows = new Map(visible.map((a) => {
    const html = renderRow(a), row = previous.rows.get(a.id);
    if (row?.html === html) return [a.id, row];
    return [a.id, { html, node: row ? patch(row.node, rowNode(html)) : rowNode(html) }];
  }));
  renderedLists.set(list, { rows, empty: "" });
  const kept = new Set([...rows.values()].map((row) => row.node));
  let cursor = list.firstChild;
  const dropStale = () => {
    while (cursor && !kept.has(cursor)) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
  };
  for (const { node } of rows.values()) {
    dropStale();
    if (node === cursor) cursor = cursor.nextSibling;
    else list.insertBefore(node, cursor);
  }
  dropStale();
  refreshTip();
}
// patch updates node to match next and returns the node now in place.
function patch(node, next) {
  if (node.isEqualNode(next)) return node;
  if (node.nodeName !== next.nodeName) {
    node.replaceWith(next);
    return next;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.nodeValue = next.nodeValue;
    return node;
  }
  for (const { name } of [...node.attributes]) if (!next.hasAttribute(name)) node.removeAttribute(name);
  for (const { name, value } of next.attributes) if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  // Once clicked, a checkbox no longer follows its checked attribute.
  if (node instanceof HTMLInputElement) node.checked = next.checked;
  const children = [...node.childNodes], updates = [...next.childNodes];
  updates.forEach((update, i) => children[i] ? patch(children[i], update) : node.append(update));
  for (const child of children.slice(updates.length)) child.remove();
  return node;
}
function rowNode(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild;
}

function renderPageActions() {
  $("clear-all").disabled = pending || credentials.every((a) => !a.results.length && !a.detections?.length && !a.pelicans?.length);
  $("refresh").disabled = pending || refreshing;
  $("refresh").setAttribute("aria-busy", refreshing);
}

function renderSummary() {
  const visible = visibleCredentials();
  const values = {
    "summary-total": visible.length,
    "summary-ready": visible.filter(availableCredential).length,
    "summary-running": visible.filter(credentialBusy).length,
    "summary-history": visible.filter((a) => [a.results, a.detections, a.pelicans].some((records) => records?.length)).length,
  };
  for (const [id, value] of Object.entries(values)) $(id).textContent = value.toLocaleString("en-US");
}

function render() {
  renderSummary();
  renderPageActions();
  setNotice("storage-error", storageError);
  renderCredentialFilters();
  renderCandy();
  renderDetection();
  renderPelican();
}

function stopPolling() {
  clearTimeout(pollTimer);
  loadController?.abort();
  loadController = null;
}

function stateCredentials(data) {
  const validRecord = (r) => r !== null && typeof r === "object" && !Array.isArray(r);
  if (!Array.isArray(data.auths) || data.auths.some((a) => !a || typeof a.id !== "string" || !a.id.trim() ||
    ["results", "detections", "pelicans"].some((field) => !Array.isArray(a[field]) || !a[field].every(validRecord)))) {
    throw new Error("服务器返回的测试记录格式无效。");
  }
  return data.auths;
}

async function load({ refresh = false } = {}) {
  stopPolling();
  const controller = new AbortController();
  loadController = controller;
  render();
  try {
    try {
      await refreshCatalog({ signal: controller.signal, force: refresh });
      if (controller.signal.aborted) return;
      fillModels();
      setNotice("catalog-error", "");
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof AuthError) return showLogin(err.message);
      setNotice("catalog-error", "读取凭证和模型列表失败：" + err.message);
    }
    const data = await api(BASE + "/state", { signal: controller.signal });
    if (controller.signal.aborted) return;
    credentials = stateCredentials(data);
    for (const a of credentials) if (switching.has(a.id)) a.disabled = switching.get(a.id);
    pruneCredentialCatalog();
    storageError = data.storage_error || "";
    loadError = "";
    setNotice("load-error", "");
    const ids = new Set(credentials.map((a) => a.id));
    const usable = new Set(credentials.filter(usableCredential).map((a) => a.id));
    const answers = new Set(credentials.flatMap((a) => a.results.map((r) => answerKey(a.id, r))));
    const pages = new Set(credentials.flatMap((a) => a.pelicans.map((r) => pelicanKey(a.id, r.id))));
    for (const expanded of [candyExpanded, dtExpanded, plExpanded]) {
      for (const id of expanded) if (!ids.has(id)) expanded.delete(id);
    }
    for (const selection of [candySelected, dtSelected, plSelected]) {
      for (const id of selection) if (!usable.has(id)) selection.delete(id);
    }
    for (const id of candyAnswersExpanded) if (!answers.has(id)) candyAnswersExpanded.delete(id);
    // Failed page loads retry with the next state.
    for (const [key, page] of pelicanPages) if (!pages.has(key) || page instanceof Error) pelicanPages.delete(key);
  } catch (err) {
    if (controller.signal.aborted) return;
    if (err instanceof AuthError) return showLogin(err.message);
    loadError = "读取测试记录失败：" + err.message;
    setNotice("load-error", loadError);
  } finally {
    if (loadController === controller) {
      loadController = null;
      render();
      pollTimer = setTimeout(load, credentials.some(credentialBusy) ? 2500 : 20000);
    }
  }
}

async function update(path, options, errorPrefix) {
  if (pending) return;
  pending = true;
  stopPolling();
  setNotice("flash", "");
  render();
  try {
    if (path.endsWith("/run")) {
      await refreshCatalog();
      fillModels();
      setNotice("catalog-error", "");
      if (!catalogCache.models?.ids.includes(options.body.model)) throw new Error("所选模型已不在模型列表中，请重新选择。");
      options.body.model_catalog = await modelCatalog(options.body.auth_ids || []);
    }
    const response = await api(BASE + path, options);
    if (path.endsWith("/run")) {
      const messages = [`已为 ${response.started || 0} 个凭证开始测试`];
      if (response.skipped) messages.push(`${response.skipped} 个凭证不支持所选模型，已跳过`);
      if (response.unchecked) messages.push(`${response.unchecked} 个凭证无法读取模型列表，仍会尝试测试`);
      if (response.busy) messages.push(`${response.busy} 个凭证正在测试，已跳过`);
      setNotice("flash", messages.join("；"), response.unchecked ? "warning" : "info");
    }
  } catch (err) {
    if (err instanceof AuthError) return showLogin(err.message);
    setNotice("flash", errorPrefix + "：" + err.message);
  } finally {
    pending = false;
    if (!$("app").hidden) await load();
  }
}

function showLogin(message) {
  stopPolling();
  key = "";
  try { sessionStorage.removeItem(KEY_STORE); } catch (_) {}
  resetCatalogCache();
  credentials = [];
  loadError = storageError = "";
  for (const collection of [candySelected, dtSelected, plSelected, candyExpanded, dtExpanded, plExpanded, candyAnswersExpanded, pelicanPages]) collection.clear();
  for (const id of notices.keys()) setNotice(id, "");
  hideTip();
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  render();
  $("app").hidden = true;
  $("login").hidden = false;
  $("login-error").hidden = !message;
  $("login-error").textContent = message || "";
  $("login-key").focus();
}

async function start() {
  setNotice("flash", "");
  $("login").hidden = true;
  $("app").hidden = false;
  const managementKey = key;
  await openCatalogCache(managementKey);
  if (managementKey !== key) return;
  fillModels();
  await load({ refresh: true });
}

function setMasked(masked) {
  document.body.classList.toggle("masked", masked);
  for (const prefix of tabPrefixes) {
    const button = $(prefix + "mask");
    button.setAttribute("aria-pressed", masked);
    button.innerHTML = icon(masked ? "eye" : "eye-off");
    setLabel(button, masked ? "取消脱敏" : "脱敏");
  }
}
function switchTab(name) {
  for (const tab of tabNames) {
    const active = name === tab;
    $("tab-" + tab).setAttribute("aria-selected", active);
    $("tab-" + tab).tabIndex = active ? 0 : -1;
    $(tab + "-panel").hidden = !active;
  }
  hideTip();
  savePreference("tab", name);
}
const BUSY_TESTS = [["running", "糖果测试"], ["detection_running", "指纹检测"], ["pelican_running", "鹈鹕测试"]];
const busyTest = (a) => BUSY_TESTS.find(([field]) => a[field])?.[1] || "";
const credentialBusy = (a) => !!busyTest(a);
const usableCredential = (a) => !a.disabled && !a.unavailable;
const availableCredential = (a) => usableCredential(a) && !credentialBusy(a);
// Why a test cannot start, shown on its disabled button; empty when it can.
const pageBlocker = (prefix) => !$(prefix + "model").value ? "模型列表为空，请刷新后重试" : pending ? "正在处理上一个操作，请稍候" : "";
function runBlocker(prefix, a) {
  if (a.disabled) return "凭证已停用，启用后才能测试";
  if (a.unavailable) return "凭证暂不可用：" + unavailableReason(a);
  if (credentialBusy(a)) return `${busyTest(a)}进行中，结束后才能开始新测试`;
  return pageBlocker(prefix);
}
const runnable = (prefix, a) => !runBlocker(prefix, a);
const selectedCredentials = (selection) => visibleCredentials().filter((a) => selection.has(a.id));
const batchCredentials = (selection) => {
  const selected = selectedCredentials(selection);
  return (selected.length ? selected : visibleCredentials()).filter(availableCredential);
};
async function setCredentialEnabled(id, enabled) {
  const a = credentials.find((entry) => entry.id === id);
  if (!a || switching.has(id)) return;
  switching.set(id, !enabled);
  a.disabled = !enabled;
  render();
  try {
    await api("/v0/management/auth-files/status", { method: "PATCH", body: { name: id, disabled: !enabled } });
  } catch (err) {
    if (err instanceof AuthError) return showLogin(err.message);
    setNotice("flash", (enabled ? "启用凭证失败：" : "停用凭证失败：") + err.message);
    const current = credentials.find((entry) => entry.id === id);
    if (current) current.disabled = enabled;
  } finally {
    switching.delete(id);
  }
  render();
  // Config API keys live in CPA's config, which the page syncs to the plugin.
  if (!$("app").hidden) await load({ refresh: a.source !== "auth_files" });
}
function renderSelection(prefix, selection, action) {
  const available = visibleCredentials().filter(availableCredential);
  const selected = selectedCredentials(selection);
  const targets = batchCredentials(selection);
  const button = $(prefix + "run-batch");
  button.innerHTML = `${icon("play")}${action}${selected.length ? "所选" : "全部"} (${targets.length})`;
  const blocker = pageBlocker(prefix) || (targets.length ? "" : selected.length ? "所选凭证均已停用、不可用或正在测试" : "当前列表没有可测试的凭证");
  button.disabled = !!blocker;
  button.dataset.tip = blocker;
  const checkbox = $(prefix + "select-all");
  checkbox.checked = available.length > 0 && available.every((a) => selection.has(a.id));
  checkbox.indeterminate = selected.length > 0 && !checkbox.checked;
  checkbox.disabled = pending || (!available.length && !selected.length);
}

function bindCollectionActions({ type, scope, expanded, renderRows, run, showDetail }) {
  const rows = $(type + "-rows"), dialog = $(type + "-detail");
  $(type + "-detail-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    rows.querySelector(`[data-${type}-detail="${CSS.escape(dialog.dataset.record)}"][data-${type}-credential="${CSS.escape(dialog.dataset.credential)}"]`)?.focus();
  });
  rows.addEventListener("click", (e) => {
    if (e.target.closest("label")) return;
    const action = (name) => e.target.closest(`[data-${type}-${name}]`)?.getAttribute(`data-${type}-${name}`);
    const runID = action("run");
    if (runID) return run({ auth_ids: [runID] });
    const cancelID = action("cancel");
    if (cancelID) return update(`/${scope}/cancel`, { method: "POST", body: { auth_ids: [cancelID] } }, "停止测试失败");
    const recordID = action("detail"), credentialID = action("credential");
    if (recordID && credentialID) return openResultDetail(type, scope, credentialID, recordID, showDetail);
    const toggleID = e.target.closest("[data-row]")?.dataset.row;
    if (toggleID) {
      expanded.has(toggleID) ? expanded.delete(toggleID) : expanded.add(toggleID);
      renderRows();
    }
  });
}

// CPA names each OpenAI-compatible provider after its config entry; they share one type.
const providerType = (a) => a.provider === "openai-compatibility" || a.provider.startsWith("openai-compatible-") ? "openai-compatibility" : a.provider;
const credentialType = (a) => a.source + ":" + providerType(a);
function credentialTypeLabel(type) {
  const [source, provider] = type.split(/:(.*)/);
  return `${source === "ai_providers" ? "AI 提供商" : "认证文件"} · ${provider}`;
}
const ofType = (a, type) => type === "all" || credentialType(a) === type;
const PRO_ALL = "Pro ALL";
// Plans of one credential type, best first, grouping Pro plans when there are several.
function planChoices(type) {
  const plans = [...new Map(credentials.filter((a) => ofType(a, type)).map(credentialPlan).filter(Boolean).map((plan) => [plan.label, plan])).values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  return [...(plans.filter((plan) => plan.pro).length > 1 ? [PRO_ALL] : []), ...plans.map((plan) => plan.label)];
}
function visibleCredentials() {
  const { enabledOnly, type, plan } = credentialFilter;
  const matches = (p) => plan === "all" || (plan === PRO_ALL ? p?.pro : p?.label === plan);
  return credentials.filter((a) => ofType(a, type) && (!enabledOnly || !a.disabled) && matches(credentialPlan(a))).sort((a, b) => planRank(a) - planRank(b));
}
// Every card shows the filter; chosen values stay listed while no credential matches them.
function renderCredentialFilters() {
  const { enabledOnly, type, plan } = credentialFilter;
  const types = [...new Set([type, ...credentials.map(credentialType)])].filter((t) => t !== "all").sort((a, b) => a.localeCompare(b));
  const plans = [...new Set([...planChoices(type), plan])].filter((p) => p !== "all");
  for (const prefix of tabPrefixes) {
    $(prefix + "enabled-only").checked = enabledOnly;
    fillSelect(prefix + "credential-type", [["all", "全部凭证"], ...types.map((t) => [t, credentialTypeLabel(t)])], type);
    fillSelect(prefix + "credential-plan", [["all", "所有订阅类型"], ...plans], plan);
    $(prefix + "plan-filter").hidden = !plans.length;
  }
}
function setCredentialFilter(change) {
  for (const [name, value] of Object.entries(change)) {
    credentialFilter[name] = value;
    savePreference("credential-filter." + name, value);
  }
  for (const selection of [candySelected, dtSelected, plSelected]) selection.clear();
  render();
}

function initializeLayout() {
  $("candy-credentials").innerHTML = credentialCard("", "糖果测试", ["凭证", "最近一次", "正确率", "最近 20 次"]);
  $("dt-credentials").innerHTML = credentialCard("dt-", "指纹检测", ["凭证", "归因结果", "测试模型", "测试时间"]);
  $("pl-credentials").innerHTML = credentialCard("pl-", "鹈鹕测试", ["凭证", "最近一次", "动画"]);
  $("notifications").innerHTML = ["flash", "load-error", "catalog-error", "storage-error"].map((id) => `<div id="${id}" class="global-flash" role="alert" hidden><span class="notice-symbol" aria-hidden="true"></span><span class="notice-message"></span><button class="notice-close" type="button" aria-label="隐藏提示" data-tip>${icon("x")}</button></div>`).join("");
}

// Events and initialization.
initializeLayout();
initializeTips();
initializeCopyButtons();
initializeCandy();
initializeDetection();
initializePelican();
document.querySelectorAll("[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.dataset.class); });

for (const id of ["flash", "load-error", "catalog-error", "storage-error"]) {
  $(id).querySelector(".notice-close").addEventListener("click", () => hideNotice(id));
}

$("refresh").addEventListener("click", async () => {
  if (pending) return;
  resetCatalogCache();
  refreshing = true;
  try {
    await load({ refresh: true });
  } finally {
    refreshing = false;
    renderPageActions();
  }
});


// Masking and credential filters apply to every tab, whichever card changes them.
setMasked(preference("masked", false));
renderCredentialFilters();
for (const prefix of tabPrefixes) {
  $(prefix + "mask").addEventListener("click", () => {
    const masked = !document.body.classList.contains("masked");
    setMasked(masked);
    savePreference("masked", masked);
  });
  $(prefix + "enabled-only").addEventListener("change", (e) => setCredentialFilter({ enabledOnly: e.target.checked }));
  $(prefix + "credential-type").addEventListener("change", (e) => {
    const type = e.target.value;
    setCredentialFilter({ type, plan: planChoices(type).includes(credentialFilter.plan) ? credentialFilter.plan : "all" });
  });
  $(prefix + "credential-plan").addEventListener("change", (e) => setCredentialFilter({ plan: e.target.value }));
}

for (const [id, scope] of [["clear", "candy"], ["dt-clear", "detection"], ["pl-clear", "pelican"], ["clear-all", "all"]]) {
  $(id).addEventListener("click", () => {
    clearScope = scope;
    $("clear-title").textContent = `${$(id).getAttribute("aria-label")}？`;
    $("confirm-clear").returnValue = ""; // Esc keeps the previous returnValue.
    $("confirm-clear").showModal();
  });
}
$("confirm-clear").addEventListener("close", () => {
  if ($("confirm-clear").returnValue !== "confirm") return;
  update(clearScope === "candy" ? "/results" : `/${clearScope}/results`, { method: "DELETE" }, "清空测试记录失败");
});

$("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  key = $("login-key").value.trim();
  try { sessionStorage.setItem(KEY_STORE, key); } catch (_) {}
  start();
});

for (const name of tabNames) {
  $("tab-" + name).addEventListener("click", () => switchTab(name));
  $("tab-" + name).addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === "Home" ? tabNames[0] : e.key === "End" ? tabNames.at(-1) : tabNames[(tabNames.indexOf(name) + (e.key === "ArrowRight" ? 1 : -1) + tabNames.length) % tabNames.length];
    switchTab(next); $("tab-" + next).focus();
  });
}
const savedTab = preference("tab", "candy");
switchTab(tabNames.includes(savedTab) ? savedTab : "candy");

for (const [prefix, type, selection, submit] of [["", "candy", candySelected, runCandy], ["dt-", "dt", dtSelected, runDetection], ["pl-", "pl", plSelected, runPelican]]) {
  // Each test keeps its own settings, saved by control after the control normalizes its value.
  $(prefix + "toolbar").addEventListener("change", (e) => savePreference(e.target.id, e.target.type === "number" ? e.target.valueAsNumber : e.target.value));
  $(prefix + "toolbar").addEventListener("submit", (e) => {
    e.preventDefault();
    const ids = batchCredentials(selection).map((a) => a.id);
    if (ids.length) submit({ auth_ids: ids });
  });
  $(prefix + "select-all").addEventListener("change", (e) => {
    for (const a of visibleCredentials()) {
      if (!e.target.checked) selection.delete(a.id);
      else if (availableCredential(a)) selection.add(a.id);
    }
    render();
  });
  $(prefix + "rows").addEventListener("change", (e) => {
    if (e.target.dataset.enable) return setCredentialEnabled(e.target.dataset.enable, e.target.checked);
    const id = e.target.getAttribute(`data-${type}-select`);
    if (!id) return;
    e.target.checked ? selection.add(id) : selection.delete(id);
    render();
  });
}
key = panelKey();
if (!key) { try { key = sessionStorage.getItem(KEY_STORE) || ""; } catch (_) {} }
key ? start() : showLogin("");
