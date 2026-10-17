// Exercise the shipped bundle against the isolated local CPA fixture.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const webRequire = createRequire(
  require("node:path").join(__dirname, "../web/package.json"),
);
const { JSDOM, VirtualConsole } = webRequire("jsdom");
const { getByRole, getAllByRole, queryByRole, fireEvent, waitFor, within } =
  webRequire("@testing-library/dom");
const { server, page } = require("./preview.cjs");
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (error.type !== "not-implemented") errors.push(error.message);
  });
  const requests = [];
  const dom = new JSDOM(page(), {
    url: origin + "/ui",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.AbortController = AbortController;
      window.AbortSignal = AbortSignal;
      window.matchMedia = () => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      });
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      window.HTMLElement.prototype.scrollIntoView = function () {};
      const computed = window.getComputedStyle.bind(window);
      window.getComputedStyle = (element) => computed(element);
      window.fetch = (path, options = {}) => {
        requests.push({
          path: String(path),
          method: options.method || "GET",
          body: options.body && JSON.parse(options.body),
        });
        return fetch(new URL(path, origin), options);
      };
    },
  });
  global.window = dom.window;
  global.document = dom.window.document;
  const body = dom.window.document.body;
  const role = (role, name) => getByRole(body, role, { name, exact: true });
  const stat = (label, count) =>
    getByRole(body, "button", {
      name: new RegExp("^" + label + "\\s*" + count + "$"),
    });
  const wait = (fn) => waitFor(fn, { container: body, timeout: 15000 });
  try {
    await wait(() => assert(stat("当前凭证", 4)));
    assert(role("button", "测试全部 (3)"));
    const search = role("searchbox", "搜索凭证");
    fireEvent.input(search, { target: { value: "alpha" } });
    await wait(() => assert(stat("当前凭证", 1)));
    fireEvent.click(role("checkbox", "选择 workspace-alpha@example.test"));
    await wait(() => assert(role("button", "测试所选 (1)")));
    fireEvent.click(role("button", "测试所选 (1)"));
    await wait(() => assert(stat("测试中", 1)));
    await wait(() => assert(stat("可测试", 1)));
    const run = requests.find((r) => r.path.endsWith("/run"));
    assert.deepEqual(run.body.auth_ids, ["workspace-alpha@example.test"]);
    assert.deepEqual(
      run.body.model_catalog["workspace-alpha@example.test"],
      ["gpt-5.6-sol", "gpt-6-astra", "gpt-6.1-sol"].sort(),
    );
    assert.equal(run.body.runs, 1);
    fireEvent.click(role("button", "展开行"));
    await wait(() => assert(body.textContent.includes("历史记录")));
    fireEvent.click(body.querySelector(".history .ant-collapse-header"));
    await wait(() => assert(body.querySelector(".answer-markdown math")));
    const openAnswer = body.querySelector(".answer-markdown");
    dom.window.document.documentElement.dataset.theme = "dark";
    dom.window.document.documentElement.style.setProperty(
      "--accent",
      "#0f766e",
    );
    await wait(() =>
      assert(dom.window.document.head.textContent.includes("#0f766e")),
    );
    assert(openAnswer.isConnected, "theme changes preserve expanded history");
    fireEvent.click(role("tab", "模型指纹"));
    await wait(() => assert(role("combobox", "采集模式")));
    // Row expansion is intentionally retained while switching test types.
    if (queryByRole(body, "button", { name: "展开行", exact: true }))
      fireEvent.click(role("button", "展开行"));
    fireEvent.click(role("button", "查看详情"));
    await wait(() => assert(role("dialog", "模型指纹详情")));
    await wait(() => assert(body.textContent.includes("基准比对")));
    assert(body.textContent.includes("逐项比对"));
    fireEvent.click(
      within(role("dialog", "模型指纹详情")).getByRole("button", {
        name: "关闭",
        exact: true,
      }),
    );
    await wait(() =>
      assert(
        !queryByRole(body, "dialog", { name: "模型指纹详情", exact: true }),
      ),
    );
    fireEvent.click(role("button", "采集全部 (1)"));
    await wait(() => assert(role("button", "停止")));
    fireEvent.click(role("button", "停止"));
    await wait(() => assert(stat("可测试", 1)));
    assert(requests.some((r) => r.path.endsWith("/fingerprint/cancel")));
    fireEvent.click(role("tab", "ModelTrace"));
    await wait(() => assert(role("tabpanel", "ModelTrace")));
    if (queryByRole(body, "button", { name: "展开行", exact: true }))
      fireEvent.click(role("button", "展开行"));
    fireEvent.click(role("button", "查看详情"));
    await wait(() => assert(role("dialog", "ModelTrace详情")));
    await wait(() => assert(body.textContent.includes("候选模型排行")));
    assert(body.textContent.includes("挑战记录"));
    fireEvent.click(
      within(role("dialog", "ModelTrace详情")).getByRole("button", {
        name: "关闭",
        exact: true,
      }),
    );
    await wait(() =>
      assert(
        !queryByRole(body, "dialog", { name: "ModelTrace详情", exact: true }),
      ),
    );
    fireEvent.click(role("tab", "鹈鹕动画"));
    await wait(() => assert(role("button", "放大查看鹈鹕动画")));
    fireEvent.click(role("button", "放大查看鹈鹕动画"));
    await wait(() => assert(role("dialog", "鹈鹕动画详情")));
    await wait(() =>
      assert(
        body
          .querySelector('iframe[title="鹈鹕动画"]')
          .getAttribute("sandbox") === "allow-scripts",
      ),
    );
    fireEvent.click(
      within(role("dialog", "鹈鹕动画详情")).getByRole("button", {
        name: "关闭",
        exact: true,
      }),
    );
    await wait(() =>
      assert(
        !queryByRole(body, "dialog", { name: "鹈鹕动画详情", exact: true }),
      ),
    );
    fireEvent.click(role("tab", "糖果测试"));
    await wait(() => assert(role("tabpanel", "糖果测试")));
    fireEvent.click(role("button", "清空糖果测试记录"));
    await wait(() => assert(role("dialog", "清空糖果测试记录？")));
    assert.equal(
      requests.filter((r) => r.method === "DELETE").length,
      0,
      "opening clear confirmation must not delete",
    );
    fireEvent.click(
      within(role("dialog", "清空糖果测试记录？")).getByRole("button", {
        name: /^取\s*消$/,
      }),
    );
    await wait(() =>
      assert(
        !queryByRole(body, "dialog", {
          name: "清空糖果测试记录？",
          exact: true,
        }),
      ),
    );
    assert.equal(requests.filter((r) => r.method === "DELETE").length, 0);
    assert.deepEqual(errors, []);
    console.log(
      "Shipped React UI passed: search, selection, run and polling, history, fingerprint detail and cancellation, ModelTrace, sandboxed pelican, clear confirmation.",
    );
  } finally {
    dom.window.close();
    await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections?.();
  }
})().catch((error) => {
  console.error(String(error.stack || error).slice(0, 3500));
  process.exitCode = 1;
});
