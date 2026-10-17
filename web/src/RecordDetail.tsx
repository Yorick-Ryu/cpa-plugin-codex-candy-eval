import React, { useMemo, useState } from "react";
import {
  Alert,
  Collapse,
  Descriptions,
  Progress,
  Select,
  Statistic,
  Table,
  Tag,
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
  const [baseline, setBaseline] = useState("");
  const a = r.attribution || {};
  const comparison =
    a.comparisons?.find((c: any) => c.model === (baseline || a.nearest)) ||
    a.comparisons?.[0];
  const state = verdict(r, test);
  const n = (v: any) => (typeof v === "number" ? v.toFixed(4) : "—");
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
      {test === "fingerprint" && (
        <>
          <div className="detail-stats">
            <Statistic
              title="采集进度"
              value={`${r.done ?? 0} / ${r.total ?? 0}`}
            />
            <Statistic title="有效回答" value={r.valid ?? 0} />
            <Statistic title="请求失败" value={r.errors ?? 0} />
            <Statistic
              title="耗时"
              value={((r.duration_ms ?? 0) / 1000).toFixed(1)}
              suffix="s"
            />
          </div>
          {a.message && <p className="secondary">{a.message}</p>}
          {r.status !== "completed" && (
            <p className="secondary">结果基于已采集的部分样本，仅供参考。</p>
          )}
          <h3>基准比对</h3>
          <Table
            size="small"
            pagination={false}
            rowKey="model"
            scroll={{ x: 600 }}
            dataSource={a.comparisons || []}
            columns={[
              {
                title: "基准模型",
                dataIndex: "model",
                render: (v: string) => (
                  <span>
                    {v}
                    {v === r.model && <Tag>所选</Tag>}
                    {v === a.nearest && <Tag>最近</Tag>}
                  </span>
                ),
              },
              { title: "距离 JSD ↓", dataIndex: "mean_jsd", render: n },
              { title: "p 值", dataIndex: "p_value", render: n },
              {
                title: "有效探针",
                dataIndex: "cells",
                render: (v: any[]) => v?.length ?? 0,
              },
              {
                title: "判断",
                dataIndex: "verdict",
                render: (v: string) =>
                  ({
                    match: "相似",
                    uncertain: "不确定",
                    mismatch: "不同",
                    insufficient: "样本不足",
                  })[v] || v,
              },
            ]}
          />
          <p className="secondary">
            距离越小，回答分布越接近。p 值低于 {n(a.alpha)}{" "}
            时视为差异显著；归因同时考虑距离与统计检验。
          </p>
          <h3>结果稳定性</h3>
          <Descriptions
            size="small"
            items={[
              { key: "self", label: "自一致性 JSD", children: n(a.self_jsd) },
              {
                key: "ref",
                label: "基准差异 p 值",
                children: n(a.reference_p_value),
              },
            ]}
          />
          {(a.warnings || []).map((w: string) => (
            <Alert key={w} type="warning" title={w} showIcon />
          ))}
          <h3>逐项比对</h3>
          <Select
            aria-label="对比基准模型"
            className="baseline-select"
            value={comparison?.model}
            options={(a.comparisons || []).map((c: any) => ({
              value: c.model,
              label: c.model,
            }))}
            onChange={setBaseline}
          />
          <Table
            size="small"
            pagination={false}
            rowKey="cell"
            scroll={{ x: 480 }}
            dataSource={comparison?.cells || []}
            columns={[
              { title: "探针", dataIndex: "cell" },
              { title: "距离 JSD", dataIndex: "jsd", render: n },
              { title: "本次有效回答", dataIndex: "valid_a" },
              { title: "基准有效回答", dataIndex: "valid_b" },
            ]}
          />
        </>
      )}
      {test === "modeltrace" && (
        <>
          {r.attribution && (
            <>
              <Descriptions
                size="small"
                bordered
                items={[
                  { key: "p", label: "最接近的模型", children: a.prediction },
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
                    key: "fprob",
                    label: "家族概率",
                    children: percent(a.family_probability),
                  },
                  {
                    key: "used",
                    label: "有效回答",
                    children: `${a.used_outputs ?? 0} / ${window.CANDY_CONFIG.modeltrace.requests}`,
                  },
                ]}
              />
              <div className="family-tags">
                {(a.family_probabilities || []).map((f: any) => (
                  <Tag key={f.display_name}>
                    {f.display_name} {percent(f.probability)}
                  </Tag>
                ))}
              </div>
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
                    render: (v: number) => (
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
          <h3>挑战记录</h3>
          <Collapse
            items={(r.samples || []).map((s: any, i: number) => ({
              key: i,
              label: `挑战 ${i + 1} · ${s.parsed_numbers} / ${s.expected_count} 个数字 · ${s.accepted ? "有效" : "未计入"}`,
              children: (
                <>
                  <p className="secondary">请求次数 {s.attempts || 1}</p>
                  <pre>{s.prompt}</pre>
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
