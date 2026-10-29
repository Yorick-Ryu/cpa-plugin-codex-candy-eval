import "./omc/fonts.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  Candy,
  Fingerprint,
  Play,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Square,
} from "lucide-react";
import { Switch } from "./omc/common/Switch";
import { ProviderFilterTabs } from "./omc/components/common/ProviderFilterTabs";
import { ProviderBrandIcon } from "./omc/common/ProviderBrandIcon";
import { StatTiles } from "./omc/common/StatTiles";
import { StatusLabel } from "./omc/common/StatusLabel";
import { useOmcTheme } from "./theme";
import {
  api,
  BASE,
  KEY_STORE,
  initialKey,
  setSessionKey,
  AuthError,
} from "./api";
import {
  configure,
  openCatalogCache,
  refreshCatalog,
  resetCatalogCache,
  modelCatalog,
  catalogCache,
  credentialPlan,
  planRank,
  unavailableReason,
} from "legacy";
import {
  available,
  compareCredentialPriority,
  busy,
  provider,
  tests,
  progress,
  verdict,
  fmtTime,
  percent,
  parseState,
  type Credential,
  type RecordData,
  type Test,
} from "./model";
import { Answer, RecordDetail, RecordMeta } from "./RecordDetail";
import { PelicanPreview } from "./PelicanPreview";
import "./style.css";
import "./omc/appearance.css";
const config = window.CANDY_CONFIG;
const pref = (name: string, fallback: any) => {
  try {
    const v = JSON.parse(
      localStorage.getItem("omcpa-codex-candy-eval.omc.v2." + name) || "null",
    );
    if (name === "settings" && v && typeof v === "object")
      return Object.fromEntries(Object.keys(tests).map(t => [t, {...fallback[t], ...v[t]}]));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
function usePreference<T>(name: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => pref(name, fallback));
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(
          "omcpa-codex-candy-eval.omc.v2." + name,
          JSON.stringify(v),
        );
      } catch {}
    },
  ];
}
const emptySelection = () => ({
  candy: [] as React.Key[],
  detection: [] as React.Key[],
  pelican: [] as React.Key[],
});
const icons = {
  candy: <Candy size={15} />,
  detection: <Fingerprint size={15} />,
  pelican: <Play size={15} />,
};
const promptText = (id: string) =>
  (document.getElementById(id) as HTMLTemplateElement)?.content.textContent ||
  "";
