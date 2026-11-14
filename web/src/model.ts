import type { StatusTone } from "./omc/common/StatusLabel";
export type Test = "candy" | "ciallo" | "detection" | "pelican" | "siwc";
export type RecordData = {
  code?: string;
  http_status?: number;
  method?: string;
  verdict?: string;
  verdict_rule?: string;
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
  siwc_bound?: boolean;
  use_siwc?: boolean;
  siwc: RecordData[];
  siwc_running?: any;
  priority: number;
  disabled: boolean;
  unavailable?: boolean;
  status_message?: string;
  next_retry_after?: string;
  results: RecordData[];
  detections: RecordData[];
  pelicans: RecordData[];
  running?: any;
  detection_running?: any;
  pelican_running?: boolean;
};
export const tests: Record<
  Test,
  {
    label: string;
    field: "results" | "detections" | "pelicans" | "siwc";
    scope: string;
    description: string;
  }
> = {
  siwc: {
    label: "SIWC 检测", field: "siwc", scope: "/siwc",
    description: "检查已绑定并开启 SIWC 的 Codex 凭证是否可用，区分订阅共享受限、额度限制和认证异常。每次检测会发起一次模型请求。",
  },
  candy: {
    label: "糖果题",
    field: "results",
    scope: "/candy",
    description: "让模型解一道糖果题，答出 21 即为正确。",
  },
  ciallo: {
    label: "Ciallo", field: "results", scope: "/candy",
    description: "发送 ciallo，回复含独立词 ciallo 为通过，含 ciao 为未通过，忽略大小写、标点和表情；两者都有或都没有则无法判断。历史按当前规则显示，原回复保留。仅供娱乐，不能确认模型身份或能力。",
  },
  detection: {
    label: "指纹检测",
    field: "detections",
    scope: "/fingerprint",
    description: "通过三次随机数字挑战，识别参考库中最接近的模型与家族。",
  },
  pelican: {
    label: "画鹈鹕",
    field: "pelicans",
    scope: "/pelican",
    description: "让模型用 HTML 和 SVG 绘制鹈鹕骑自行车的动画。",
  },
};
export const busy = (a: Credential) =>
  !!(
    a.running ||
    a.detection_running ||
    a.pelican_running ||
    a.siwc_running
  );
export const available = (a: Credential) =>
  !a.disabled && !busy(a);
export const progress = (a: Credential, test: Test) =>
  (test === "candy" || test === "ciallo")
    ? ((a.running?.method || "candy") === test ? a.running : undefined)
    : test === "detection" ? a.detection_running : test === "siwc" ? a.siwc_running : a.pelican_running;

export const provider = (a: Credential) =>
  a.provider.startsWith("openai-compatible-")
    ? "openai-compatibility"
    : a.provider;
export const credentialType = (a: Credential) => a.source + ":" + provider(a);
export const compareCredentialPriority = (a: Credential, b: Credential) => {
  const aSupplier = a.source === "ai_providers";
  const bSupplier = b.source === "ai_providers";
  if (aSupplier !== bSupplier) return aSupplier ? 1 : -1;
  if (aSupplier) return 0;
  return (b.priority ?? 0) - (a.priority ?? 0);
};
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
  if (test === "siwc") {
    const states: Record<string, {label: string; tone: StatusTone}> = {
      available: {label: "SIWC 可用", tone: "success"},
      restricted: {label: "订阅共享受限", tone: "danger"},
      limited: {label: "额度或频率受限", tone: "warn"},
      auth_error: {label: "认证异常", tone: "danger"},
      failed: {label: "检测未完成", tone: "danger"},
      skipped: {label: "已跳过", tone: "neutral"},
    };
    return states[r.status || "failed"] || states.failed;
  }
  if (r.skipped || r.status === "skipped")
    return { label: "已跳过", tone: "neutral" };
  if (r.status === "cancelled") return { label: "已停止", tone: "neutral" };
  if ((r.error && !(test === "detection" && r.attribution)) || r.status === "failed")
    return {
      label: (test === "candy" || test === "ciallo") ? "请求出错" : "测试失败",
      tone: "danger",
    };
  if (test === "ciallo" || (test === "candy" && r.method === "ciallo")) {
    if (r.verdict === "pass") return { label: "Ciallo 通过", tone: "success" };
    if (r.verdict === "fail") return { label: "Ciallo 未通过", tone: "danger" };
    return { label: "Ciallo 无法判断", tone: "neutral" };
  }
  if (test === "candy")
    return { label: r.ok ? "答对" : "答错", tone: r.ok ? "success" : "danger" };
  if (test === "pelican") return { label: "已生成", tone: "success" };
  if (!r.attribution) return { label: "暂无归因结果", tone: "neutral" };
  if (r.attribution.decision === "not_model")
    return { label: "不像语言模型回答", tone: "warn" };
  const match = detectionModelID(r.model) === detectionModelID(r.attribution.prediction);
  return {
    label: r.attribution.prediction_name || r.attribution.prediction || "暂无结果",
    tone: match ? "success" : "warn",
  };
}
export function detectionModelID(model: string = "") {
  const id = model.trim().toLowerCase().split("/").pop() || "";
  const aliases = window.CANDY_CONFIG.detection.aliases as Record<string, string>;
  return Object.hasOwn(aliases, id) ? aliases[id] : id;
}

export function parseState(data: any): Credential[] {
  if (!Array.isArray(data?.credentials) || data.credentials.some((a: any) =>
    !a || typeof a.id !== "string" || !a.id.trim() ||
    ["candies", "fingerprints", "pelicans"].some(f => !Array.isArray(a[f]) ||
      a[f].some((r: any) => !r || typeof r !== "object" || Array.isArray(r)))))
    throw new Error("服务器返回的测试记录格式无效。");
  if (data.credentials.some((a: any) => a.siwc !== undefined && (!Array.isArray(a.siwc) || a.siwc.some((r: any) => !r || typeof r !== "object" || Array.isArray(r)))))
    throw new Error("服务器返回的 SIWC 记录格式无效。");
  return data.credentials.map((a: any) => {
    const p = a.running ? {...a.running, phase: a.running.cancelling ? "cancelling" : "running"} : undefined;
    return {...a,
      results: a.candies.map((r: any) => ({...r, ok: r.status === "correct", skipped: r.status === "skipped"})),
      detections: a.fingerprints,
      running: p?.test === "candy" ? p : undefined,
      detection_running: p?.test === "fingerprint" ? p : undefined,
      pelican_running: p?.test === "pelican" ? p : undefined,
      siwc_running: p?.test === "siwc" ? p : undefined,
      siwc: a.siwc || [],
    };
  });
}

export function recordsFor(a: Credential, test: Test): RecordData[] {
  const records = a[tests[test].field];
  return test === "candy" || test === "ciallo"
    ? records.filter(r => (r.method || "candy") === test)
    : records;
}

export function runBlocker(a: Credential, test: Test): string {
  if (a.disabled) return "凭证已停用";
  if (busy(a)) return "凭证正在测试";
  if (test === "siwc") {
    if (a.source !== "auth_files" || a.provider !== "codex") return "仅支持 Codex 认证文件";
    if (!a.siwc_bound) return "请先在 CPA 的 OAuth 登录中绑定 SIWC";
    if (!a.use_siwc) return "请先开启「使用 SIWC」";
    if (a.unavailable) return "凭证暂不可用";
  }
  return "";
}
