# OMCPA v0.4.1 UI snapshot

Source: WizisCool/oh-my-cpa, commit `741ce155da4b6bd0f718f51cfb36b12c4a876690`.
MIT attribution is retained in the repository license directory. Sarasa font
faces retain their SIL OFL license here.

React 19, Base UI primitives, Tailwind tokens, Panel, tool controls, modal,
filter tiles and the time-range picker are vendored from this exact revision.
`presentation.tsx` composes the primitives for plugin tables, selection,
expansion, local forms, metadata, progress and side panels. The plugin keeps its
existing API and task state. No console API client, preference store or auth
provider is imported.

Local adapters: the plugin dictionary, Lucide/offline brand artwork and fixed
Beijing accounting timezone. The time-range picker needs only the dictionary key
type, so its catalog type is local. Provider marks use bundled artwork.

The appearance bridge mirrors public design variables and CSS font-face rules
from accessible ancestors. Font URLs are resolved against their source sheet;
there are no baked console asset hashes. Runtime library fonts are mirrored as
FontFaces. Standalone pages bundle regular, semibold and bold Sarasa core faces.

Plugin adaptation: the console's fixed-height shell and permanent body scroll
lock are removed. Documents scroll naturally; Base UI retains its own temporary
modal locks. `node scripts/test-scroll.cjs` uses native Chromium wheel and touch
input to cover standalone/nested-frame scrolling and recovery after Escape.