function EvaluationApp() {
  const { message } = AntApp.useApp();
  const [auth, setAuth] = useState(initialKey);
  const [auths, setAuths] = useState<Credential[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [pending, setPending] = useState(false);
  const [switching, setSwitching] = useState<Set<string>>(new Set());
  const [test, setTest] = usePreference<Test>("tab", "candy");
  const active: Test = tests[test] ? test : "candy";
  const [masked, setMasked] = usePreference("masked", false);
  const [type, setType] = usePreference("provider", "all");
  const [plan, setPlan] = usePreference("plan", "all");
  const [enabledOnly, setEnabledOnly] = usePreference("enabledOnly", false);
  const [search, setSearch] = useState("");
  const [tile, setTile] = useState("all");
  const [selected, setSelected] = useState(emptySelection);
  const [settings, setSettings] = usePreference<
    Record<
      Test,
      {
        model: string;
        effort: string;
        runs: number;
        mode: string;
        concurrency: number;
      }
    >
  >(
    "settings",
    Object.fromEntries(
      Object.keys(tests).map((t) => [
        t,
        {
          model: "gpt-6.1-sol",
          effort: "low",
          runs: 1,
          mode: "quick",
          concurrency: config.detection.requests,
        },
      ]),
    ) as any,
  );
  const [detail, setDetail] = useState<{
    test: Test;
    authId: string;
    record: RecordData;
  } | null>(null);
  const [detailData, setDetailData] = useState<RecordData | null>(null);
  const [detailError, setDetailError] = useState("");
  const [clearTarget, setClearTarget] = useState<Test | "all" | null>(null);
  const stateRef = useRef(auths);
  stateRef.current = auths;
  const request = useRef<AbortController>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const locked = useRef(false);
  const activeAuth = useRef(auth);
  activeAuth.current = auth;
  const currentSettings = settings[active];
  const logout = useCallback((reason: string) => {
    request.current?.abort();
    clearTimeout(timer.current);
    activeAuth.current = "";
    setSessionKey("");
    configure("", []);
    resetCatalogCache();
    setAuth("");
    setAuths([]);
    setModels([]);
    setSelected(emptySelection());
    setDetail(null);
    setLoaded(false);
    setError(reason);
    try {
      sessionStorage.removeItem(KEY_STORE);
    } catch {}
  }, []);
  const load = useCallback(
    async (force = false) => {
      if (!auth) return;
      clearTimeout(timer.current);
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      try {
        let catalogError = "";
        try {
          await refreshCatalog({ signal: controller.signal, force });
          if (controller.signal.aborted) return;
          setModels(catalogCache.models?.ids || []);
        } catch (e: any) {
          if (e instanceof AuthError) throw e;
          if (controller.signal.aborted) return;
          catalogError = "读取模型和凭证列表失败：" + e.message;
        }
        const data = await api(BASE + "/state", { signal: controller.signal });
        if (controller.signal.aborted) return;
        const next = parseState(data);
        configure(auth, next);
        stateRef.current = next;
        setAuths(next);
        setStorageError(data.storage_error || "");
        setError(catalogError);
        setLoaded(true);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        if (e instanceof AuthError) {
          logout(e.message);
          return;
        }
        setError(e.message);
      } finally {
        if (request.current === controller && !controller.signal.aborted) {
          setLoading(false);
          timer.current = setTimeout(
            () => void load(),
            stateRef.current.some(busy) ? 2500 : 20000,
          );
        }
      }
    },
    [auth, logout],
  );
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setSessionKey(auth);
    configure(auth, []);
    void openCatalogCache(auth).then(() => {
      if (!cancelled) void load(true);
    });
    return () => {
      cancelled = true;
      request.current?.abort();
      clearTimeout(timer.current);
    };
  }, [auth, load]);
  useEffect(() => {
    if (!models.length) return;
    const next = { ...settings };
    let changed = false;
    for (const name of Object.keys(tests) as Test[]) {
      const list =
        name === "detection"
          ? models.filter((m) => !/[()]/.test(m))
          : models;
      if (!list.includes(next[name].model) && list.length) {
        next[name] = {
          ...next[name],
          model: list.includes("gpt-6.1-sol") ? "gpt-6.1-sol" : list[0],
        };
        changed = true;
      }
    }
    if (changed) setSettings(next);
  }, [models]);
  useEffect(() => {
    if (!detail) return;
    const controller = new AbortController();
    setDetailData(null);
    setDetailError("");
    if (detail.test === "candy") {
      setDetailData(detail.record);
      return;
    }
    void api(
      `${BASE}${tests[detail.test].scope}/record?${new URLSearchParams({ auth_id: detail.authId, id: detail.record.id || "" })}`,
      { signal: controller.signal },
    )
      .then((record) => {
        if (!controller.signal.aborted) setDetailData(record);
      })
      .catch((e: any) => {
        if (!controller.signal.aborted) {
          if (e instanceof AuthError) logout(e.message);
          else setDetailError(e.message);
        }
      });
    return () => controller.abort();
  }, [detail, logout]);
  const setSetting = (key: string, value: any) =>
    setSettings({
      ...settings,
      [active]: { ...currentSettings, [key]: value },
    });
  const execute = async (task: () => Promise<any>, success?: string) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    clearTimeout(timer.current);
    request.current?.abort();
    setLoading(false);
    try {
      const result = await task();
      if (success) message.success(success);
      return result;
    } catch (e: any) {
      if (e instanceof AuthError) logout(e.message);
      else message.error(e.message);
      throw e;
    } finally {
      locked.current = false;
      setPending(false);
      if (activeAuth.current) await load();
    }
  };
  const run = async (ids: string[]) => {
    const snapshot = { ...currentSettings };
    try {
      await execute(async () => {
        await refreshCatalog();
        setModels(catalogCache.models?.ids || []);
        if (!catalogCache.models?.ids.includes(snapshot.model))
          throw new Error("所选模型已不在模型列表中，请重新选择。");
        const body: any = {
          auth_ids: ids,
          model: snapshot.model,
          model_catalog: await modelCatalog(ids),
        };
        if (active === "candy" || active === "pelican")
          body.effort = snapshot.effort;
        if (active === "candy") body.runs = snapshot.runs;

        if (active === "detection") body.concurrency = snapshot.concurrency;
        const result = await api(BASE + tests[active].scope + "/run", {
          method: "POST",
          body,
        });
        const notes = [
          `已为 ${result.started || 0} 个凭证开始测试`,
          result.skipped ? `${result.skipped} 个不支持该模型，已跳过` : "",
          result.unchecked
            ? `${result.unchecked} 个无法确认模型列表，仍会尝试`
            : "",
          result.busy ? `${result.busy} 个正在测试，已跳过` : "",
        ].filter(Boolean);
        message.info(notes.join("；"));
      });
    } catch {}
  };
  const changeEnabled = async (a: Credential, enabled: boolean) => {
    setSwitching((s) => new Set([...s, a.id]));
    try {
      await execute(async () => {
        await api("/v0/management/auth-files/status", {
          method: "PATCH",
          body: { name: a.id, disabled: !enabled },
        });
        if (a.source !== "auth_files") await refreshCatalog({ force: true });
      });
    } catch {
    } finally {
      setSwitching((s) => {
        const next = new Set(s);
        next.delete(a.id);
        return next;
      });
    }
  };
  const changeFilter = (change: () => void) => {
    change();
    setSelected(emptySelection());
    setTile("all");
  };
  const typeFiltered = auths.filter(
    (a) => type === "all" || provider(a) === type,
  );
  const plans = [
    ...new Map(
      typeFiltered
        .map(credentialPlan)
        .filter(Boolean)
        .map((p) => [p!.label, p!]),
    ).values(),
  ].sort((a, b) => a.rank - b.rank);
  const planOptions = [
    { value: "all", label: "所有订阅类型" },
    ...(plans.filter((p) => p.pro).length > 1
      ? [{ value: "Pro ALL", label: "Pro ALL" }]
      : []),
    ...plans.map((p) => ({ value: p.label, label: p.label })),
  ];
  const filtered = typeFiltered
    .filter(
      (a) =>
        (!enabledOnly || !a.disabled) &&
        (plan === "all" ||
          (plan === "Pro ALL"
            ? credentialPlan(a)?.pro
            : credentialPlan(a)?.label === plan)) &&
        (!search ||
          [a.name, a.email, a.provider_name, a.base_url].some((v) =>
            v?.toLowerCase().includes(search.toLowerCase()),
          )),
    )
    .sort((a, b) => compareCredentialPriority(a, b) || planRank(a) - planRank(b));
  const hasHistory = (a: Credential) => a[tests[active].field].length > 0;
  const visible = filtered.filter(
    (a) =>
      tile === "all" ||
      (tile === "ready"
        ? available(a)
        : tile === "running"
          ? busy(a)
          : hasHistory(a)),
  );
  const selectedAuths = visible.filter((a) => selected[active].includes(a.id));
  const targets = (selectedAuths.length ? selectedAuths : visible).filter(
    available,
  );
  const showDetail = (a: Credential, r: RecordData) => {
    setDetailData(null);
    setDetailError("");
    setDetail({ test: active, authId: a.id, record: r });
  };
  const resultCell = (a: Credential) => {
    const p = progress(a, active);
    const r = a[tests[active].field].at(-1);
    const s = verdict(r, active);
    return (
      <div className="result-cell">
        {p ? (
          <>
            <StatusLabel tone="accent">
              {p.phase === "cancelling"
                ? "正在停止"
                : p.phase === "comparing"
                  ? "正在分析"
                  : "测试中"}
            </StatusLabel>
            {typeof p === "object" && (
              <Progress
                size="small"
                percent={Math.round(
                  ((p.done || 0) / (p.total || config.detection.requests)) *
                    100,
                )}
                format={() =>
                  `${p.done || 0}/${p.total || config.detection.requests}`
                }
              />
            )}
          </>
        ) : (
          <>
            <Tooltip title={r?.error || ""}>
              <StatusLabel tone={s.tone}>{s.label}</StatusLabel>
            </Tooltip>
            {active === "detection" && r?.attribution && r.attribution.decision !== "not_model" && (
              <span className="secondary">{s.tone === "success" ? "与测试模型一致" : "与测试模型不一致"}{r.status === "partial" ? " · 部分结果" : ""}</span>
            )}
            {r && (
              <>
                <span className="secondary mono result-model">
                  {r.model}
                  {r.effort ? " · " + r.effort : ""}
                  {active === "detection"
                    ? " · " + percent(r.attribution?.probability)
                    : ""}
                </span>
                <span className="secondary">
                  {r.duration_ms == null
                    ? "—"
                    : (r.duration_ms / 1000).toFixed(1) + "s"}{" "}
                  · 输出 {r.output_tokens?.toLocaleString() ?? "—"}
                </span>
              </>
            )}
          </>
        )}
      </div>
    );
  };
  const columns: any[] = [
    {
      title: "凭证",
      key: "credential",
      width: 300,
      render: (_: unknown, a: Credential) => (
        <div className="credential-cell">
          <Tooltip title={masked ? "凭证已脱敏" : a.email || a.name}>
            <Typography.Text
              className={masked ? "credential-name masked" : "credential-name"}
              ellipsis
            >
              {masked
                ? "••••••••••••"
                : a.source === "ai_providers"
                  ? a.base_url?.replace(/^https?:\/\//, "") || "默认地址"
                  : a.email || a.name}
            </Typography.Text>
          </Tooltip>
          {a.source === "ai_providers" && (
            <span
              className={masked ? "secondary mono masked" : "secondary mono"}
            >
              {masked ? "••••••••" : a.name}
            </span>
          )}
          <Space size={[4, 4]} wrap>
            <Tag><span className="provider-label"><ProviderBrandIcon provider={provider(a)} size={12} />{provider(a)}</span></Tag>
            {a.provider_name && <Tag>{a.provider_name}</Tag>}
            {credentialPlan(a) && <Tag className="subscription-label">{credentialPlan(a)!.label}</Tag>}
            <span className="secondary mono">P{a.priority ?? 0}</span>
            {a.unavailable && (
              <Tooltip title={unavailableReason(a)}>
                <StatusLabel tone="warn">不可用</StatusLabel>
              </Tooltip>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: "最近一次",
      key: "result",
      width: 240,
      render: (_: unknown, a: Credential) => resultCell(a),
    },
    ...(active === "candy"
      ? [
          {
            title: "正确率",
            key: "rate",
            width: 90,
            render: (_: unknown, a: Credential) => {
              const graded = a.results.filter(
                (r) =>
                  r.model === currentSettings.model &&
                  (r.effort || "none") === currentSettings.effort &&
                  !r.error &&
                  !r.skipped,
              );
              const ok = graded.filter((r) => r.ok).length;
              return graded.length ? (
                <div className="rate">
                  <strong>{Math.round((ok / graded.length) * 100)}%</strong>
                  <small>
                    {ok}/{graded.length}
                  </small>
                </div>
              ) : (
                <span className="secondary">—</span>
              );
            },
          },
          {
            title: "最近 20 次",
            key: "marks",
            width: 160,
            render: (_: unknown, a: Credential) => (
              <div className="result-marks">
                {a.results.slice(-20).map((r, i) => {
                  const s = verdict(r, "candy");
                  const dim =
                    r.model !== currentSettings.model ||
                    (r.effort || "none") !== currentSettings.effort;
                  return (
                    <Tooltip
                      key={i}
                      title={`${fmtTime(r.time)} · ${r.model} · ${s.label}`}
                    >
                      <Button
                        type="text"
                        className={`result-mark tone-${s.tone} ${dim ? "is-dim" : ""}`}
                        size="small"
                        aria-label={`${fmtTime(r.time)} ${s.label}`}
                        onClick={() => showDetail(a, r)}
                      >
                        <span />
                      </Button>
                    </Tooltip>
                  );
                })}
              </div>
            ),
          },
        ]
      : [
          {
            title: "测试时间",
            key: "time",
            width: 160,
            render: (_: unknown, a: Credential) => (
              <span className="secondary mono">
                {fmtTime(a[tests[active].field].at(-1)?.time)}
              </span>
            ),
          },
        ]),
    ...(active === "pelican"
      ? [
          {
            title: "动画",
            key: "preview",
            width: 160,
            render: (_: unknown, a: Credential) => {
              const r = a.pelicans.at(-1);
              return r?.id && !r.error ? (
                <PelicanPreview
                  authId={a.id}
                  recordId={r.id}
                  onOpen={() => showDetail(a, r)}
                />
              ) : (
                <span className="secondary">—</span>
              );
            },
          },
        ]
      : []),
    {
      title: "启用",
      key: "enabled",
      width: 75,
      render: (_: unknown, a: Credential) => {
        const can =
          a.source === "auth_files" || a.id.startsWith(a.provider + ":apikey:");
        return (
          <Tooltip
            title={
              !can ? "请在 CPA 中启用或停用此凭证" : busy(a) ? "测试进行中" : ""
            }
          >
            <Switch
              size="small"
              aria-label={`启用 ${a.name}`}
              checked={!a.disabled}
              disabled={!can || busy(a) || pending}
              loading={switching.has(a.id)}
              onChange={(checked) => void changeEnabled(a, checked)}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_: unknown, a: Credential) => {
        const cancellable =
          (active === "detection") &&
          progress(a, active);
        return cancellable ? (
          <Button
            size="small"
            icon={<Square size={12} />}
            disabled={pending || progress(a, active)?.phase === "cancelling"}
            onClick={() =>
              void execute(() =>
                api(BASE + tests[active].scope + "/cancel", {
                  method: "POST",
                  body: { auth_ids: [a.id] },
                }),
              ).catch(() => {})
            }
          >
            停止
          </Button>
        ) : (
          <Tooltip
            title={
              a.disabled
                ? "凭证已停用"
                : busy(a)
                    ? "凭证正在测试"
                    : !currentSettings.model
                      ? "请选择模型"
                      : ""
            }
          >
            <Button
              size="small"
              icon={<Play size={12} />}
              disabled={
                pending ||
                !available(a) ||
                !models.includes(currentSettings.model)
              }
              onClick={() => void run([a.id])}
            >
              测试
            </Button>
          </Tooltip>
        );
      },
    },
  ];
  const history = (a: Credential) => {
    const records = [...a[tests[active].field]].reverse();
    return records.length ? (
      <div className="history">
        <h3>
          历史记录 <span className="secondary">{records.length}</span>
        </h3>
        {active === "candy" ? (
          <Collapse
            items={records.map((r, i) => {
              const s = verdict(r, active);
              return {
                key: records.length - 1 - i,
                label: (
                  <Space wrap>
                    <StatusLabel tone={s.tone}>{s.label}</StatusLabel>
                    <span className="mono secondary">
                      {fmtTime(r.time)} · {r.model} · {r.effort || "none"}
                    </span>
                  </Space>
                ),
                children: (
                  <>
                    <RecordMeta record={r} />
                    <Answer record={r} />
                  </>
                ),
              };
            })}
          />
        ) : (
          <Table
            size="small"
            pagination={false}
            rowKey={(r: RecordData) => r.id || r.time}
            dataSource={records}
            scroll={{ x: 600 }}
            columns={[
              { title: "时间", dataIndex: "time", render: fmtTime },
              { title: "模型", dataIndex: "model" },
              {
                title: "结果",
                render: (_: unknown, r: RecordData) => {
                  const s = verdict(r, active);
                  return <StatusLabel tone={s.tone}>{s.label}</StatusLabel>;
                },
              },
              {
                title: "耗时",
                dataIndex: "duration_ms",
                render: (v: number) =>
                  v == null ? "—" : (v / 1000).toFixed(1) + "s",
              },
              {
                title: "操作",
                render: (_: unknown, r: RecordData) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => showDetail(a, r)}
                  >
                    查看详情
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>
    ) : (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测试记录" />
    );
  };
  const clearHistory = async () => {
    if (!clearTarget) return;
    const scope = clearTarget === "all" ? "/all" : tests[clearTarget].scope;
    try {
      await execute(
        () => api(BASE + scope + "/results", { method: "DELETE" }),
        "测试记录已清空",
      );
      setClearTarget(null);
    } catch {}
  };
  if (!auth)
    return (
      <main className="login-page">
        <Card title="连接 CPA" className="login-card">
          <p className="secondary">使用 CPA 管理密钥访问凭证和测试记录。</p>
          {error && <Alert type="error" showIcon title={error} />}
          <Form
            layout="vertical"
            onFinish={({ key }) => {
              const next = key.trim();
              if (!next) return;
              setError("");
              try {
                sessionStorage.setItem(KEY_STORE, next);
              } catch {}
              setAuth(next);
            }}
          >
            <Form.Item
              name="key"
              label="管理密钥"
              rules={[{ required: true, message: "请输入管理密钥" }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              连接
            </Button>
          </Form>
        </Card>
      </main>
    );
  const modelOptions = models
    .filter((m) =>
      active === "detection"
        ? !/[()]/.test(m)
        : true,
    )
    .map((value) => ({ value, label: value }));
  return (
    <main className="evaluation-page">
      <div className="standalone-heading">
        <h1>降智测试</h1>
        <span className="secondary">
          检查推理表现、模型身份与代码生成能力。
        </span>
      </div>
      <StatTiles
        ariaLabel="凭证概览"
        selected={tile}
        onSelect={setTile}
        tiles={[
          {
            key: "all",
            label: "当前凭证",
            count: loaded ? filtered.length : undefined,
            tone: "neutral",
          },
          {
            key: "ready",
            label: "可测试",
            count: loaded ? filtered.filter(available).length : undefined,
            tone: "neutral",
          },
          {
            key: "running",
            label: "测试中",
            count: loaded ? filtered.filter(busy).length : undefined,
            tone: "accent",
          },
          {
            key: "history",
            label: "含历史记录",
            count: loaded ? filtered.filter(hasHistory).length : undefined,
            tone: "neutral",
          },
        ]}
      />
      <Tabs
        activeKey={active}
        onChange={(v) => {
          setTest(v as Test);
          setTile("all");
        }}
        items={(Object.keys(tests) as Test[]).map((t) => ({
          key: t,
          label: (
            <span className="tab-label">
              {icons[t]}
              {tests[t].label}
            </span>
          ),
        }))}
        tabBarExtraContent={
          <Space size={4}>
            <Tooltip title="清空全部测试记录">
              <Button
                type="text"
                aria-label="清空全部测试记录"
                icon={<Trash2 size={15} />}
                disabled={
                  pending ||
                  !auths.some((a) =>
                    Object.values(tests).some((t) => a[t.field].length),
                  )
                }
                onClick={() => setClearTarget("all")}
              />
            </Tooltip>
            <Tooltip title="刷新凭证和模型">
              <Button
                type="text"
                aria-label="刷新凭证和模型"
                loading={loading}
                icon={<RefreshCw size={15} />}
                disabled={pending}
                onClick={() => {
                  resetCatalogCache();
                  void load(true);
                }}
              />
            </Tooltip>
          </Space>
        }
      />
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          closable
          onClose={() => setError("")}
        />
      )}
      {storageError && <Alert type="warning" showIcon title={storageError} />}
      <div className="test-intro">
        <p>{tests[active].description}</p>
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: "prompt",
              label:
                active === "candy" || active === "pelican"
                  ? "查看题目"
                  : "查看原理",
              children:
                active === "candy" || active === "pelican" ? (
                  <Typography.Paragraph
                    className="prompt-text"
                    copyable={{ text: promptText(active + "-prompt") }}
                  >
                    <pre>{promptText(active + "-prompt")}</pre>
                  </Typography.Paragraph>
                ) : (
                  <div className="principle">
                    <p>不同模型生成整数时，对数值、区间、末位数字及相邻数字变化的偏好相对稳定。每次从参考库的 36 道挑战中随机抽取 3 道进行比对。</p>
                    <p>相邻数字的变化方式不像语言模型时不生成排名；三条回答有效时给出归因概率，一两条有效时只给出排名。概率仅在参考库模型之间分配，不能证明模型身份。</p>
                    <a href="https://github.com/Ikaleio/lm-detector" target="_blank" rel="noreferrer">LM Fingerpoint Detector <ExternalLink size={12} /></a>
                  </div>
                ),
            },
          ]}
        />
      </div>
      <Card size="small" className="test-controls">
        <Form
          layout="vertical"
          className="control-form"
          onFinish={() => void run(targets.map((a) => a.id))}
        >
          <Form.Item label="模型">
            <Select
              aria-label="模型"
              showSearch
              optionFilterProp="label"
              value={currentSettings.model}
              options={modelOptions}
              onChange={(v) => setSetting("model", v)}
              notFoundContent="模型列表为空，请刷新"
            />
          </Form.Item>
          {(active === "candy" || active === "pelican") && (
            <Form.Item label="推理强度">
              <Select
                aria-label="推理强度"
                value={currentSettings.effort}
                options={["none", "low", "medium", "high", "xhigh", "max"].map(
                  (value) => ({ value, label: value }),
                )}
                onChange={(v) => setSetting("effort", v)}
              />
            </Form.Item>
          )}
          {active === "candy" && (
            <Form.Item label="每凭证次数">
              <InputNumber
                aria-label="每凭证次数"
                min={1}
                max={10}
                precision={0}
                value={currentSettings.runs}
                onChange={(v) => setSetting("runs", v ?? 1)}
              />
            </Form.Item>
          )}

          {(active === "detection") && (
            <Form.Item label="每凭证并发">
              <InputNumber
                aria-label="每凭证并发"
                min={1}
                max={config.detection.requests}
                precision={0}
                value={currentSettings.concurrency}
                onChange={(v) => setSetting("concurrency", v ?? 1)}
              />
            </Form.Item>
          )}
          <Form.Item className="batch-control">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Play size={14} />}
              loading={pending}
              disabled={
                !targets.length || !models.includes(currentSettings.model)
              }
            >
              测试
              {selectedAuths.length ? "所选" : "全部"} ({targets.length})
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <div className="test-notes">
        {active === "candy" ? (
          <>
            <Space size={14} wrap>
              <StatusLabel tone="success">答对</StatusLabel>
              <StatusLabel tone="danger">答错 / 请求出错</StatusLabel>
              <StatusLabel tone="neutral">已跳过</StatusLabel>
            </Space>
            <span>
              正确率按 {currentSettings.model} ({currentSettings.effort}) 统计
            </span>
          </>
        ) : (
          <span>
            每个凭证{" "}
            {active === "detection" ? config.detection.requests : 1}{" "}
            次请求
            {active === "detection"
              ? "（失败会重试）"
              : ""}
          </span>
        )}
      </div>
      <section className="credential-panel">
        <div className="credential-provider-tabs">
          <ProviderFilterTabs
            providers={["all", ...[...new Set(auths.map(provider))].sort()]}
            counts={Object.fromEntries([["all", auths.length], ...[...new Set(auths.map(provider))].map(value => [value, auths.filter(a => provider(a) === value).length])])}
            active={type}
            onChange={value => changeFilter(() => { setType(value); setPlan("all"); })}
          />
        </div>
        <div className="credential-toolbar">
          <Space size={12} wrap>
            <strong>凭证</strong>
            <Space size={6}>
              <Switch
                size="small"
                aria-label="仅启用"
                checked={enabledOnly}
                onChange={(v) => changeFilter(() => setEnabledOnly(v))}
              />
              <span className="secondary">仅启用</span>
            </Space>
            <Select
              aria-label="订阅类型"
              value={plan}
              options={
                planOptions.some((o) => o.value === plan)
                  ? planOptions
                  : [...planOptions, { value: plan, label: plan }]
              }
              onChange={(v) => changeFilter(() => setPlan(v))}
            />
          </Space>
          <Space size={4}>
            <Input.Search
              aria-label="搜索凭证"
              placeholder="搜索凭证"
              value={search}
              allowClear
              onChange={(e) => changeFilter(() => setSearch(e.target.value))}
            />
            <Tooltip title={masked ? "取消脱敏" : "脱敏"}>
              <Button
                aria-label={masked ? "取消脱敏" : "脱敏"}
                aria-pressed={masked}
                className={masked ? "privacy-toggle is-active" : "privacy-toggle"}
                icon={masked ? <EyeOff size={15} /> : <Eye size={15} />}
                onClick={() => setMasked(!masked)}
              >
                脱敏
              </Button>
            </Tooltip>
            <Tooltip title={`清空${tests[active].label}记录`}>
              <Button
                type="text"
                aria-label={`清空${tests[active].label}记录`}
                icon={<Trash2 size={15} />}
                disabled={
                  pending || !auths.some((a) => a[tests[active].field].length)
                }
                onClick={() => setClearTarget(active)}
              />
            </Tooltip>
          </Space>
        </div>
        <Table<Credential>
          size="small"
          className="credential-table"
          rowKey="id"
          loading={loading && !loaded}
          columns={columns}
          dataSource={visible}
          scroll={{ x: active === "candy" ? 1060 : 970 }}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selected[active],
            onChange: (keys) => setSelected({ ...selected, [active]: keys }),
            getCheckboxProps: (a) => ({
              disabled: pending || !available(a),
              "aria-label": `选择 ${a.name}`,
            }),
          }}
          expandable={{
            expandedRowRender: history,
            rowExpandable: (a) => a[tests[active].field].length > 0,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  error ? "读取失败，请刷新重试" : "没有符合筛选条件的凭证"
                }
              />
            ),
          }}
        />
      </section>
      <Modal
        title={detail ? tests[detail.test].label + "详情" : ""}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        {detailError ? (
          <Alert type="error" showIcon title={detailError} />
        ) : detailData && detail ? (
          <RecordDetail
            key={detail.authId + detail.record.id + detail.record.time}
            record={detailData}
            test={detail.test}
          />
        ) : (
          <div className="detail-loading">
            <Spin />
          </div>
        )}
      </Modal>
      <Modal
        title={`清空${clearTarget === "all" ? "全部测试" : clearTarget ? tests[clearTarget].label : ""}记录？`}
        open={!!clearTarget}
        onCancel={() => setClearTarget(null)}
        onOk={() => void clearHistory()}
        okText="清空记录"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: pending }}
      >
        <p>
          此操作对所有凭证生效，删除后无法恢复。正在进行的测试不受影响，完成后仍会保存结果。
        </p>
      </Modal>
    </main>
  );
}
function Root() {
  const theme = useOmcTheme();
  return (
    <ConfigProvider theme={theme} locale={zhCN} variant="filled" tag={{ variant: "filled" }} wave={{ disabled: true }} button={{ autoInsertSpace: false }}>
      <AntApp>
        <EvaluationApp />
      </AntApp>
    </ConfigProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Root />);
