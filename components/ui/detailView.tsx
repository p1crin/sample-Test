import { Modal } from '@/components/ui/modal';
import clientLogger from '@/utils/client-logger';
import { isImage } from '@/utils/fileUtils';
import { cn } from '@/utils/utils';
import * as React from 'react';
import { useEffect, useState } from 'react';

interface Label {
  name: string;
  type: 'text' | 'img';
}

interface DetailViewProps {
  labels: { [key: string]: Label };
  values: { [key: string]: string | string[] };
  isFull?: boolean;
}

/**
 * DetailViewコンポーネント
 *
 * 各ラベルとその値を表示し、各列ごとに見やすい罫線を引きます。
 */
const DetailView: React.FC<DetailViewProps> = ({ labels, values, isFull = false }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // S3パスの場合に署名付きURLを取得
  useEffect(() => {
    const fetchImageUrls = async () => {
      const imagePaths: string[] = [];

      // labelsから画像タイプのフィールドを抽出
      Object.keys(labels).forEach((key) => {
        if (labels[key].type === 'img') {
          const value = values[key];
          if (Array.isArray(value)) {
            imagePaths.push(...value.filter(v => v && typeof v === 'string'));
          } else if (value && typeof value === 'string') {
            imagePaths.push(value);
          }
        }
      });

      const newImageUrls: Record<string, string> = {};

      for (const path of imagePaths) {
        // 既にURLを取得している場合はスキップ
        if (imageUrls[path]) continue;

        // ローカルパス（/で始まる）の場合はそのまま使用
        if (path.startsWith('/')) {
          newImageUrls[path] = path;
        } else {
          // S3パスの場合は署名付きURLを取得
          try {
            const response = await fetch('/api/files/url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ filePath: path }),
            });

            if (response.ok) {
              const data = await response.json();
              newImageUrls[path] = data.data.url;
            }
          } catch (err) {
            clientLogger.error('detailView', 'ファイルURLの取得失敗', { error: err instanceof Error ? err.message : String(err) });
          }
        }
      }

      if (Object.keys(newImageUrls).length > 0) {
        setImageUrls(prev => ({ ...prev, ...newImageUrls }));
      }
    };

    fetchImageUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, labels]);

  const handleImageClick = (imageSrc: string) => {
    setModalImage(imageSrc);
    setModalOpen(true);
  };

  // 画像のURLを取得（S3署名付きURLまたはローカルパス）
  const getImageUrl = (path: string): string => {
    return imageUrls[path] || path;
  };

  return (
    <div className={`relative ${isFull ? 'w-full' : 'w-2/3'} overflow-x-auto bg-white rounded shadow`}>
      <table className={cn('w-full caption-bottom text-sm border-collapse')}>
        <tbody>
          {Object.keys(labels).map((key) => (
            <tr key={key} className="border-b">
              <th className="text-foreground h-10 px-2 min-w-36 text-right align-middle font-medium whitespace-pre-wrap border-r bg-gray-100">
                {labels[key].name}
              </th>
              <td className="p-2 min-w-100 max-w-200 align-middle whitespace-pre-wrap overflow-hidden text-ellipsis">
                {labels[key].type === 'img' ? (
                  Array.isArray(values[key]) ? (
                    (values[key] as string[]).map((src, index) => (
                      <React.Fragment key={index}>
                        {isImage(src) ? (
                          <img
                            key={index}
                            src={getImageUrl(src)}
                            alt={`${labels[key].name} ${index + 1}`}
                            width={500}
                            height={300}
                            style={{ cursor: 'pointer', border: '1px solid black', margin: '5px' }}
                            onClick={() => handleImageClick(getImageUrl(src))}
                          />
                        ) : (
                          <React.Fragment key={index}>
                            <a key={index} href={getImageUrl(src)} download className="text-sm truncate text-blue-500">{src.split('/').pop()}</a>
                            <br />
                          </React.Fragment>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    isImage(values[key] as string) ? (
                      <img
                        src={getImageUrl(values[key] as string)}
                        alt={labels[key].name}
                        width={500}
                        height={300}
                        style={{ cursor: 'pointer', border: '1px solid black', margin: '5px' }}
                        onClick={() => handleImageClick(getImageUrl(values[key] as string))}
                      />
                    ) : (
                      <React.Fragment>
                        <a href={values[key] as string} download className="text-sm truncate text-blue-500">{(values[key] as string).split('/').pop()}</a>
                        <br />
                      </React.Fragment>
                    )
                  )
                ) : (
                  values[key] ? (
                    (values[key] as string).split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))
                  ) : (
                    <span></span>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} showCloseButton={true}>
        {modalImage && <img src={modalImage} alt="modal image" width={800} height={600} />}
      </Modal>
    </div>
  );
};

export default DetailView;