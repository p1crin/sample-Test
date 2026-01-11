/**
 * ファイル処理のユーティリティ関数
 */

/**
 * ファイル情報を保持する型
 */
export interface FileInfo {
  /** ファイル名 */
  name: string;
  /** ユニークID */
  id: string;
  /** Base64エンコードされた画像データ (オプション) */
  base64?: string;
  /** ファイルのMIMEタイプ (オプション) */
  type?: string;
  /** ファイルパス */
  path?: string;
}

/**
 * ユニークIDを生成する関数
 * @returns {string} ランダムなユニークID
 */
export const generateUniqueId = (): string => {
  return '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * ファイルをBase64形式に変換する関数
 * @param {File} file - 変換するファイル
 * @returns {Promise<string>} Base64エンコードされた文字列
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); // base64データのみを取得
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * ファイル名の重複を避けて、ユニークなファイル名を生成する関数
 * @param {FileInfo[]} fileList - ファイル情報の配列
 * @returns {FileInfo[]} ユニークなファイル名を持つファイル情報の配列
 */
export const getUniqueFileNames = (fileList: FileInfo[]): FileInfo[] => {
  const nameCount: { [key: string]: number } = {};

  return fileList.map(file => {
    const baseName = file.name.replace(/(\(\d+\))?(\.[^.]+)?$/, '');
    const extension = file.name.match(/(\.[^.]+)$/)?.[0] || '';
    const fullName = `${baseName}${extension}`;

    if (nameCount[fullName] === undefined) {
      nameCount[fullName] = 0;
    } else {
      nameCount[fullName]++;
    }

    return nameCount[fullName] === 0
      ? file
      : { ...file, name: `${baseName}(${nameCount[fullName]})${extension}` };
  });
};

/**
 * FileListからFileInfo配列を生成する関数
 * @param {FileList} fileList - ブラウザのFileListオブジェクト
 * @returns {Promise<FileInfo[]>} ファイル情報の配列
 */
export const processFileList = async (fileList: FileList): Promise<FileInfo[]> => {
  return Promise.all(
    Array.from(fileList).map(async (file) => {
      const base64 = await fileToBase64(file);
      return { name: file.name, id: generateUniqueId(), base64, type: file.type };
    })
  );
};

/**
 * クリップボードのアイテムからファイル情報を生成する関数
 * @param {DataTransferItemList} items - クリップボードのアイテムリスト
 * @returns {Promise<FileInfo[]>} ファイル情報の配列
 */
export const processClipboardItems = async (items: DataTransferItemList): Promise<FileInfo[]> => {
  const files = await Promise.all(
    Array.from(items).map(async (item) => {
      const file = item.getAsFile();
      if (file) {
        const base64 = await fileToBase64(file);
        return { name: file.name, id: generateUniqueId(), base64, type: file.type };
      }
      return null;
    })
  );

  return files.filter(Boolean) as FileInfo[];
};