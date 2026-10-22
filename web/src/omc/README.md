# Oh My CPA component snapshot

Source: https://github.com/WizisCool/oh-my-cpa

Snapshot commit: `8a8871323badc1f7c27d541e1075154d0806c48b` (2026-10-22).

The adjacent MIT license applies to these copied upstream sources:

- `theme/createThemeConfig` and palette/color arithmetic.
- `common/StatTiles` and its CSS module.
- `common/StatusLabel`; its global CSS lives in the application's stylesheet.

These components are bundled with React 18.3.1 and Ant Design 6.6.2, the same
versions used by OMC at the snapshot. The plugin reads the embedding console's
resolved appearance tokens through its same-origin theme shell. It does not
load scripts from OMC's private bundles or depend on their hashed asset names.

Update the snapshot by comparing these files with upstream, retaining its
license and checking both default and custom palettes.

The bundled Sarasa Mono SC core font shard follows upstream `core.css`; its SIL OFL license is in `SIL-OFL.txt`.
ProviderFilterTabs, its CSS and provider metadata are copied unchanged from the upstream snapshot. It receives native provider keys and counts. Only its platform dependencies (i18n, icon adapter and offline brand artwork) are supplied by this standalone plugin. Switch is also copied unchanged. ProviderBrandIcon embeds monochrome assets from the upstream-pinned `@lobehub/icons-static-svg` 1.95.1 (MIT) without loading the console API or remote assets. Subscription labels reuse the quota view’s neutral plan presentation.
