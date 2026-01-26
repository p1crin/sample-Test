import AdmZip from 'adm-zip';
import { ZipFileEntry } from '../types/test-case-import.types';

/**
 * ZIPファイルを解凍してCSVとファイルを取得
 */
export function extractZip(zipBuffer: Buffer): {
  csvContent: string | null;
  files: Map<string, ZipFileEntry>;
} {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  let csvContent: string | null = null;
  const files = new Map<string, ZipFileEntry>();

  for (const entry of entries) {
    // ディレクトリはスキップ
    if (entry.isDirectory) {
      continue;
    }

    const fileName = entry.entryName;
    const buffer = entry.getData();

    // CSVファイルを検出（.csv拡張子）
    if (fileName.toLowerCase().endsWith('.csv')) {
      if (csvContent !== null) {
        throw new Error('ZIPファイル内にCSVファイルが複数含まれています。CSVファイルは1つだけにしてください。');
      }
      csvContent = buffer.toString('utf-8');
      continue;
    }

    // その他のファイルを保存
    // パスの正規化（先頭の./ を削除）
    const normalizedPath = fileName.startsWith('./') ? fileName.substring(2) : fileName;

    files.set(normalizedPath, {
      path: normalizedPath,
      buffer,
      originalName: fileName,
    });
  }

  if (csvContent === null) {
    throw new Error('ZIPファイル内にCSVファイルが見つかりません。');
  }

  return { csvContent, files };
}

/**
 * ファイルパスを正規化（./を削除）
 */
export function normalizeFilePath(path: string): string {
  return path.startsWith('./') ? path.substring(2) : path;
}

/**
 * 指定されたファイルがZIP内に存在するか確認
 */
export function validateFileExists(
  filePath: string,
  files: Map<string, ZipFileEntry>,
  rowNumber?: number
): { valid: boolean; error?: string } {
  const normalizedPath = normalizeFilePath(filePath);

  if (!files.has(normalizedPath)) {
    const error = rowNumber
      ? `${rowNumber}行目: ファイル "${filePath}" がZIP内に見つかりません`
      : `ファイル "${filePath}" がZIP内に見つかりません`;
    return { valid: false, error };
  }

  return { valid: true };
}

/**
 * CSV内で参照されている全ファイルの存在確認
 */
export function validateAllFilesExist(
  filePaths: string[],
  files: Map<string, ZipFileEntry>,
  rowNumber?: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const filePath of filePaths) {
    const result = validateFileExists(filePath, files, rowNumber);
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
