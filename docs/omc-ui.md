# OMC component UI

The evaluation runners and history format follow upstream v0.4.0. The OMC
edition registers as `omcpa-codex-candy-eval`, with its own management/resource
routes, `plugins/omcpa-codex-candy-eval-state.json`, and browser storage namespace.
It can be loaded alongside the upstream `cpa-codex-candy-eval` plugin. Existing
installations using the old ID keep their state file; migrating history is an
explicit copy while both plugins are idle, never an automatic shared-file fallback. The new fingerprint detection replaces the old fingerprint and
ModelTrace tests; back up state before upgrading because upstream drops those
retired histories. Candy and pelican histories remain compatible. `web/src/main.tsx` owns the React
interface; the build reuses the original credential identities and model-catalog
logic through `web/build.mjs`.

The entire interface uses React 19, Base UI and Tailwind with the deployed
OMCPA v0.4.1 source (`741ce155da4b6bd0f718f51cfb36b12c4a876690`).
Controls, modal, filter tiles, checkbox, tabs and fields are vendored under
`web/src/omc-next/`; the MIT license and source manifest are retained.
`presentation.tsx` composes tables with cross-page selection and expansion,
forms, progress, metadata and side panels. Ant Design and its theme provider
are removed. The request and history contracts are unchanged.

The appearance bridge copies public CSS tokens and font-face declarations from
same-origin ancestors, resolving font URLs against the host stylesheet rather
than baking its build hashes into the plugin. Runtime font-library faces follow
the host too. Independent pages use system light/dark mode and bundled Sarasa
regular, semibold and bold core faces. Updating theme or fonts preserves active
tests and open details. No console API or host storage is read by this bridge.

## Build and verify

```sh
npm ci --prefix web
npm --prefix web run check
npm --prefix web run build
node scripts/test-react.mjs
node scripts/test-components.cjs
node scripts/test-theme.cjs
go vet ./...
go test -race ./...
```

The component suite loads the shipped bundle in a DOM environment and talks to
an isolated synthetic CPA server. It covers the three tests, polling, selection,
details, cancellation, sandboxed animation and history confirmation. Go tests
check the runners and persistence. Prompt and version embedding checks remain;
static checks for old DOM tab IDs were replaced by component interaction checks.

For visual review, run `node scripts/preview.cjs` and open
`http://127.0.0.1:4178`. All displayed credentials and requests are synthetic.
The fixture never forwards requests to production. Rebuild after source changes;
reload the preview to load the current embedded assets.

Replacing the installed shared library requires a separate deployment. The
repository deployment script restarts CPA; follow the host's current restart
authorization and backup requirements before using it.
