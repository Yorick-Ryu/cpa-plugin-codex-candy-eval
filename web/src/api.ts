export const BASE = "/v0/management/plugins/cpa-codex-candy-eval";
export const KEY_STORE = "cpa-codex-candy-eval.key";
let sessionKey = "";
export const setSessionKey = (value: string) => {
  sessionKey = value;
};
export class AuthError extends Error {}
export function initialKey(): string {
  try {
    let raw = localStorage.getItem("cli-proxy-auth");
    if (raw?.startsWith("enc::v1::")) {
      const secret = new TextEncoder().encode(
        "cli-proxy-api-webui::secure-storage|" +
          location.host +
          "|" +
          navigator.userAgent,
      );
      raw = new TextDecoder().decode(
        Uint8Array.from(
          atob(raw.slice(9)),
          (c, i) => c.charCodeAt(0) ^ secret[i % secret.length],
        ),
      );
    }
    const key = raw && JSON.parse(raw)?.state?.managementKey;
    if (typeof key === "string" && key.trim()) return key.trim();
  } catch {}
  try {
    return sessionStorage.getItem(KEY_STORE) || "";
  } catch {
    return "";
  }
}
export async function api(
  path: string,
  {
    method = "GET",
    body,
    apiKey,
    signal,
  }: {
    method?: string;
    body?: unknown;
    apiKey?: string;
    signal?: AbortSignal;
  } = {},
): Promise<any> {
  const requestKey = apiKey ?? sessionKey;
  const timeout = AbortSignal.timeout(30000);
  const headers: Record<string, string> = {
    Authorization: "Bearer " + requestKey,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let resp: Response;
  try {
    resp = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error: any) {
    if (signal?.aborted) throw error;
    throw new Error(
      error.name === "TimeoutError"
        ? "连接超时，请稍后重试。"
        : "无法连接 CPA，请检查网络后重试。",
    );
  }
  const text = await resp.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {}
  if (resp.status === 401 && apiKey === undefined && requestKey === sessionKey)
    throw new AuthError("管理密钥无效，请重新输入。");
  if (!resp.ok)
    throw Object.assign(
      new Error(
        String(
          (typeof data?.error === "string"
            ? data.error
            : data?.error?.message) ||
            text ||
            "HTTP " + resp.status,
        ).slice(0, 500),
      ),
      { status: resp.status },
    );
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("服务器返回了无效数据，请稍后重试。");
  return data;
}
