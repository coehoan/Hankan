'use client';
import { useEffect } from 'react';

export function InventoryNotice({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="inventory-notice" role="status">
      <span>{message}</span>
      <button
        type="button"
        className="inventory-notice-close"
        aria-label="알림 닫기"
        onClick={onClose}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>
    </div>
  );
}
