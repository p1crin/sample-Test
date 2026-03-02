/**
 * APIクライアント
 * 401エラー時に認証エラー画面へリダイレクトする
 */

export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  // 401 Unauthorized の場合は認証エラー画面へリダイレクト
  if (response.status === 401) {
    window.location.href = '/auth-error';
    throw new Error('Unauthorized: Session expired');
  }

  return response;
}

/**
 * GET リクエスト
 */
export async function apiGet<T = unknown>(url: string): Promise<T> {
  const response = await apiFetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * POST リクエスト
 */
export async function apiPost<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * PUT リクエスト
 */
export async function apiPut<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  const response = await apiFetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`PUT ${url} failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * DELETE リクエスト
 */
export async function apiDelete<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  const response = await apiFetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`DELETE ${url} failed with status ${response.status}`);
  }

  return response.json();
}