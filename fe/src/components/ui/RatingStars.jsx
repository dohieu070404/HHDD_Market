import { Star } from "lucide-react";

export default function RatingStars({ value = 0, size = 14 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const full = Math.floor(v);
  const half = v - full >= 0.5;

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rating ${v} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= full;
        const isHalf = !filled && idx === full + 1 && half;

        return (
          <span key={i} className="relative inline-flex">
            <Star
              width={size}
              height={size}
              className="text-slate-300"
            />
            {(filled || isHalf) && (
              <span
                className="absolute left-0 top-0 overflow-hidden"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Star
                  width={size}
                  height={size}
                  className="text-amber-500"
                  fill="currentColor"
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
