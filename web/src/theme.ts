import { useEffect, useState } from "react";
import { createThemeConfig } from "./omc/theme/themeConfig";
import { resolvedBuiltInPalette } from "./omc/theme/palette";
function readTheme() {
  const root = document.documentElement;
  const mode = root.dataset.theme === "dark" ? "dark" : "light";
  const base = resolvedBuiltInPalette(
    mode === "dark" ? "omc-dark" : "omc-light",
  );
  const resolved = { ...base, palette: { ...base.palette } };
  const css = getComputedStyle(root);
  const aliases: Record<string, string> = {
    fg2: "fg-2",
    borderSoft: "border-soft",
    rowHover: "hover",
    selected: "selected-inset",
    hoverInset: "hover-inset",
    accentHover: "accent-hover",
    accentActive: "accent-active",
    accentOn: "accent-on",
    tooltipBg: "tooltip-bg",
  };
  for (const key of Object.keys(resolved.palette)) {
    const value = css.getPropertyValue("--" + (aliases[key] || key)).trim();
    if (value && typeof (resolved.palette as any)[key] === "string")
      (resolved.palette as any)[key] = value;
  }
  return createThemeConfig(resolved);
}
export function useOmcTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
