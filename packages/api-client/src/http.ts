export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
};

async function makeHeaders(options: ApiClientOptions, initHeaders?: HeadersInit, json = false) {
  const headers = new Headers(initHeaders);
  if (json && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = options.getAccessToken ? await options.getAccessToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
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
  try {
    response = await fetch(`${options.baseUrl}${path}`, { ...init, headers: await makeHeaders(options, init.headers, true) });
  } catch (cause) {
    const error = new Error('Could not connect to Hellowhen API.');
    Object.assign(error, { code: 'HELLOWHEN_API_CONNECTION_ERROR', baseUrl: options.baseUrl, cause });
    throw error;
  }
  if (!response.ok) await parseErrorResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function requestFormData<T>(options: ApiClientOptions, path: string, formData: FormData, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${options.baseUrl}${path}`, { ...init, method: init.method ?? 'POST', body: formData, headers: await makeHeaders(options, init.headers, false) });
  } catch (cause) {
    const error = new Error('Could not connect to Hellowhen API.');
    Object.assign(error, { code: 'HELLOWHEN_API_CONNECTION_ERROR', baseUrl: options.baseUrl, cause });
    throw error;
  }
  if (!response.ok) await parseErrorResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
