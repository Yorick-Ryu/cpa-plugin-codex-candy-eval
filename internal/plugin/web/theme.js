"use strict";
// The embedding document owns appearance. Read its public CSS contract, never its storage.
(() => {
  const root = document.documentElement;
  const ancestors = [];
  let frame = window;
  try {
    while (frame.parent !== frame && ancestors.length < 8) {
      frame = frame.parent;
      ancestors.push(frame.document.documentElement);
    }
  } catch (_) {}
  const media = matchMedia("(prefers-color-scheme: dark)");
  const copied = new Set();
  const fontStyle = document.createElement("style");
  fontStyle.dataset.omcFonts = "";
  document.head.append(fontStyle);
  const addedFaces = new Set();
  const cssFontRules = (sheet, seen = new Set()) => {
    if (seen.has(sheet)) return [];
    seen.add(sheet);
    let rules;
    try {
      rules = sheet.cssRules;
    } catch (_) {
      return [];
    }
    const result = [];
    for (const rule of rules) {
      if (rule.type === 3 && rule.styleSheet)
        result.push(...cssFontRules(rule.styleSheet, seen));
      if (rule.type !== 5) continue;
      const base = sheet.href || sheet.ownerNode?.baseURI || location.href;
      result.push(
        rule.cssText.replace(
          /url\((['"]?)(.*?)\1\)/g,
          (_match, _quote, url) => `url("${new URL(url, base).href}")`,
        ),
      );
    }
    return result;
  };
  const sync = () => {
    const host = ancestors.find((el) => {
      const css = el.ownerDocument.defaultView.getComputedStyle(el);
      return (
        css.getPropertyValue("--fg").trim() &&
        css.getPropertyValue("--font-ui").trim()
      );
    });
    const shell = ancestors.find((el) =>
      ["dark", "light", "white"].includes(el.dataset.theme),
    );
    const mode =
      host?.dataset.themeMode ||
      (shell
        ? shell.dataset.theme === "dark"
          ? "dark"
          : "light"
        : media.matches
          ? "dark"
          : "light");
    root.dataset.theme = mode;
    root.dataset.themeMode = mode;
    root.style.colorScheme = mode;
    root.toggleAttribute("data-omc-host", !!host);
    if (!host) return;
    const css = host.ownerDocument.defaultView.getComputedStyle(host);
    const names = new Set(
      [...css].filter(
        (name) => name.startsWith("--") && !name.startsWith("--tw-"),
      ),
    );
    for (const name of copied)
      if (!names.has(name)) {
        root.style.removeProperty(name);
        copied.delete(name);
      }
    for (const name of names) {
      const value = css.getPropertyValue(name).trim();
      if (value) {
        root.style.setProperty(name, value);
        copied.add(name);
      }
    }
    // CSS-connected FontFaces cannot be added to another document's FontFaceSet. Clone their
    // public declarations with absolute URLs; copy JS-registered library faces separately.
    const rules = [...host.ownerDocument.styleSheets].flatMap((sheet) =>
      cssFontRules(sheet),
    );
    const text = rules.join("\n");
    if (fontStyle.textContent !== text) fontStyle.textContent = text;
    const current = new Set();
    host.ownerDocument.fonts?.forEach((face) => {
      try {
        document.fonts.add(face);
        addedFaces.add(face);
        current.add(face);
      } catch (_) {}
    });
    for (const face of addedFaces)
      if (!current.has(face)) {
        document.fonts.delete(face);
        addedFaces.delete(face);
      }
  };
  let queued = false;
  const schedule = () => {
    if (!queued) {
      queued = true;
      queueMicrotask(() => {
        queued = false;
        sync();
      });
    }
  };
  const observer = new MutationObserver(schedule);
  for (const ancestor of ancestors) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-mode", "style", "class"],
    });
    observer.observe(ancestor.ownerDocument.head, {
      childList: true,
      subtree: true,
    });
    ancestor.ownerDocument.fonts?.addEventListener("loadingdone", schedule);
  }
  media.addEventListener("change", schedule);
  sync();
})();
