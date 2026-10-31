package plugin

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"sort"
)

// Only build-owned, credential-free scripts and styles are extracted. Runtime
// account data never enters this map. Keep the HTML and all APIs uncached.
type staticPage struct {
	document []byte
	assets   map[string]managementResponse
}

func splitStaticPage(source []byte) staticPage {
	result := staticPage{document: bytes.Clone(source), assets: make(map[string]managementResponse)}
	for _, kind := range []struct{ tag, ext, mime string }{
		{"style", "css", "text/css; charset=utf-8"},
		{"script", "js", "application/javascript; charset=utf-8"},
	} {
		// Our build-owned templates use plain script/style tags. This deliberately
		// leaves other tags (e.g. JSON configuration or external scripts) untouched.
		pattern := regexp.MustCompile("(?s)<" + kind.tag + ">(.*?)</" + kind.tag + ">")
		matches := pattern.FindAllSubmatch(result.document, -1)
		if len(matches) == 0 {
			continue
		}
		if kind.ext == "js" {
			// Preserve each original script boundary. Combining vendor code
			// with pathname-aware app code makes OMC parse vendor syntax that
			// its adapter deliberately leaves untouched in separate scripts.
			result.document = pattern.ReplaceAllFunc(result.document, func(tag []byte) []byte {
				body := pattern.FindSubmatch(tag)[1]
				resource := result.addAsset(bytes.Clone(body), kind.ext, kind.mime)
				return []byte(`<script defer src="` + resource + `"></script>`)
			})
			continue
		}
		var bundle bytes.Buffer
		for _, match := range matches {
			bundle.Write(match[1])
			bundle.WriteByte('\n')
		}
		body := bundle.Bytes()
		if kind.ext == "css" {
			// Embedded webfonts dominated the old HTML. Separate them so the
			// browser downloads only font faces actually used by the page.
			fonts := regexp.MustCompile(`url\(["']?data:font/woff2;base64,([A-Za-z0-9+/=]+)["']?\)`)
			body = fonts.ReplaceAllFunc(body, func(uri []byte) []byte {
				font, err := base64.StdEncoding.DecodeString(string(fonts.FindSubmatch(uri)[1]))
				if err != nil {
					return uri
				}
				fallback := result.addAsset(font, "woff2", "font/woff2")
				if shared := omcFontResource(font); shared != "" {
					return []byte(`url("` + shared + `") format("woff2"),url("` + fallback + `")`)
				}
				return []byte(`url("` + fallback + `")`)
			})
		}
		resource := result.addAsset(body, kind.ext, kind.mime)
		replacement := []byte(`<link rel="stylesheet" href="` + resource + `">`)
		first := true
		result.document = pattern.ReplaceAllFunc(result.document, func(_ []byte) []byte {
			if first {
				first = false
				return replacement
			}
			return nil
		})
	}
	return result
}

func (page staticPage) addAsset(body []byte, extension, contentType string) string {
	resource := "/v0/resource/plugins/" + pluginID + fmt.Sprintf("/assets/%x.%s", sha256.Sum256(body), extension)
	page.assets[resource] = managementResponse{
		StatusCode: http.StatusOK,
		Headers: http.Header{
			"Content-Type": {contentType},
			// OMC remains session authenticated; shared proxies must not cache these.
			"Cache-Control":          {"private, max-age=31536000, immutable"},
			"X-Content-Type-Options": {"nosniff"},
		},
		Body: body,
	}
	return resource
}

func (page staticPage) resources(menu, description string) []map[string]string {
	resources := []map[string]string{{"Path": uiPath, "Menu": menu, "Description": description}}
	paths := make([]string, 0, len(page.assets))
	for path := range page.assets {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	for _, path := range paths {
		resources = append(resources, map[string]string{"Path": path})
	}
	return resources
}

// These are the existing OMC Vite assets for the exact vendored Sarasa faces.
// Match bytes, not family labels: a future changed font must not silently use
// another version. The plugin URL remains a fallback for standalone hosts.
func omcFontResource(font []byte) string {
	switch fmt.Sprintf("%x", sha256.Sum256(font)) {
	case "d8a2c59dc53fde63afa6beddb6908498d09c57d09a3e90e88b314003cff749b7":
		return "/omc/assets/sarasa-mono-sc-400-000-CKzN0e0Y.woff2"
	case "8a3f31f795e116f47f1d767986c3f699bdc808102ffd2133168bdb834525dc22":
		return "/omc/assets/sarasa-mono-sc-700-000-BeaBM8Sg.woff2"
	}
	return ""
}
