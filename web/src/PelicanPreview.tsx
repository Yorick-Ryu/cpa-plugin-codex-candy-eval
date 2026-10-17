import React, { useEffect, useState } from "react";
import { Button, Spin, Tooltip } from "antd";
import { Eye } from "lucide-react";
import { api, BASE } from "./api";
const cache = new Map<string, string>();
// Freeze list previews after one frame of motion; the detail modal plays normally.
const freeze = `<script>addEventListener('load',()=>requestAnimationFrame(()=>setTimeout(()=>{const hold=()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=1000});hold();addEventListener('animationstart',hold);document.querySelectorAll('svg').forEach(s=>s.pauseAnimations());for(let id=setTimeout(()=>{});id>0;id--){clearTimeout(id);clearInterval(id)}window.requestAnimationFrame=window.setTimeout=window.setInterval=()=>0},1000)));<\/script>`;
export function PelicanPreview({
  authId,
  recordId,
  onOpen,
}: {
  authId: string;
  recordId: string;
  onOpen: () => void;
}) {
  const key = JSON.stringify([authId, recordId]);
  const [html, setHtml] = useState(cache.get(key));
  const [error, setError] = useState("");
  useEffect(() => {
    if (cache.has(key)) {
      setHtml(cache.get(key));
      return;
    }
    const controller = new AbortController();
    void api(
      BASE +
        "/pelican/record?" +
        new URLSearchParams({ auth_id: authId, id: recordId }),
      { signal: controller.signal },
    )
      .then((r) => {
        if (!controller.signal.aborted) {
          cache.set(key, r.html || "");
          setHtml(r.html || "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [key, authId, recordId]);
  return (
    <Tooltip title={error || "放大查看动画"}>
      <div className="pelican-thumbnail">
        {html ? (
          <iframe
            title="鹈鹕动画预览"
            sandbox="allow-scripts"
            srcDoc={html + freeze}
            tabIndex={-1}
            loading="lazy"
          />
        ) : error ? (
          <span className="secondary">加载失败</span>
        ) : (
          <Spin size="small" />
        )}
        <Button
          type="text"
          aria-label="放大查看鹈鹕动画"
          className="pelican-thumbnail-open"
          icon={<Eye size={14} />}
          onClick={onOpen}
        />
      </div>
    </Tooltip>
  );
}
