export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const FORM_DATA_REQUEST_TIMEOUT_MS = 60000;

type TimedRequest = {
  init: RequestInit;
  cleanup: () => void;
  timedOut: () => boolean;
};

async function makeHeaders(options: ApiClientOptions, initHeaders?: HeadersInit, json = false) {
  const headers = new Headers(initHeaders);
  if (json && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = options.getAccessToken ? await options.getAccessToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

function createTimedRequest(init: RequestInit, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): TimedRequest {
  if (init.signal || typeof AbortController === 'undefined') {
    return { init, cleanup: () => undefined, timedOut: () => false };
  }

  let didTimeOut = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    didTimeOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    init: { ...init, signal: controller.signal },
    cleanup: () => clearTimeout(timeout),
    timedOut: () => didTimeOut,
  };
}

function throwConnectionError(cause: unknown, baseUrl: string, timedOut: boolean): never {
  const error = new Error(timedOut ? 'Hellowhen API request timed out.' : 'Could not connect to Hellowhen API.');
  Object.assign(error, {
    code: timedOut ? 'HELLOWHEN_API_TIMEOUT_ERROR' : 'HELLOWHEN_API_CONNECTION_ERROR',
    baseUrl,
    cause,
  });
  throw error;
}

async function parseErrorResponse(response: Response) {
  let body: unknown = null;
  try { body = await response.json(); } catch { /* ignore malformed error body */ }
  const error = new Error(`API request failed: ${response.status}`);
  Object.assign(error, { code: 'HELLOWHEN_API_ERROR', status: response.status, body });
  throw error;
}

export async function requestJson<T>(options: ApiClientOptions, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const request = createTimedRequest({ ...init, headers: await makeHeaders(options, init.headers, true) });
  try {
    response = await fetch(`${options.baseUrl}${path}`, request.init);
  } catch (cause) {
    throwConnectionError(cause, options.baseUrl, request.timedOut());
  } finally {
    request.cleanup();
  }
  if (!response.ok) await parseErrorResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}


export async function requestText(options: ApiClientOptions, path: string, init: RequestInit = {}): Promise<string> {
  let response: Response;
  const request = createTimedRequest({ ...init, headers: await makeHeaders(options, init.headers, false) });
  try {
    response = await fetch(`${options.baseUrl}${path}`, request.init);
  } catch (cause) {
    throwConnectionError(cause, options.baseUrl, request.timedOut());
  } finally {
    request.cleanup();
  }
  if (!response.ok) await parseErrorResponse(response);
  return response.text();
}

export async function requestFormData<T>(options: ApiClientOptions, path: string, formData: FormData, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const request = createTimedRequest({ ...init, method: init.method ?? 'POST', body: formData, headers: await makeHeaders(options, init.headers, false) }, FORM_DATA_REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${options.baseUrl}${path}`, request.init);
  } catch (cause) {
    throwConnectionError(cause, options.baseUrl, request.timedOut());
  } finally {
    request.cleanup();
  }
  if (!response.ok) await parseErrorResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
