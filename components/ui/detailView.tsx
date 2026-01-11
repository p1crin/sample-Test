import { Modal } from '@/components/ui/modal';
import { cn } from '@/utils/utils';
import * as React from 'react';
import { useState } from 'react';

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

  const handleImageClick = (imageSrc: string) => {
    setModalImage(imageSrc);
    setModalOpen(true);
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
                      <img
                        key={index}
                        src={src}
                        alt={`${labels[key].name} ${index + 1}`}
                        width={500}
                        height={300}
                        style={{ cursor: 'pointer', border: '1px solid black', margin: '5px' }}
                        onClick={() => handleImageClick(src)}
                      />
                    ))
                  ) : (
                    <img
                      src={values[key] as string}
                      alt={labels[key].name}
                      width={500}
                      height={300}
                      style={{ cursor: 'pointer', border: '1px solid black', margin: '5px' }}
                      onClick={() => handleImageClick(values[key] as string)}
                    />
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