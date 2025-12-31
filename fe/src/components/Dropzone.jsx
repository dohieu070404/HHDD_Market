import { useRef, useState } from "react";

export default function Dropzone({ accept, label, hint, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function pick() {
    inputRef.current?.click();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`dz ${dragging ? "dz--drag" : ""}`}
      onClick={pick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
    >
      <button type="button" className="link-strong">
        {label}
      </button>
      <div className="hint">{hint || "(Kéo thả hoặc bấm để chọn)"}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </div>
  );
}
