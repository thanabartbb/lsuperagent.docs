// src/errors.ts
var LsupergenError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "LsupergenError";
  }
};
var APIError = class extends LsupergenError {
  status;
  body;
  headers;
  constructor(status, body, headers, message) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "APIError";
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
};
var TimeoutError = class extends LsupergenError {
  constructor(timeoutMs) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
};
var ConnectionError = class extends LsupergenError {
  constructor(options) {
    super("Connection error", options);
    this.name = "ConnectionError";
  }
};

// src/version.ts
var VERSION = "0.1.0";

// src/client.ts
var DEFAULT_BASE_URL = "https://api.lsupergen.com";
var DEFAULT_TIMEOUT = 6e4;
var DEFAULT_MAX_RETRIES = 2;
function readEnv(name) {
  return typeof process !== "undefined" ? process.env?.[name] : void 0;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function shouldRetry(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}
var Lsupergen = class {
  apiKey;
  baseURL;
  timeout;
  maxRetries;
  defaultHeaders;
  fetchImpl;
  constructor(options = {}) {
    const apiKey = options.apiKey ?? readEnv("LSUPERGEN_API_KEY");
    if (!apiKey) {
      throw new LsupergenError(
        "Missing API key. Pass `apiKey` to the client or set the LSUPERGEN_API_KEY environment variable."
      );
    }
    this.apiKey = apiKey;
    this.baseURL = (options.baseURL ?? readEnv("LSUPERGEN_BASE_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      ""
    );
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new LsupergenError("No `fetch` implementation found. Use Node.js 18+ or pass `fetch`.");
    }
  }
  get(path, options) {
    return this.request("GET", path, options);
  }
  post(path, options) {
    return this.request("POST", path, options);
  }
  put(path, options) {
    return this.request("PUT", path, options);
  }
  patch(path, options) {
    return this.request("PATCH", path, options);
  }
  delete(path, options) {
    return this.request("DELETE", path, options);
  }
  async request(method, path, options = {}) {
    const url = this.buildURL(path, options.query);
    const timeout = options.timeout ?? this.timeout;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": `lsupergen-sdk/${VERSION}`,
      ...this.defaultHeaders,
      ...options.headers
    };
    let body;
    if (options.body !== void 0) {
      headers["Content-Type"] ??= "application/json";
      body = JSON.stringify(options.body);
    }
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const onAbort = () => controller.abort();
      options.signal?.addEventListener("abort", onAbort);
      let response;
      try {
        response = await this.fetchImpl(url, { method, headers, body, signal: controller.signal });
      } catch (err) {
        if (options.signal?.aborted) throw err;
        const error = controller.signal.aborted ? new TimeoutError(timeout) : new ConnectionError({ cause: err });
        if (attempt < maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
      }
      if (response.ok) {
        return await this.parseBody(response);
      }
      if (attempt < maxRetries && shouldRetry(response.status)) {
        await sleep(this.backoff(attempt, response.headers.get("retry-after")));
        continue;
      }
      const errorBody = await this.parseBody(response).catch(() => void 0);
      const message = errorBody && typeof errorBody === "object" && "message" in errorBody ? String(errorBody.message) : void 0;
      throw new APIError(response.status, errorBody, response.headers, message);
    }
  }
  buildURL(path, query) {
    const url = new URL(`${this.baseURL}/${path.replace(/^\/+/, "")}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== void 0 && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
  async parseBody(response) {
    if (response.status === 204) return void 0;
    const text = await response.text();
    if (!text) return void 0;
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("application/json") ? JSON.parse(text) : text;
  }
  backoff(attempt, retryAfter) {
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 60) return seconds * 1e3;
    const base = Math.min(500 * 2 ** attempt, 8e3);
    return base * (0.75 + Math.random() * 0.25);
  }
};
export {
  APIError,
  ConnectionError,
  Lsupergen,
  LsupergenError,
  TimeoutError,
  VERSION
};
//# sourceMappingURL=index.js.map