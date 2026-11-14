package plugin

import (
	_ "embed"
	"encoding/json"
	"html"
	"strings"
)

//go:embed web/ui.html
var uiTemplate string

//go:embed web/react/app.css
var uiStyles string

//go:embed web/theme.js
var themeScript string

//go:embed web/vendor/markdown-it.min.js
var markdownScript string

//go:embed web/vendor/markdown-it-cjk-friendly.min.js
var cjkFriendlyScript string

//go:embed web/vendor/texmath.js
var texmathScript string

//go:embed web/vendor/temml.min.js
var temmlScript string

//go:embed web/vendor/temml.css
var temmlStyles string

//go:embed web/react/app.js
var appScript string

//go:embed web/omc-license.txt
var omcLicense string

var uiHTML = func() []byte {
	config, _ := json.Marshal(map[string]any{
		"detection":        map[string]any{"requests": fingerprintTarget, "aliases": fingerprintAliases},
		"pelican_variants": pelicanVariants,
	})
	return []byte(strings.NewReplacer(
		"/*APP_STYLES*/", temmlStyles+"\n"+uiStyles,
		"<!--PLUGIN_VERSION-->", pluginVersion,
		"<!--CANDY_PROMPT-->", html.EscapeString(candyPrompt),
		"<!--PELICAN_PROMPT-->", html.EscapeString(pelicanVariants[0].Prompt),
		"<!--DETECTOR_LICENSE-->", "<!-- LM Fingerpoint Detector\n"+detectorLicense+"-->",
		"<!--OMC_LICENSE-->", "<!-- Oh My CPA components\n"+omcLicense+"-->",
		"/*REACT_CONFIG*/{}", string(config),
		"/*MARKDOWN_SCRIPT*/", markdownScript,
		"/*CJK_FRIENDLY_SCRIPT*/", cjkFriendlyScript,
		"/*TEXMATH_SCRIPT*/", texmathScript,
		"/*TEMML_SCRIPT*/", temmlScript,
		"/*APP_SCRIPT*/", appScript,
		"/*THEME_SCRIPT*/", themeScript,
	).Replace(uiTemplate))
}()

var browserPage = splitStaticPage(uiHTML)

// Lucide "candy" icon. Hosts render it in an img element, so the stroke color is fixed.
const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#72787c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { :root { stroke: #9c9d9b; } }</style><path d="M10 7v10.9"/><path d="M14 6.1V17"/><path d="M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4"/><path d="M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07"/><path d="M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4"/></svg>`
