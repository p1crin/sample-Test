import { ReactNode, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  isUnclosable?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  showCloseButton = false,
  isUnclosable = false,
}: ModalProps) {
  // isUnclosableがtrueの場合はonCloseを無効化する
  const handleClose = () => {
    if (!isUnclosable) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, isUnclosable]); // 依存配列にisUnclosableを追加

  if (!open) return null;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-500/10 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded shadow p-6 relative">
        {showCloseButton && !isUnclosable && (
          <button
            className="absolute top-0 right-1 text-gray-600 hover:text-gray-800 text-3xl"
            onClick={handleClose}
          >
            &times;
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
