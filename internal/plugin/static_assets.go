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
		var bundle bytes.Buffer
		for _, match := range matches {
			bundle.Write(match[1])
			bundle.WriteByte('\n')
			if kind.ext == "js" {
				bundle.WriteString(";\n")
			}
		}
		body := bundle.Bytes()
		if kind.ext == "css" {
			// Embedded webfonts dominated the old HTML. Separate them so the
			// browser downloads only font faces actually used by the page.
			fonts := regexp.MustCompile(`data:font/woff2;base64,[A-Za-z0-9+/=]+`)
			body = fonts.ReplaceAllFunc(body, func(uri []byte) []byte {
				font, err := base64.StdEncoding.DecodeString(string(bytes.TrimPrefix(uri, []byte("data:font/woff2;base64,"))))
				if err != nil {
					return uri
				}
				return []byte(result.addAsset(font, "woff2", "font/woff2"))
			})
		}
		resource := result.addAsset(body, kind.ext, kind.mime)
		replacement := []byte(`<link rel="stylesheet" href="` + resource + `">`)
		if kind.ext == "js" {
			replacement = []byte(`<script defer src="` + resource + `"></script>`)
		}
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
