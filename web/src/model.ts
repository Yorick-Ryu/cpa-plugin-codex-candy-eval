import type { StatusTone } from "./omc/common/StatusLabel";
export type Test = "candy" | "fingerprint" | "modeltrace" | "pelican";
export type RecordData = {
  id?: string;
  time: string;
  model: string;
  effort?: string;
  ok?: boolean;
  answer?: string;
  error?: string;
  skipped?: boolean;
  status?: string;
  duration_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  mode?: string;
  done?: number;
  total?: number;
  valid?: number;
  errors?: number;
  html?: string;
  attribution?: any;
  samples?: any[];
};
export type Credential = {
  id: string;
  provider: string;
  source: string;
  name: string;
  email?: string;
  base_url?: string;
  provider_name?: string;
  plan_type?: string;
  priority: number;
  disabled: boolean;
  unavailable?: boolean;
  status_message?: string;
  next_retry_after?: string;
  results: RecordData[];
  fingerprints: RecordData[];
  modeltraces: RecordData[];
  pelicans: RecordData[];
  running?: any;
  fingerprint_running?: any;
  modeltrace_running?: any;
  pelican_running?: boolean;
};
export const tests: Record<
  Test,
  {
    label: string;
    field: "results" | "fingerprints" | "modeltraces" | "pelicans";
    scope: string;
    description: string;
  }
> = {
  candy: {
    label: "糖果测试",
    field: "results",
    scope: "",
    description: "让模型解一道糖果题，答出 21 即为正确。",
  },
  fingerprint: {
    label: "模型指纹",
    field: "fingerprints",
    scope: "/fingerprint",
    description: "采集模型的回答特征，与正常基准对比，判断模型是否被替换。",
  },
  modeltrace: {
    label: "ModelTrace",
    field: "modeltraces",
    scope: "/modeltrace",
    description: "通过三次数字生成挑战，识别最接近的模型家族与版本。",
  },
  pelican: {
    label: "鹈鹕动画",
    field: "pelicans",
    scope: "/pelican",
    description: "让模型用 HTML 和 SVG 绘制鹈鹕骑自行车的动画。",
  },
};
export const busy = (a: Credential) =>
  !!(
    a.running ||
    a.fingerprint_running ||
    a.modeltrace_running ||
    a.pelican_running
  );
export const available = (a: Credential) =>
  !a.disabled && !a.unavailable && !busy(a);
export const progress = (a: Credential, test: Test) =>
  test === "candy"
    ? a.running
    : test === "fingerprint"
      ? a.fingerprint_running
      : test === "modeltrace"
        ? a.modeltrace_running
        : a.pelican_running;
export const provider = (a: Credential) =>
  a.provider.startsWith("openai-compatible-")
    ? "openai-compatibility"
    : a.provider;
export const credentialType = (a: Credential) => a.source + ":" + provider(a);
export const typeLabel = (type: string) => {
  const [source, ...rest] = type.split(":");
  return (
    (source === "auth_files" ? "认证文件" : "AI 提供商") +
    " · " +
    rest.join(":")
  );
};
export const fmtTime = (time?: string) =>
  time ? new Date(time).toLocaleString("zh-CN", { hour12: false }) : "—";
export const percent = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? (value * 100).toFixed(1) + "%"
    : "—";
export function verdict(
  r: RecordData | undefined,
  test: Test,
): { label: string; tone: StatusTone } {
  if (!r) return { label: "尚未测试", tone: "neutral" };
  if (r.skipped || r.status === "skipped")
    return { label: "已跳过", tone: "neutral" };
  if (r.status === "cancelled") return { label: "已停止", tone: "neutral" };
  if (r.error || r.status === "failed")
    return {
      label: test === "candy" ? "请求出错" : "测试失败",
      tone: "danger",
    };
  if (test === "candy")
    return { label: r.ok ? "答对" : "答错", tone: r.ok ? "success" : "danger" };
  if (test === "pelican") return { label: "已生成", tone: "success" };
  if (test === "modeltrace") {
    if (!r.attribution) return { label: "暂无归因结果", tone: "neutral" };
    const same = (id: string) => id.trim().toLowerCase().split("/").pop();
    const match = same(r.model) === same(r.attribution.prediction || "");
    return {
      label: r.attribution.prediction || "暂无结果",
      tone: match ? "success" : "warn",
    };
  }
  const states: Record<string, [string, StatusTone]> = {
    consistent: ["与所选模型一致", "success"],
    substitution: ["疑似模型替换", "warn"],
    different: ["与所选模型有差异", "danger"],
    ambiguous: ["暂无法判断", "neutral"],
    insufficient: ["有效回答不足", "neutral"],
    no_baseline: ["暂无模型基准", "neutral"],
    unstable: ["结果不稳定", "warn"],
  };
  const status =
    r.status && r.status !== "completed" ? r.status : r.attribution?.status;
  const [label, tone] = states[status] || ["暂无结果", "neutral"];
  return { label, tone };
}
export function parseState(data: any): Credential[] {
  if (
    !Array.isArray(data.auths) ||
    data.auths.some(
      (a: any) =>
        !a ||
        typeof a.id !== "string" ||
        !a.id.trim() ||
        ["results", "fingerprints", "modeltraces", "pelicans"].some(
          (f) =>
            !Array.isArray(a[f]) ||
            a[f].some(
              (r: any) => !r || typeof r !== "object" || Array.isArray(r),
            ),
        ),
    )
  )
    throw new Error("服务器返回的测试记录格式无效。");
  return data.auths;
}
