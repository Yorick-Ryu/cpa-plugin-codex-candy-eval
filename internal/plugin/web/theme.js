"use strict";
// Copy public appearance tokens through OMC's same-origin theme shell.
// No host storage or credentials are read here.
(() => {
  const root = document.documentElement;
  const tokens = ["bg", "surface", "elevated", "fg", "fg-2", "muted", "meta", "border", "border-soft", "hover", "accent", "accent-hover", "accent-active", "accent-on", "success", "warn", "danger", "font-ui", "font-mono"];
  const ancestors = [];
  let frame = window;
  try {
    while (frame.parent !== frame && ancestors.length < 8) {
      frame = frame.parent;
      ancestors.push(frame.document.documentElement);
    }
  } catch (_) { /* Cross-origin hosts cannot supply appearance tokens. */ }
  const media = matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    let mode = media.matches ? "dark" : "light";
    const shell = ancestors.find((el) => ["dark", "light", "white"].includes(el.dataset.theme));
    if (shell) mode = shell.dataset.theme === "dark" ? "dark" : "light";
    const host = ancestors.find((el) => {
      const css = el.ownerDocument.defaultView.getComputedStyle(el);
      return css.getPropertyValue("--fg").trim() && css.getPropertyValue("--font-ui").trim();
    });
    root.dataset.theme = host?.dataset.themeMode || mode;
    root.toggleAttribute("data-omc-host", !!host);
    const css = host?.ownerDocument.defaultView.getComputedStyle(host);
    for (const token of tokens) {
      const value = css?.getPropertyValue("--" + token).trim();
      if (value) root.style.setProperty("--" + token, value);
      else root.style.removeProperty("--" + token);
    }
    if (host) host.ownerDocument.fonts?.forEach((face) => { try { document.fonts.add(face); } catch (_) {} });
  };
  const observer = new MutationObserver(sync);
  for (const ancestor of ancestors) observer.observe(ancestor, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode", "style", "class"] });
  media.addEventListener("change", sync);
  sync();
})();
