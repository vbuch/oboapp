import { zIndex } from "@/lib/colors";

interface InterestContextMenuProps {
  readonly position: { x: number; y: number };
  readonly onMove: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

export default function InterestContextMenu({
  position,
  onMove,
  onDelete,
  onClose,
}: InterestContextMenuProps) {
  return (
    <>
      {/* Backdrop to close menu */}
      <button
        type="button"
        className={`fixed inset-0 ${zIndex.overlay} bg-black/20 backdrop-blur-sm pointer-events-auto cursor-default`}
        onClick={onClose}
        aria-label="Затвори менюто"
      />
      {/* Menu */}
      <div
        className={`fixed ${zIndex.overlayContent} bg-white rounded-lg shadow-xl border border-neutral-border py-1 min-w-[150px]`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <button
          type="button"
          onClick={onMove}
          className="w-full px-4 py-2 text-sm text-left text-neutral hover:bg-neutral-light flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
          </svg>
          Премести
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-full px-4 py-2 text-sm text-left text-error hover:bg-error-light flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Изтрий
        </button>
      </div>
    </>
  );
}
