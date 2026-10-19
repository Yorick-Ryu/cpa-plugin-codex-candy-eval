import React, { useMemo } from "react";
import {
  Alert,
  Collapse,
  Descriptions,
  Progress,
  Table,
} from "antd";
import { StatusLabel } from "./omc/common/StatusLabel";
import { fmtTime, percent, verdict, type RecordData, type Test } from "./model";
const md = window
  .markdownit({ breaks: true })
  .disable(["link", "image", "autolink"])
  .use(window.markdownItCjkFriendly)
  .use(window.texmath, {
    engine: window.temml,
    delimiters: ["dollars", "brackets"],
  });
export function Answer({ record }: { record: RecordData }) {
  const html = useMemo(
    () => (record.error ? "" : md.render(record.answer || "")),
    [record.answer, record.error],
  );
  return record.error ? (
    <Alert type="error" title={record.error} showIcon />
  ) : (
    <div
      className="answer-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
export function RecordMeta({ record: r }: { record: RecordData }) {
  return (
    <div className="record-meta">
      <span>{fmtTime(r.time)}</span>
      <span>
        {r.model}
        {r.effort ? ` · ${r.effort}` : ""}
      </span>
      <span>
        {r.duration_ms == null ? "—" : (r.duration_ms / 1000).toFixed(1) + "s"}
      </span>
      <span>
        输入 {r.input_tokens?.toLocaleString() ?? "—"} · 输出{" "}
        {r.output_tokens?.toLocaleString() ?? "—"} · 推理{" "}
        {r.reasoning_tokens?.toLocaleString() ?? "—"}
      </span>
    </div>
  );
}
export function RecordDetail({
  record: r,
  test,
}: {
  record: RecordData;
  test: Test;
}) {
  const a = r.attribution || {};
  const state = verdict(r, test);
  return (
    <div className="record-detail">
      <RecordMeta record={r} />
      <StatusLabel tone={state.tone}>{state.label}</StatusLabel>
      {r.error && <Alert type="error" showIcon title={r.error} />}
      {test === "candy" && <Answer record={r} />}
      {test === "pelican" && r.html && (
        <iframe
          title="鹈鹕动画"
          className="pelican-frame"
          sandbox="allow-scripts"
          srcDoc={r.html}
        />
      )}
      {test === "detection" && (
        <>
          {r.attribution && a.decision !== "not_model" && (
            <>
              <p className="secondary">{state.tone === "success" ? "与测试模型一致" : "与测试模型不一致"}</p>
              <Descriptions
                size="small"
                bordered
                items={[
                  { key: "p", label: "最接近的模型", children: a.prediction_name || a.prediction },
                  {
                    key: "prob",
                    label: "归因概率",
                    children: percent(a.probability),
                  },
                  {
                    key: "fam",
                    label: "模型家族",
                    children: a.family_prediction_name,
                  },
                  {
                    key: "used",
                    label: "有效回答",
                    children: `${a.used_outputs ?? 0} / ${window.CANDY_CONFIG.detection.requests}`,
                  },
                ]}
              />
              {a.probability == null && <p className="secondary">有效回答不足三条，仅给出排名，不计算归因概率。</p>}
              <h3>候选模型排行</h3>
              <Table
                size="small"
                pagination={false}
                rowKey="model"
                dataSource={a.results || []}
                columns={[
                  {
                    title: "模型",
                    render: (_: unknown, v: any) => v.display_name || v.model,
                  },
                  {
                    title: "归因概率",
                    dataIndex: "probability",
                    render: (v: number | null) => v == null ? "—" : (
                      <Progress
                        percent={Math.max(0, Math.min(100, v * 100))}
                        format={() => percent(v)}
                      />
                    ),
                  },
                ]}
              />
            </>
          )}
          {a.decision === "not_model" && <Alert type="warning" showIcon title="相邻数字的变化方式与参考库中的语言模型不同，因此未生成排名。" />}
          {r.status === "partial" && <p className="secondary">部分结果</p>}
          <h3>挑战记录</h3>
          <Collapse
            items={(r.samples || []).map((s: any, i: number) => ({
              key: i,
              label: `挑战 ${i + 1} · ${s.parsed_numbers} / ${s.expected_count} 个数字 · ${s.accepted ? "有效" : "未计入"}`,
              children: (
                <>
                  <p className="secondary">请求次数 {s.attempts || 1}</p>
                  {s.instructions && <><h3>开发者指令</h3><pre>{s.instructions}</pre></>}
                  <h3>提示词</h3><pre>{s.prompt}</pre>
                  {s.error && <Alert type="error" title={s.error} />}
                  <pre>{s.text}</pre>
                </>
              ),
            }))}
          />
        </>
      )}
    </div>
  );
}
