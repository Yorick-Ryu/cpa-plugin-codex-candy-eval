# OMC component UI

The evaluation runners, plugin ID, management routes, state schema and stored
history remain the upstream CPA contracts. `web/src/main.tsx` owns the React
interface; the build reuses the original credential identities and model-catalog
logic through `web/build.mjs`.

OMC source is vendored under `web/src/omc/` with its MIT license and snapshot
commit. The UI directly imports its theme projection, counted filter tiles and
status labels. Other controls use Ant Design 6.6.2, React 18.3.1 and Lucide,
matching the reference console. The bundle is embedded in the shared library;
there is no CDN dependency or dependency on OMC's hashed JavaScript files.

`internal/plugin/web/theme.js` observes accessible host ancestors, including
OMC's intermediate theme shell. It copies appearance tokens and loaded font
faces, without reading host storage. React updates its ConfigProvider in place,
so switching mode, palette or font preserves the active test and open history.
Independent pages follow the system colour scheme. Authentication retains the
upstream management-key contract; OMC still validates the page's credentials.

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
an isolated synthetic CPA server. It covers the four tests, polling, selection,
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
