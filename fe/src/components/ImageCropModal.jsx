import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import "./ImageCropModal.css";

async function createImage(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise((r, rej) => {
    img.onload = () => r();
    img.onerror = () => rej(new Error("Không load được ảnh"));
  });
  return img;
}

async function cropToBlob(imageSrc, area) {
  const img = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height
  );
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

export default function ImageCropModal({ open, file, title = "Cắt ảnh", aspect = 1, onClose, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);

  if (!open || !file) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal--crop">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="cropper">
          <Cropper
            image={objectUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="modal__footer">
          <div className="crop-modal__zoom">
            <div className="crop-modal__zoomLabel muted">Zoom</div>
            <input
              className="crop-modal__zoomRange"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>
          <div className="crop-modal__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                const blob = await cropToBlob(objectUrl, croppedAreaPixels);
                onDone(blob);
              }}
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
