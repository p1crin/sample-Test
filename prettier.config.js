// Prettier configuration file (JS形式)
// よく使うオプションや調整例はコメント参照

/** @type {import('prettier').Config} */
module.exports = {
  semi: true, // 文末にセミコロン
  singleQuote: true, // シングルクォート
  printWidth: 100, // 1行の最大長
  tabWidth: 2, // インデント幅
  trailingComma: 'es5', // 末尾カンマ
  bracketSpacing: true, // オブジェクトリテラルの波括弧内のスペース
  arrowParens: 'always', // アロー関数の引数に常に括弧
  endOfLine: 'lf', // 改行コード

  // --- 厳しくしたいとき ---
  // proseWrap: 'always', // マークダウンも常に折り返し

  // --- ゆるくしたいとき ---
  // semi: false, // セミコロンなし
  // singleQuote: false, // ダブルクォート
};
