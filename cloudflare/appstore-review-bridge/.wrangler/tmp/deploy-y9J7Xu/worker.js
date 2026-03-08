var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");

// ../../../../.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// worker.js
import crypto from "node:crypto";
import { Buffer as Buffer2 } from "node:buffer";
var APPSTORE_REVIEW_EVENT_TYPE = "APP_STORE_VERSION_APP_VERSION_STATE_UPDATED";
var APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY = "APPSTORE_CONNECT_PRIVATE_KEY_P8";
var APPLE_API_ORIGIN = "https://api.appstoreconnect.apple.com";
var WEBHOOK_EVENT_TYPES = [APPSTORE_REVIEW_EVENT_TYPE];
var json = /* @__PURE__ */ __name((payload, init = {}) => new Response(JSON.stringify(payload, null, 2), {
  ...init,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...init.headers || {}
  }
}), "json");
var html = /* @__PURE__ */ __name((markup, init = {}) => new Response(markup, {
  ...init,
  headers: {
    "content-type": "text/html; charset=utf-8",
    ...init.headers || {}
  }
}), "html");
var PUBLIC_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "img-src 'self' data:",
  "style-src 'unsafe-inline'",
  "font-src 'self'"
].join("; ");
var buildPublicSecurityHeaders = /* @__PURE__ */ __name((headers = {}) => ({
  "content-security-policy": PUBLIC_CONTENT_SECURITY_POLICY,
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  ...headers
}), "buildPublicSecurityHeaders");
var withPublicHeaders = /* @__PURE__ */ __name((response, headers = {}) => {
  const nextHeaders = new Headers(response.headers);
  Object.entries(buildPublicSecurityHeaders(headers)).forEach(([key, value]) => nextHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders
  });
}, "withPublicHeaders");
var publicTextResponse = /* @__PURE__ */ __name((message, init = {}) => withPublicHeaders(
  new Response(String(message || ""), {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...init.headers || {}
    }
  })
), "publicTextResponse");
var escapeHtml = /* @__PURE__ */ __name((value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"), "escapeHtml");
var normalizeRootDomain = /* @__PURE__ */ __name((value) => String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/+.*$/g, "").replace(/\.+$/g, "").toLowerCase(), "normalizeRootDomain");
var mergeQueryStrings = /* @__PURE__ */ __name((targetUrl, incomingUrl) => {
  const merged = new URL(targetUrl);
  const incoming = new URL(incomingUrl);
  incoming.searchParams.forEach((value, key) => {
    merged.searchParams.set(key, value);
  });
  return merged;
}, "mergeQueryStrings");
var getPublicSubdomainFromHost = /* @__PURE__ */ __name((host, rootDomain) => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  const normalizedRootDomain = normalizeRootDomain(rootDomain);
  if (!normalizedHost || !normalizedRootDomain) return "";
  const suffix = `.${normalizedRootDomain}`;
  if (!normalizedHost.endsWith(suffix)) return "";
  return normalizedHost.slice(0, -suffix.length).replace(/\.+$/g, "").trim();
}, "getPublicSubdomainFromHost");
var extractBearerToken = /* @__PURE__ */ __name((authorization) => {
  const raw = String(authorization || "").trim();
  if (!raw) return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}, "extractBearerToken");
var buildCorsHeaders = /* @__PURE__ */ __name((request) => ({
  "access-control-allow-origin": request.headers.get("Origin") || "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type",
  "access-control-max-age": "86400",
  vary: "Origin"
}), "buildCorsHeaders");
var withCors = /* @__PURE__ */ __name((response, request) => {
  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(request);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}, "withCors");
