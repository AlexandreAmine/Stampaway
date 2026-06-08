import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ProfilePicturePreviewProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfilePicturePreview({ src, alt, isOpen, onClose }: ProfilePicturePreviewProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-4 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Image container - prevents context menu and interaction */}
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="w-[70vw] h-[70vw] max-w-[320px] max-h-[320px] rounded-full object-cover select-none"
          style={{
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            pointerEvents: "none",
          }}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
