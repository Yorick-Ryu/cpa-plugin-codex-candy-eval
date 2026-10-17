# Oh My CPA component snapshot

Source: https://github.com/WizisCool/oh-my-cpa

Snapshot commit: `8125b17047af0b3152e2566e393fef14cfe7caae`.

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