var envValue = /* @__PURE__ */ __name((env, key) => String(env?.[key] || "").trim(), "envValue");
var getSupabaseHeaders = /* @__PURE__ */ __name((env, payload = {}) => {
  const role = payload.role === "anon" ? "anon" : "service";
  const apiKey = role === "anon" ? envValue(env, "SUPABASE_ANON_KEY") : envValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) {
    throw new Error(
      role === "anon" ? "Missing SUPABASE_ANON_KEY." : "Missing SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return {
    apikey: apiKey,
    Authorization: payload.accessToken ? `Bearer ${payload.accessToken}` : `Bearer ${apiKey}`,
    Accept: "application/json",
    ...payload.includeJson ? { "content-type": "application/json" } : {},
    ...payload.extraHeaders || {}
  };
}, "getSupabaseHeaders");
var parseJsonResponse = /* @__PURE__ */ __name(async (response) => {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}, "parseJsonResponse");
var createHttpError = /* @__PURE__ */ __name((status, message, details) => {
  const error = new Error(String(message || "Request failed."));
  error.status = status;
  error.details = details;
  return error;
}, "createHttpError");
var sameHost = /* @__PURE__ */ __name((left, right) => {
  const normalizedLeft = String(left || "").trim();
  const normalizedRight = String(right || "").trim();
  if (!normalizedLeft || !normalizedRight) return false;
  try {
    return new URL(normalizedLeft).host === new URL(normalizedRight).host;
  } catch {
    return false;
  }
}, "sameHost");
var supabaseTableUrl = /* @__PURE__ */ __name((env, table) => {
  const supabaseUrl = envValue(env, "SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL.");
  return new URL(`${supabaseUrl}/rest/v1/${table}`);
}, "supabaseTableUrl");
var supabaseTableRequest = /* @__PURE__ */ __name(async (env, payload) => {
  const url = supabaseTableUrl(env, payload.table);
  const params = payload.params || {};
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });
  const response = await fetch(url.toString(), {
    method: payload.method || "GET",
    headers: getSupabaseHeaders(env, {
      role: payload.role,
      includeJson: payload.body !== void 0,
      accessToken: payload.accessToken,
      extraHeaders: payload.extraHeaders
    }),
    body: payload.body === void 0 ? void 0 : JSON.stringify(payload.body)
  });
  const parsed = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(response.status, `Supabase ${payload.table} request failed.`, parsed);
  }
  return parsed;
}, "supabaseTableRequest");
var supabaseRpcRequest = /* @__PURE__ */ __name(async (env, name, body) => {
  const supabaseUrl = envValue(env, "SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL.");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: getSupabaseHeaders(env, { includeJson: true }),
    body: JSON.stringify(body || {})
  });
  const parsed = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(response.status, `Supabase RPC ${name} failed.`, parsed);
  }
  return parsed;
}, "supabaseRpcRequest");
var fetchWebhookBySubdomain = /* @__PURE__ */ __name(async (env, subdomain) => {
  const payload = await supabaseTableRequest(env, {
    table: "appstore_review_webhooks",
    params: {
      select: [
        "app_id",
        "user_id",
        "public_token",
        "secret",
        "public_subdomain",
        "public_page_published_at",
        "key_mode",
        "key_id",
        "issuer_id",
        "public_webhook_url",
        "asc_app_id",
        "asc_app_name",
        "asc_bundle_id",
        "apple_webhook_id",
        "last_sync_status",
        "last_sync_error",
        "last_sync_at"
      ].join(","),
      public_subdomain: `eq.${subdomain}`,
      limit: "1"
    }
  });
  return Array.isArray(payload) ? payload[0] || null : null;
}, "fetchWebhookBySubdomain");
var fetchConnectorConfig = /* @__PURE__ */ __name(async (env, appId) => {
  const payload = await supabaseTableRequest(env, {
    table: "connector_app_configs",
    params: {
      select: "variables",
      app_id: `eq.${appId}`,
      limit: "1"
    }
  });
  return Array.isArray(payload) ? payload[0] || null : null;
}, "fetchConnectorConfig");
var fetchAppRecord = /* @__PURE__ */ __name(async (env, appId) => {
  const payload = await supabaseTableRequest(env, {
    table: "apps",
    params: {
      select: "id,name,alias",
      id: `eq.${appId}`,
      limit: "1"
    }
  });
  return Array.isArray(payload) ? payload[0] || null : null;
}, "fetchAppRecord");
var fetchPrivateKeySecret = /* @__PURE__ */ __name(async (env, appId, userId) => {
  const payload = await supabaseTableRequest(env, {
    table: "connector_app_secrets",
    params: {
      select: "value",
      app_id: `eq.${appId}`,
      user_id: `eq.${userId}`,
      key: `eq.${APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY}`,
      limit: "1"
    }
  });
  if (!Array.isArray(payload) || !payload.length) return "";
  return String(payload[0]?.value || "");
}, "fetchPrivateKeySecret");
var updateWebhookRow = /* @__PURE__ */ __name(async (env, payload) => {
  const response = await supabaseTableRequest(env, {
    table: "appstore_review_webhooks",
    method: "PATCH",
    params: {
      app_id: `eq.${payload.appId}`,
      user_id: `eq.${payload.userId}`,
      select: [
        "app_id",
        "user_id",
        "public_token",
        "secret",
        "public_subdomain",
        "public_page_published_at",
        "key_mode",
        "key_id",
        "issuer_id",
        "public_webhook_url",
        "asc_app_id",
        "asc_app_name",
        "asc_bundle_id",
        "apple_webhook_id",
        "last_sync_status",
        "last_sync_error",
        "last_sync_at"
      ].join(",")
    },
    extraHeaders: {
      Prefer: "return=representation"
    },
    body: {
      ...payload.patch,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return Array.isArray(response) ? response[0] || null : response;
}, "updateWebhookRow");
var fetchAuthenticatedUser = /* @__PURE__ */ __name(async (env, request) => {
  const accessToken = extractBearerToken(request.headers.get("Authorization"));
  if (!accessToken) throw createHttpError(401, "Missing Authorization bearer token.");
  const supabaseUrl = envValue(env, "SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL.");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: getSupabaseHeaders(env, {
      role: "anon",
      accessToken
    })
  });
  const parsed = await parseJsonResponse(response);
  if (!response.ok || !parsed?.id) {
    throw createHttpError(401, "Auth session is invalid or expired. Please log in again.", parsed);
  }
  return parsed;
}, "fetchAuthenticatedUser");
var requireBridgeContext = /* @__PURE__ */ __name(async (env, request, subdomain) => {
  const user = await fetchAuthenticatedUser(env, request);
  const webhook = await fetchWebhookBySubdomain(env, subdomain);
  if (!webhook) {
    throw createHttpError(404, "Webhook bridge not found for this app.");
  }
  if (String(webhook.user_id || "").trim() !== String(user.id || "").trim()) {
    throw createHttpError(403, "You do not have access to this app bridge.");
  }
  const [connectorConfig, app] = await Promise.all([
    fetchConnectorConfig(env, webhook.app_id),
    fetchAppRecord(env, webhook.app_id)
  ]);
  return {
    user,
    app,
    webhook,
    variables: connectorConfig?.variables || {},
    bundleId: String(connectorConfig?.variables?.bundle_id || "").trim()
  };
}, "requireBridgeContext");
var normalizeApplePrivateKeyPem = /* @__PURE__ */ __name((value) => {
  const raw = String(value || "").replace(/\r/g, "").replace(/\\n/g, "\n").trim();
  if (!raw) return "";
  if (/-----BEGIN [A-Z ]+-----/.test(raw)) {
    return `${raw.replace(/\n+$/g, "")}
`;
  }
  const compact = raw.replace(/\s+/g, "");
  const lines = compact.match(/.{1,64}/g) || [compact];
  return ["-----BEGIN PRIVATE KEY-----", ...lines, "-----END PRIVATE KEY-----", ""].join("\n");
}, "normalizeApplePrivateKeyPem");
var base64UrlEncode = /* @__PURE__ */ __name((value) => {
  const buffer = Buffer2.isBuffer(value) ? value : value instanceof Uint8Array ? Buffer2.from(value) : typeof value === "string" ? Buffer2.from(value) : Buffer2.from(JSON.stringify(value));
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}, "base64UrlEncode");
var readDerLength = /* @__PURE__ */ __name((buffer, state) => {
  const first = buffer[state.offset++];
  if (first == null) throw createHttpError(500, "Failed to sign App Store Connect token.");
  if ((first & 128) === 0) return first;
  const byteCount = first & 127;
  if (!byteCount || byteCount > 4 || state.offset + byteCount > buffer.length) {
    throw createHttpError(500, "Failed to sign App Store Connect token.");
  }
  let length = 0;
  for (let index = 0; index < byteCount; index += 1) {
    length = length << 8 | buffer[state.offset++];
  }
  return length;
}, "readDerLength");
var normalizeEcdsaJwtSignature = /* @__PURE__ */ __name((signature, componentSize = 32) => {
  const bytes = Buffer2.isBuffer(signature) ? Buffer2.from(signature) : Buffer2.from(signature || []);
  if (bytes.length === componentSize * 2) {
    return bytes;
  }
  if (bytes[0] !== 48) {
    throw createHttpError(500, "Failed to sign App Store Connect token.");
  }
  const state = { offset: 1 };
  const sequenceLength = readDerLength(bytes, state);
  if (state.offset + sequenceLength !== bytes.length) {
    throw createHttpError(500, "Failed to sign App Store Connect token.");
  }
  const readInteger = /* @__PURE__ */ __name(() => {
    if (bytes[state.offset++] !== 2) {
      throw createHttpError(500, "Failed to sign App Store Connect token.");
    }
    const length = readDerLength(bytes, state);
    if (length <= 0 || state.offset + length > bytes.length) {
      throw createHttpError(500, "Failed to sign App Store Connect token.");
    }
    let value = bytes.slice(state.offset, state.offset + length);
    state.offset += length;
    while (value.length > 1 && value[0] === 0) {
      value = value.slice(1);
    }
    if (value.length > componentSize) {
      throw createHttpError(500, "Failed to sign App Store Connect token.");
    }
    return Buffer2.concat([Buffer2.alloc(componentSize - value.length, 0), value]);
  }, "readInteger");
  const r = readInteger();
  const s = readInteger();
  if (state.offset !== bytes.length) {
    throw createHttpError(500, "Failed to sign App Store Connect token.");
  }
  return Buffer2.concat([r, s]);
}, "normalizeEcdsaJwtSignature");
var signEcdsaJwtInput = /* @__PURE__ */ __name((signingInput, privateKeyPem) => {
  const message = Buffer2.from(signingInput);
  try {
    const signature = crypto.sign("sha256", message, {
      key: privateKeyPem,
      dsaEncoding: "ieee-p1363"
    });
    return normalizeEcdsaJwtSignature(signature);
  } catch {
    const signature = crypto.sign("sha256", message, {
      key: privateKeyPem
    });
    return normalizeEcdsaJwtSignature(signature);
  }
}, "signEcdsaJwtInput");
var createAppStoreConnectJwt = /* @__PURE__ */ __name((payload) => {
  const normalizedKeyMode = String(payload?.keyMode || "").trim().toLowerCase();
  const normalizedKeyId = String(payload?.keyId || "").trim();
  const normalizedIssuerId = String(payload?.issuerId || "").trim();
  const normalizedPrivateKey = normalizeApplePrivateKeyPem(payload?.privateKeyPem);
  if (!["team", "individual"].includes(normalizedKeyMode)) {
    throw createHttpError(400, "Select App Store Connect key mode.");
  }
  if (!normalizedKeyId) {
    throw createHttpError(400, "App Store Connect key ID is required.");
  }
  if (normalizedKeyMode === "team" && !normalizedIssuerId) {
    throw createHttpError(400, "Issuer ID is required for team keys.");
  }
  if (!normalizedPrivateKey) {
    throw createHttpError(400, "Private key is required.");
  }
  const nowMs = Date.now();
  const iat = Math.floor(nowMs / 1e3);
  const exp = iat + 20 * 60;
  const header = { alg: "ES256", kid: normalizedKeyId, typ: "JWT" };
  const tokenPayload = {
    iat,
    exp,
    aud: "appstoreconnect-v1",
    ...normalizedKeyMode === "team" ? { iss: normalizedIssuerId } : { sub: "user" }
  };
  const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(tokenPayload)}`;
  try {
    crypto.createPrivateKey(normalizedPrivateKey);
  } catch {
    throw createHttpError(400, "Private key is not a valid .p8 key.");
  }
  const signature = signEcdsaJwtInput(signingInput, normalizedPrivateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}, "createAppStoreConnectJwt");
var getAppleCredentialIssues = /* @__PURE__ */ __name(({ keyMode, keyId, issuerId, privateKeyConfigured }) => {
  const issues = [];
  const normalizedKeyMode = String(keyMode || "").trim().toLowerCase();
  if (!["team", "individual"].includes(normalizedKeyMode)) {
    issues.push("Select key mode.");
  }
  if (!String(keyId || "").trim()) {
    issues.push("Enter key ID.");
  }
  if (normalizedKeyMode === "team" && !String(issuerId || "").trim()) {
    issues.push("Enter issuer ID.");
  }
  if (!privateKeyConfigured) {
    issues.push("Upload the .p8 private key.");
  }
  return issues;
}, "getAppleCredentialIssues");
var formatAppleApiError = /* @__PURE__ */ __name((status, payload) => {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const details = errors.map((entry) => {
    const parts = [entry?.code, entry?.title, entry?.detail].map((value) => String(value || "").trim()).filter(Boolean);
    return parts.join(": ");
  }).filter(Boolean);
  if (details.length) {
    return `Apple API ${status}: ${details.join(" | ")}`.slice(0, 1e3);
  }
  const fallback = String(payload?.error || "").trim() || String(payload?.message || "").trim() || `Apple API ${status} request failed.`;
  return fallback.slice(0, 1e3);
}, "formatAppleApiError");
var appleRequest = /* @__PURE__ */ __name(async (payload) => {
  const response = await fetch(payload.url, {
    method: payload.method || "GET",
    headers: {
      Authorization: `Bearer ${payload.token}`,
      Accept: "application/json",
      ...payload.body === void 0 ? {} : { "Content-Type": "application/json" }
    },
    body: payload.body === void 0 ? void 0 : JSON.stringify(payload.body)
  });
  const parsed = await parseJsonResponse(response);
  if (!response.ok) {
    const error = createHttpError(response.status, formatAppleApiError(response.status, parsed), parsed);
    error.isAppleApiError = true;
    throw error;
  }
  return parsed;
}, "appleRequest");
var listAppStoreConnectApps = /* @__PURE__ */ __name(async (payload) => {
  const apps = [];
  let nextUrl = new URL("/v1/apps", APPLE_API_ORIGIN);
  nextUrl.searchParams.set("fields[apps]", "name,bundleId,sku");
  nextUrl.searchParams.set("limit", "200");
  nextUrl.searchParams.set("sort", "name");
  for (let index = 0; nextUrl && index < 10; index += 1) {
    const response = await appleRequest({
      token: payload.token,
      url: nextUrl.toString(),
      method: "GET"
    });
    if (Array.isArray(response?.data)) apps.push(...response.data);
    const nextHref = String(response?.links?.next || "").trim();
    nextUrl = nextHref ? new URL(nextHref, APPLE_API_ORIGIN) : null;
  }
  return apps;
}, "listAppStoreConnectApps");
var normalizeAppleAppCandidates = /* @__PURE__ */ __name((items, bundleIdHint) => {
  const normalizedHint = String(bundleIdHint || "").trim().toLowerCase();
  const candidates = (Array.isArray(items) ? items : []).map((item) => {
    const bundleId = String(item?.attributes?.bundleId || "").trim();
    return {
      id: String(item?.id || "").trim(),
      name: String(item?.attributes?.name || "").trim(),
      bundle_id: bundleId,
      sku: String(item?.attributes?.sku || "").trim(),
      bundle_match: Boolean(normalizedHint) && bundleId.toLowerCase() === normalizedHint
    };
  });
  return candidates.filter((candidate) => candidate.id).sort((left, right) => {
    if (left.bundle_match !== right.bundle_match) return left.bundle_match ? -1 : 1;
    const leftName = `${left.name} ${left.bundle_id}`.toLowerCase();
    const rightName = `${right.name} ${right.bundle_id}`.toLowerCase();
    return leftName.localeCompare(rightName);
  });
}, "normalizeAppleAppCandidates");
var pickAutoBoundAppleApp = /* @__PURE__ */ __name((candidates, bundleIdHint) => {
  const normalizedHint = String(bundleIdHint || "").trim().toLowerCase();
  if (!normalizedHint) return null;
  const matches = (Array.isArray(candidates) ? candidates : []).filter(
    (candidate) => String(candidate?.bundle_id || "").trim().toLowerCase() === normalizedHint
  );
  return matches.length === 1 ? matches[0] : null;
}, "pickAutoBoundAppleApp");
var normalizePublicWebhookUrl = /* @__PURE__ */ __name((value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}, "normalizePublicWebhookUrl");
var validateExplicitPublicWebhookUrl = /* @__PURE__ */ __name((env, value) => {
  const normalizedUrl = normalizePublicWebhookUrl(value);
  if (!normalizedUrl) {
    return {
      url: "",
      issue: ""
    };
  }
  const rootDomain = envValue(env, "PUBLIC_ROOT_DOMAIN");
  if (extractManagedPublicSubdomainFromUrl(normalizedUrl, rootDomain)) {
    return {
      url: "",
      issue: ""
    };
  }
  if (sameHost(normalizedUrl, envValue(env, "SUPABASE_URL"))) {
    return {
      url: "",
      issue: "Direct Supabase webhook URLs are not allowed here. Use appshelp.cc or a custom public proxy URL."
    };
  }
  return {
    url: normalizedUrl,
    issue: ""
  };
}, "validateExplicitPublicWebhookUrl");
var extractManagedPublicSubdomainFromUrl = /* @__PURE__ */ __name((value, rootDomain) => {
  const raw = normalizePublicWebhookUrl(value);
  const normalizedRootDomain = normalizeRootDomain(rootDomain);
  if (!raw || !normalizedRootDomain) return "";
  try {
    const parsed = new URL(raw);
    const host = String(parsed.host || "").trim().toLowerCase();
    const suffix = `.${normalizedRootDomain}`;
    if (!host.endsWith(suffix)) return "";
    return host.slice(0, -suffix.length).replace(/\.+$/g, "").trim();
  } catch {
    return "";
  }
}, "extractManagedPublicSubdomainFromUrl");
var withTokenQuery = /* @__PURE__ */ __name((baseUrl, publicToken) => {
  const rawBase = String(baseUrl || "").trim();
  const normalizedToken = String(publicToken || "").trim();
  if (!rawBase || !normalizedToken) return "";
  const separator = rawBase.includes("?") ? "&" : "?";
  return `${rawBase}${separator}token=${encodeURIComponent(normalizedToken)}`;
}, "withTokenQuery");
var buildManagedPublicWebhookUrl = /* @__PURE__ */ __name((payload) => {
  const normalizedSubdomain = String(payload?.publicSubdomain || "").trim();
  const normalizedToken = String(payload?.publicToken || "").trim();
  const normalizedRootDomain = normalizeRootDomain(payload?.rootDomain);
  if (!normalizedSubdomain || !normalizedToken || !normalizedRootDomain) return "";
  return withTokenQuery(
    `https://${normalizedSubdomain}.${normalizedRootDomain}/appstore-review`,
    normalizedToken
  );
}, "buildManagedPublicWebhookUrl");
var buildEffectivePublicWebhookUrl = /* @__PURE__ */ __name((env, webhook) => {
  const rootDomain = envValue(env, "PUBLIC_ROOT_DOMAIN");
  const explicitValidation = validateExplicitPublicWebhookUrl(env, webhook?.public_webhook_url);
  const managedUrl = buildManagedPublicWebhookUrl({
    publicToken: webhook?.public_token,
    publicSubdomain: webhook?.public_subdomain,
    rootDomain
  });
  return {
    effectiveUrl: explicitValidation.url || managedUrl,
    issue: explicitValidation.issue
  };
}, "buildEffectivePublicWebhookUrl");
var webhookAttributesPayload = /* @__PURE__ */ __name((payload) => ({
  enabled: true,
  eventTypes: WEBHOOK_EVENT_TYPES,
  name: String(payload?.name || "Review status webhook").trim() || "Review status webhook",
  secret: String(payload?.secret || "").trim(),
  url: String(payload?.effectiveUrl || "").trim()
}), "webhookAttributesPayload");
var getPrivateAppleCredentials = /* @__PURE__ */ __name(async (env, webhook) => {
  const privateKey = await fetchPrivateKeySecret(env, webhook.app_id, webhook.user_id);
  const issues = getAppleCredentialIssues({
    keyMode: webhook?.key_mode,
    keyId: webhook?.key_id,
    issuerId: webhook?.issuer_id,
    privateKeyConfigured: Boolean(String(privateKey || "").trim())
  });
  if (issues.length) {
    throw createHttpError(
      400,
      `App Store Connect credentials are incomplete. ${issues.join(" ")}`
    );
  }
  return {
    webhook,
    jwt: createAppStoreConnectJwt({
      keyMode: webhook.key_mode,
      keyId: webhook.key_id,
      issuerId: webhook.issuer_id,
      privateKeyPem: privateKey
    })
  };
}, "getPrivateAppleCredentials");
var handleBridgeApps = /* @__PURE__ */ __name(async (request, env, subdomain) => {
  const { user, webhook, bundleId } = await requireBridgeContext(env, request, subdomain);
  const { jwt } = await getPrivateAppleCredentials(env, webhook);
  const rawApps = await listAppStoreConnectApps({ token: jwt });
  const candidates = normalizeAppleAppCandidates(rawApps, bundleId);
  const autoBoundCandidate = pickAutoBoundAppleApp(candidates, bundleId);
  let nextWebhook = webhook;
  if (autoBoundCandidate && autoBoundCandidate.id !== webhook.asc_app_id) {
    nextWebhook = await updateWebhookRow(env, {
      userId: user.id,
      appId: webhook.app_id,
      patch: {
        asc_app_id: autoBoundCandidate.id,
        asc_app_name: autoBoundCandidate.name || null,
        asc_bundle_id: autoBoundCandidate.bundle_id || null,
        last_sync_status: "idle",
        last_sync_error: null
      }
    });
  }
  return json({
    candidates,
    auto_bound_app_id: autoBoundCandidate?.id || null,
    webhook: nextWebhook
  });
}, "handleBridgeApps");
var handleBridgeSync = /* @__PURE__ */ __name(async (request, env, subdomain) => {
  const { user, webhook, bundleId, app } = await requireBridgeContext(env, request, subdomain);
  let workingWebhook = webhook;
  try {
    const { jwt } = await getPrivateAppleCredentials(env, webhook);
    if (!String(workingWebhook?.asc_app_id || "").trim()) {
      const rawApps = await listAppStoreConnectApps({ token: jwt });
      const candidates = normalizeAppleAppCandidates(rawApps, bundleId);
      const autoBoundCandidate = pickAutoBoundAppleApp(candidates, bundleId);
      if (!autoBoundCandidate) {
        throw createHttpError(400, "Select the App Store Connect app first, then sync the webhook.");
      }
      workingWebhook = await updateWebhookRow(env, {
        userId: user.id,
        appId: workingWebhook.app_id,
        patch: {
          asc_app_id: autoBoundCandidate.id,
          asc_app_name: autoBoundCandidate.name || null,
          asc_bundle_id: autoBoundCandidate.bundle_id || null,
          last_sync_status: "idle",
          last_sync_error: null
        }
      });
    }
    const { effectiveUrl, issue } = buildEffectivePublicWebhookUrl(env, workingWebhook);
    if (!effectiveUrl) {
      throw createHttpError(400, issue || "Public webhook URL is not ready yet for this app.");
    }
    const attributes = webhookAttributesPayload({
      effectiveUrl,
      secret: workingWebhook.secret,
      name: `${String(app?.name || "App").trim() || "App"} review status`
    });
    let appleWebhookId = String(workingWebhook?.apple_webhook_id || "").trim();
    let responsePayload = null;
    if (appleWebhookId) {
      try {
        responsePayload = await appleRequest({
          token: jwt,
          url: `${APPLE_API_ORIGIN}/v1/webhooks/${encodeURIComponent(appleWebhookId)}`,
          method: "PATCH",
          body: {
            data: {
              id: appleWebhookId,
              type: "webhooks",
              attributes
            }
          }
        });
      } catch (error) {
        if (Number(error?.status || 0) !== 404) throw error;
        appleWebhookId = "";
      }
    }
    if (!appleWebhookId) {
      responsePayload = await appleRequest({
        token: jwt,
        url: `${APPLE_API_ORIGIN}/v1/webhooks`,
        method: "POST",
        body: {
          data: {
            type: "webhooks",
            attributes,
            relationships: {
              app: {
                data: {
                  type: "apps",
                  id: workingWebhook.asc_app_id
                }
              }
            }
          }
        }
      });
      appleWebhookId = String(responsePayload?.data?.id || "").trim();
    }
    if (!appleWebhookId) {
      throw createHttpError(502, "Apple did not return a webhook ID.");
    }
    const updatedWebhook = await updateWebhookRow(env, {
      userId: user.id,
      appId: workingWebhook.app_id,
      patch: {
        apple_webhook_id: appleWebhookId,
        last_sync_at: (/* @__PURE__ */ new Date()).toISOString(),
        last_sync_status: "connected",
        last_sync_error: null
      }
    });
    return json({
      ok: true,
      webhook: updatedWebhook,
      effective_public_webhook_url: effectiveUrl
    });
  } catch (error) {
    try {
      await updateWebhookRow(env, {
        userId: user.id,
        appId: workingWebhook.app_id,
        patch: {
          last_sync_at: (/* @__PURE__ */ new Date()).toISOString(),
          last_sync_status: "error",
          last_sync_error: String(error?.message || "Webhook sync failed.").slice(0, 1e3)
        }
      });
    } catch {
    }
    throw error;
  }
}, "handleBridgeSync");
var handleBridgePing = /* @__PURE__ */ __name(async (request, env, subdomain) => {
  const { webhook } = await requireBridgeContext(env, request, subdomain);
  const { jwt } = await getPrivateAppleCredentials(env, webhook);
  const appleWebhookId = String(webhook?.apple_webhook_id || "").trim();
  if (!appleWebhookId) {
    throw createHttpError(400, "Sync the Apple webhook first, then send a test ping.");
  }
  const payload = await appleRequest({
    token: jwt,
    url: `${APPLE_API_ORIGIN}/v1/webhookPings`,
    method: "POST",
    body: {
      data: {
        type: "webhookPings",
        relationships: {
          webhook: {
            data: {
              type: "webhooks",
              id: appleWebhookId
            }
          }
        }
      }
    }
  });
  return json({
    ok: true,
    data: payload?.data || null
  });
}, "handleBridgePing");
var streamGeneratedIcon = /* @__PURE__ */ __name(async (env, imagePath) => {
  const supabaseUrl = envValue(env, "SUPABASE_URL");
  if (!supabaseUrl || !String(imagePath || "").trim()) {
    return publicTextResponse("Not found.", { status: 404 });
  }
  const encodedPath = String(imagePath || "").split("/").map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/generated-assets/${encodedPath}`, {
    headers: getSupabaseHeaders(env)
  });
  if (!response.ok) {
    return publicTextResponse(response.status === 404 ? "Not found." : "Server error.", {
      status: response.status === 404 ? 404 : 502
    });
  }
  return withPublicHeaders(
    new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "image/png",
        "cache-control": "public, max-age=300"
      }
    })
  );
}, "streamGeneratedIcon");
var normalizePublicRedirectUrl = /* @__PURE__ */ __name((value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}, "normalizePublicRedirectUrl");
var redirectTo = /* @__PURE__ */ __name((targetUrl) => {
  const normalizedTargetUrl = normalizePublicRedirectUrl(targetUrl);
  if (!normalizedTargetUrl) {
    return publicTextResponse("Not found.", { status: 404 });
  }
  return withPublicHeaders(Response.redirect(normalizedTargetUrl, 302));
}, "redirectTo");
var renderLandingPage = /* @__PURE__ */ __name((surface, requestUrl) => {
  const title = String(surface?.title || surface?.app_name || "App").trim() || "App";
  const description = String(surface?.description || "").trim();
  const appstoreUrl = String(surface?.appstore_url || "").trim();
  const privacyUrl = String(surface?.privacy_policy_url || "").trim();
  const termsUrl = String(surface?.terms_of_use_url || "").trim();
  const supportUrl = String(surface?.support_form_url || "").trim();
  const iconUrl = String(surface?.icon_image_path || "").trim() ? `${requestUrl.origin}/icon` : "";
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description).replace(/\n+/g, "<br />");
  const safeOrigin = escapeHtml(requestUrl.host);
  const button = /* @__PURE__ */ __name((href, label, variant = "secondary") => href ? `<a class="btn ${variant}" href="${escapeHtml(href)}"${href.startsWith("/") ? "" : ' target="_blank" rel="noreferrer"'}>${escapeHtml(label)}</a>` : "", "button");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${escapeHtml(description || title)}" />
    <style>
      :root {
        color-scheme: dark;
        --bg-a: #06111f;
        --bg-b: #13233d;
        --card: rgba(7, 15, 30, 0.72);
        --line: rgba(255, 255, 255, 0.1);
        --text: #eef4ff;
        --muted: rgba(220, 230, 255, 0.66);
        --accent: #7dd3fc;
        --accent-strong: #c084fc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Roboto Flex", "SF Pro Display", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%),
          radial-gradient(circle at top right, rgba(192, 132, 252, 0.18), transparent 32%),
          linear-gradient(160deg, var(--bg-a), var(--bg-b));
        color: var(--text);
      }
      .shell {
        max-width: 920px;
        margin: 0 auto;
        padding: 40px 20px 64px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .card {
        margin-top: 18px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--card);
        backdrop-filter: blur(18px);
        box-shadow: 0 18px 70px rgba(2, 8, 23, 0.36);
      }
      .hero {
        display: grid;
        gap: 24px;
        align-items: center;
      }
      @media (min-width: 760px) {
        .hero { grid-template-columns: 140px minmax(0, 1fr); }
      }
      .icon {
        width: 120px;
        height: 120px;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.28);
        object-fit: cover;
        background: rgba(255, 255, 255, 0.05);
      }
      h1 {
        margin: 0;
        font-size: clamp(34px, 6vw, 58px);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
        font-size: 15px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid var(--line);
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
      }
      .btn.primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        color: #06111f;
        border: none;
      }
      .btn.secondary {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
      }
      .footer {
        margin-top: 18px;
        font-size: 12px;
        color: rgba(220, 230, 255, 0.46);
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="eyebrow">${safeOrigin}</div>
      <section class="card">
        <div class="hero">
          ${iconUrl ? `<img class="icon" src="${escapeHtml(iconUrl)}" alt="${safeTitle} icon" />` : '<div class="icon"></div>'}
          <div>
            <h1>${safeTitle}</h1>
            ${description ? `<p style="margin-top:16px">${safeDescription}</p>` : ""}
            <div class="actions">
              ${button(appstoreUrl, "View on the App Store", "primary")}
              ${button(privacyUrl ? "/privacy" : "", "Privacy")}
              ${button(termsUrl ? "/terms" : "", "Terms")}
              ${button(supportUrl ? "/support" : "", "Support")}
            </div>
          </div>
        </div>
      </section>
      <div class="footer">Powered by appshelp.cc</div>
    </main>
  </body>
</html>`;
}, "renderLandingPage");
var fetchPublicSurface = /* @__PURE__ */ __name(async (env, subdomain) => {
  const payload = await supabaseRpcRequest(env, "appstore_review_webhook_public_surface", {
    p_subdomain: subdomain
  });
  return payload && typeof payload === "object" ? payload : null;
}, "fetchPublicSurface");
var handleBridgeRequest = /* @__PURE__ */ __name(async (request, env, url) => {
  const subdomain = getPublicSubdomainFromHost(url.host, env.PUBLIC_ROOT_DOMAIN);
  if (!subdomain) {
    throw createHttpError(404, "Bridge host not found.");
  }
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request);
  }
  if (request.method !== "POST") {
    return withCors(json({ error: "Method not allowed." }, { status: 405 }), request);
  }
  try {
    let response;
    if (url.pathname === "/_bridge/appstore/apps") {
      response = await handleBridgeApps(request, env, subdomain);
    } else if (url.pathname === "/_bridge/appstore/sync") {
      response = await handleBridgeSync(request, env, subdomain);
    } else if (url.pathname === "/_bridge/appstore/ping") {
      response = await handleBridgePing(request, env, subdomain);
    } else {
      response = json({ error: "Not found." }, { status: 404 });
    }
    return withCors(response, request);
  } catch (error) {
    return withCors(
      json(
        {
          error: String(error?.message || error || "Bridge request failed.").slice(0, 1e3)
        },
        { status: Number(error?.status || 500) || 500 }
      ),
      request
    );
  }
}, "handleBridgeRequest");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/_bridge/")) {
      return handleBridgeRequest(request, env, url);
    }
    if (url.pathname === "/appstore-review") {
      const targetBase = envValue(env, "INTERNAL_WEBHOOK_BASE_URL");
      if (!targetBase) {
        return publicTextResponse("Server error.", { status: 500 });
      }
      const targetUrl = mergeQueryStrings(targetBase, request.url);
      const headers = new Headers(request.headers);
      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
      headers.set("x-original-host", url.host);
      return fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual"
      });
    }
    const publicSubdomain = getPublicSubdomainFromHost(url.host, env.PUBLIC_ROOT_DOMAIN);
    if (!publicSubdomain) {
      return publicTextResponse("Not found.", { status: 404 });
    }
    let surface = null;
    try {
      surface = await fetchPublicSurface(env, publicSubdomain);
    } catch (error) {
      return publicTextResponse("Server error.", { status: 502 });
    }
    if (!surface) {
      return publicTextResponse("Not found.", { status: 404 });
    }
    if (!String(surface.public_page_published_at || "").trim()) {
      return publicTextResponse("Not found.", { status: 404 });
    }
    if (url.pathname === "/" || url.pathname === "") {
      return withPublicHeaders(
        html(renderLandingPage(surface, url), {
          headers: {
            "cache-control": "public, max-age=120"
          }
        })
      );
    }
    if (url.pathname === "/privacy") {
      return surface.privacy_policy_url ? redirectTo(surface.privacy_policy_url) : publicTextResponse("Not found.", { status: 404 });
    }
    if (url.pathname === "/terms") {
      return surface.terms_of_use_url ? redirectTo(surface.terms_of_use_url) : publicTextResponse("Not found.", { status: 404 });
    }
    if (url.pathname === "/support") {
      return surface.support_form_url ? redirectTo(surface.support_form_url) : publicTextResponse("Not found.", { status: 404 });
    }
    if (url.pathname === "/icon" || url.pathname === "/icon.png") {
      return streamGeneratedIcon(env, surface.icon_image_path);
    }
    return publicTextResponse("Not found.", { status: 404 });
  }
};
export {
  buildEffectivePublicWebhookUrl,
  buildPublicSecurityHeaders,
  worker_default as default,
  publicTextResponse,
  redirectTo,
  validateExplicitPublicWebhookUrl,
  withPublicHeaders
};
//# sourceMappingURL=worker.js.map
