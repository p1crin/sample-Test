import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const existsSync = fs.existsSync;

/**
 * 指定されたディレクトリにファイルをアップロードする
 * @param uploadDir アップロードディレクトリ
 * @param files アップロードするファイルの配列
 */
export async function uploadFiles(uploadDir: string, files: { name: string, base64: string, type: string }[]) {

  // ディレクトリが存在しない場合は作成
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  // ファイル保存
  for (let i = 0; i < files.length; i++) {
    const fileInfo = files[i];
    if (fileInfo.base64) {
      const fileName = `${fileInfo.type}_${Date.now()}_${i}_${fileInfo.name}`;
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(fileInfo.base64, 'base64');
      await writeFile(filePath, buffer);
    }
  }
}