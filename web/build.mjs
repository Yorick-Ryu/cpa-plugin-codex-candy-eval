import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const old = path.join(root, "internal/plugin/web");
const legacy = {
  name: "legacy-identity-and-catalog",
  setup(b) {
    b.onResolve({ filter: /^legacy$/ }, () => ({
      path: "legacy",
      namespace: "legacy",
    }));
    b.onLoad({ filter: /.*/, namespace: "legacy" }, () => ({
      loader: "js",
      resolveDir: dir,
      contents: `
    import {api, AuthError, HOST_SESSION} from '${path.join(dir, "src/api.ts")}';
    const BASE='/v0/management/plugins/omcpa-codex-candy-eval';
    const HIDDEN_MODEL = id => id.toLowerCase().includes('image');
    let key='', credentials=[];
    const stored = name => {try{return JSON.parse(localStorage.getItem(name))}catch{return null}};
    const store = (name,value) => {try{localStorage.setItem(name,JSON.stringify(value))}catch{}};
    ${["providers.js", "components.js", "catalog.js"].map((x) => readFileSync(path.join(old, x), "utf8")).join("\n")}
    const configure=(next,auths)=>{key=next===HOST_SESSION?null:next;if(auths){credentials=auths;pruneCredentialCatalog()}};
    export {configure,openCatalogCache,refreshCatalog,resetCatalogCache,pruneCredentialCatalog,modelCatalog,catalogCache,credentialPlan,planRank,unavailableReason};
  `,
    }));
  },
};
const omcStyles = {
  name: "omc-v041-css",
  setup(b) {
    b.onLoad({ filter: /omc-next\/index\.css$/ }, async (args) => {
      const result = await compile(readFileSync(args.path, "utf8"), {
        base: path.dirname(args.path),
        onDependency() {},
      });
      const scanner = new Scanner({
        sources: [
          { base: path.join(root, "web/src"), pattern: "**/*", negated: false },
        ],
      });
      return {
        contents: result.build(scanner.scan()),
        loader: "css",
        resolveDir: path.dirname(args.path),
      };
    });
  },
};
await build({
  entryPoints: [path.join(dir, "src/main.tsx")],
  bundle: true,
  outfile: path.join(old, "react/app.js"),
  minify: true,
  target: ["es2022"],
  format: "iife",
  jsx: "automatic",
  plugins: [legacy, omcStyles],
  alias: { "@": path.join(root, "web/src/omc-next") },
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "eof",
});
const js = readFileSync(path.join(old, "react/app.js"), "utf8");
writeFileSync(
  path.join(old, "react/app.js"),
  js.replaceAll("</script", "<\\/script"),
);
console.log("Built embedded React 19 / Base UI interface");
