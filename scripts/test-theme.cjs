const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function verifyAppearance(source) {
  function setup({ crossOrigin = false, host = true } = {}) {
    const values = new Map();
    const palette = new Map([
      ["--fg", "#fafafa"],
      ["--font-ui", "Operator UI"],
      ["--font-mono", "Operator Code"],
      ["--primary", "#723abc"],
      ["--hairline", "1px"],
    ]);
    const read = () => ({
      *[Symbol.iterator]() {
        yield* palette.keys();
      },
      getPropertyValue: (key) => palette.get(key) || "",
    });
    const faceCSS = { cssConnected: true };
    const faceJS = { family: "Operator UI" };
    const faces = new Set([faceCSS, faceJS]);
    const mirrored = new Set();
    const root = {
      dataset: {},
      toggleAttribute(name, on) {
        this[name] = on;
      },
      style: {
        setProperty: (k, v) => values.set(k, v),
        removeProperty: (k) => values.delete(k),
      },
    };
    const fontStyle = { dataset: {}, textContent: "" };
    const head = {
      append(element) {
        assert.equal(element, fontStyle);
      },
    };
    const sheet = {
      href: "https://console.example.test/omc/assets/index-NEW.css",
      cssRules: [
        {
          type: 5,
          cssText:
            '@font-face { font-family: "Host Face"; src:url("./new-font.woff2"); font-weight: 600; }',
        },
      ],
    };
    const doc = {
      head: {},
      styleSheets: [sheet],
      fonts: {
        forEach: (callback) => faces.forEach(callback),
        addEventListener() {},
      },
      defaultView: { getComputedStyle: read },
    };
    const hostRoot = { dataset: { themeMode: "dark" }, ownerDocument: doc };
    const shellRoot = {
      dataset: { theme: "light" },
      ownerDocument: {
        head: {},
        fonts: { addEventListener() {} },
        defaultView: {
          getComputedStyle: () => ({ getPropertyValue: () => "" }),
        },
      },
    };
    const outer = { document: { documentElement: hostRoot } };
    outer.parent = outer;
    const shell = {
      document: { documentElement: shellRoot },
      parent: host ? outer : null,
    };
    if (!host) shell.parent = shell;
    const win = { parent: shell };
    if (crossOrigin)
      Object.defineProperty(win, "parent", {
        get() {
          throw new Error("cross origin");
        },
      });
    let sync;
    const observed = [];
    vm.runInNewContext(source, {
      window: win,
      document: {
        documentElement: root,
        head,
        createElement: () => fontStyle,
        fonts: {
          add(face) {
            if (face.cssConnected) throw new Error("CSS-connected");
            mirrored.add(face);
          },
          delete: (face) => mirrored.delete(face),
        },
      },
      location: { href: "https://console.example.test/plugin/ui" },
      URL,
      Set,
      queueMicrotask: (fn) => fn(),
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      MutationObserver: class {
        constructor(fn) {
          sync = fn;
        }
        observe(el) {
          observed.push(el);
        }
      },
    });
    return {
      root,
      values,
      palette,
      fontStyle,
      mirrored,
      faces,
      faceJS,
      hostRoot,
      observed,
      sync,
    };
  }
  const state = setup();
  assert.equal(state.root.dataset.themeMode, "dark");
  assert.equal(state.values.get("--primary"), "#723abc");
  assert.equal(state.values.get("--font-ui"), "Operator UI");
  assert.match(
    state.fontStyle.textContent,
    /https:\/\/console.example.test\/omc\/assets\/new-font.woff2/,
  );
  assert(
    state.mirrored.has(state.faceJS),
    "runtime library face is mirrored even when CSS-connected faces cannot be shared",
  );
  state.hostRoot.dataset.themeMode = "light";
  state.palette.set("--font-ui", "New UI");
  state.palette.set("--primary", "#008877");
  state.palette.delete("--hairline");
  state.faces.delete(state.faceJS);
  state.sync();
  assert.equal(state.root.dataset.themeMode, "light");
  assert.equal(state.values.get("--font-ui"), "New UI");
  assert.equal(state.values.get("--primary"), "#008877");
  assert(!state.values.has("--hairline"));
  assert(!state.mirrored.has(state.faceJS));
  const shell = setup({ host: false });
  assert.equal(shell.root.dataset.themeMode, "light");
  assert.equal(shell.values.size, 0);
  const cross = setup({ crossOrigin: true });
  assert.equal(cross.root.dataset.themeMode, "light");
  assert.equal(cross.values.size, 0);
  assert(
    !source.includes("/omc/assets/sarasa-"),
    "console bundle hashes are never hardcoded",
  );
}
module.exports = { verifyAppearance };
if (require.main === module) {
  verifyAppearance(fs.readFileSync("internal/plugin/web/theme.js", "utf8"));
  console.log(
    "Appearance checks passed: live palette and font roles, CSS-connected and runtime fonts, rebased URLs, removal and isolated fallback.",
  );
}
