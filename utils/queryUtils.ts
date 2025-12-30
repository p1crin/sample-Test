// 検索パラメータを含むクエリ文字列を構築（API用、limitを含む）
export const buildQueryString = (params: Record<string, string | string[]>, pageNum: number = 1, pageSize: number = 10): string => {
  const queryParams = new URLSearchParams();
  queryParams.append('page', String(pageNum));
  queryParams.append('limit', String(pageSize));

  // 空でない検索パラメータのみ追加
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      queryParams.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach(val => {
        if (val.trim()) {
          queryParams.append(key, val);
        }
      });
    }
  });

  return queryParams.toString();
};

// URLパラメータを更新する関数（limitは含めない）
export const updateUrlParams = (router: any, newSearchParams: Record<string, string | string[]>, path: string, pageNum: number = 1): void => {
  const queryParams = new URLSearchParams();
  queryParams.append('page', String(pageNum));

  // 空でない検索パラメータのみ追加
  Object.entries(newSearchParams).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      queryParams.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach(val => {
        if (val.trim()) {
          queryParams.append(key, val);
        }
      });
    }
  });

  const queryString = queryParams.toString();
  router.push(`${path}?${queryString}`);
};