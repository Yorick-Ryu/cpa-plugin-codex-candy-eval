package plugin

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestStaticPageResourcesAndCacheBoundary(t *testing.T) {
	if len(browserPage.document) > 20000 {
		t.Fatalf("HTML still contains the bundle: %d bytes", len(browserPage.document))
	}
	if len(browserPage.assets) < 4 {
		t.Fatalf("want CSS, JS and font assets, got %d", len(browserPage.assets))
	}
	var envelope struct {
		OK     bool
		Result json.RawMessage
	}
	json.Unmarshal(HandleMethod("management.register", nil), &envelope)
	var registration struct{ Resources []struct{ Path, Menu string } }
	json.Unmarshal(envelope.Result, &registration)
	if len(registration.Resources) != 1+len(browserPage.assets) {
		t.Fatalf("unexpected resources: %d", len(registration.Resources))
	}
	menus := 0
	for _, r := range registration.Resources {
		if r.Menu != "" {
			menus++
		}
	}
	if menus != 1 {
		t.Fatal("assets must not add plugin menus")
	}
	for path, asset := range browserPage.assets {
		referenced := bytes.Contains(browserPage.document, []byte(path))
		for _, candidate := range browserPage.assets {
			referenced = referenced || bytes.Contains(candidate.Body, []byte(path))
		}
		if !referenced {
			t.Fatal("unreferenced asset")
		}
		ext := ".js"
		if asset.Headers.Get("Content-Type") == "font/woff2" {
			ext = ".woff2"
		}
		if strings.HasPrefix(asset.Headers.Get("Content-Type"), "text/css") {
			ext = ".css"
		}
		if !strings.HasSuffix(path, fmt.Sprintf("%x%s", sha256.Sum256(asset.Body), ext)) {
			t.Fatal("asset URL does not identify content")
		}
		if ext == ".css" && bytes.Contains(asset.Body, []byte("data:font/woff2")) {
			t.Fatal("font still inline in CSS")
		}
		request, _ := json.Marshal(managementRequest{Method: http.MethodGet, Path: path})
		json.Unmarshal(HandleMethod("management.handle", request), &envelope)
		var response managementResponse
		json.Unmarshal(envelope.Result, &response)
		if response.StatusCode != 200 || !bytes.Equal(response.Body, asset.Body) {
			t.Fatal("registered asset cannot be fetched")
		}
		if response.Headers.Get("Cache-Control") != "private, max-age=31536000, immutable" {
			t.Fatal("asset cache must be private and immutable")
		}
		request, _ = json.Marshal(managementRequest{Method: http.MethodGet, Path: path + ".unknown"})
		json.Unmarshal(HandleMethod("management.handle", request), &envelope)
		json.Unmarshal(envelope.Result, &response)
		if response.StatusCode == 200 {
			t.Fatal("unknown asset accepted")
		}
	}
	request, _ := json.Marshal(managementRequest{Method: http.MethodGet, Path: uiPath})
	json.Unmarshal(HandleMethod("management.handle", request), &envelope)
	var response managementResponse
	json.Unmarshal(envelope.Result, &response)
	if response.Headers.Get("Cache-Control") != "no-store" {
		t.Fatal("HTML must always refresh to discover new assets")
	}
	if !strings.Contains(response.Headers.Get("Content-Security-Policy"), "script-src 'self'") {
		t.Fatal("CSP blocks external scripts")
	}
	t.Logf("HTML: %d bytes; cached assets: %d", len(browserPage.document), len(browserPage.assets))
}

func TestStaticBundlePreservesScriptOrderAndChangesURL(t *testing.T) {
	source := []byte(`<html><head><style>body{color:red}</style></head><body><script>window.first=1;// comment</script><script>window.second=window.first+1</script></body></html>`)
	page := splitStaticPage(source)
	for path, asset := range page.assets {
		if strings.HasSuffix(path, ".js") && string(asset.Body) != "window.first=1;// comment\n;\nwindow.second=window.first+1\n;\n" {
			t.Fatal("script order or separator lost")
		}
	}
	changed := splitStaticPage(bytes.ReplaceAll(source, []byte("first=1"), []byte("first=2")))
	for path := range page.assets {
		if strings.HasSuffix(path, ".js") {
			if _, ok := changed.assets[path]; ok {
				t.Fatal("changed JS reused immutable URL")
			}
		}
	}
	if bytes.Contains(page.document, []byte("window.first")) {
		t.Fatal("inline script remains")
	}
}
