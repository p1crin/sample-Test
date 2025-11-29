/**
 * 日付フォーマット変換ユーティリティ
 * ISO 8601形式や Date オブジェクトを日本時間で指定フォーマットに変換
 */

/**
 * ISO 8601文字列をDate オブジェクトに変換
 * 例: "2025-11-29T19:14:00.000Z" → Date オブジェクト
 */
export function parseISO(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  try {
    return new Date(isoString);
  } catch {
    return null;
  }
}

/**
 * Date オブジェクトを日本時間（JST）の指定フォーマットに変換
 * デフォルトフォーマット: "YYYY/MM/DD HH:mm:ss"
 *
 * 例:
 * - formatDate(new Date("2025-11-29T10:14:00Z")) → "2025/11/29 19:14:00"
 * - formatDate(new Date(), "YYYY-MM-DD") → "2025-11-29"
 * - formatDate(isoString) → ISO文字列を日本時間でフォーマット
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: string = 'YYYY/MM/DD HH:mm:ss'
): string {
  if (!date) return '';

  // 文字列の場合は Date オブジェクトに変換
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!dateObj) return '';

  // 日本時間（JST）に変換（UTC+9）
  const jstDate = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);

  // 年月日時分秒を取得
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');

  // フォーマット文字列に置き換え
  let result = format;
  result = result.replace('YYYY', String(year));
  result = result.replace('MM', month);
  result = result.replace('DD', day);
  result = result.replace('HH', hours);
  result = result.replace('mm', minutes);
  result = result.replace('ss', seconds);

  return result;
}

/**
 * 複数の日付フォーマット関数（便利版）
 */

/**
 * ISO文字列を "YYYY/MM/DD HH:mm:ss" 形式で返す
 */
export function formatDateTimeJST(dateString: string | null | undefined): string {
  return formatDate(dateString, 'YYYY/MM/DD HH:mm:ss');
}

/**
 * ISO文字列を "YYYY/MM/DD" 形式で返す
 */
export function formatDateJST(dateString: string | null | undefined): string {
  return formatDate(dateString, 'YYYY/MM/DD');
}

/**
 * ISO文字列を "YYYY-MM-DD HH:mm:ss" 形式で返す（ハイフン区切り）
 */
export function formatDateTimeWithHyphen(dateString: string | null | undefined): string {
  return formatDate(dateString, 'YYYY-MM-DD HH:mm:ss');
}

/**
 * ISO文字列を "HH:mm:ss" 形式で返す（時刻のみ）
 */
export function formatTimeJST(dateString: string | null | undefined): string {
  return formatDate(dateString, 'HH:mm:ss');
}
