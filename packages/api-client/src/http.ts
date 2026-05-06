export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
};

export async function requestJson<T>(
  options: ApiClientOptions,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = options.getAccessToken ? await options.getAccessToken() : null;

  const response = await fetch(`${options.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // ignore malformed error body
    }
    const error = new Error(`API request failed: ${response.status}`);
    Object.assign(error, { status: response.status, body });
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
