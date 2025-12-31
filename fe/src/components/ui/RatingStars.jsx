import { Star } from "lucide-react";
import "./RatingStars.css";

export default function RatingStars({ value = 0, size = 14 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const full = Math.floor(v);
  const half = v - full >= 0.5;

  return (
    <span className="rating-stars" aria-label={`Rating ${v} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= full;
        const isHalf = !filled && idx === full + 1 && half;

        return (
          <span key={i} className="rating-stars__item">
            <Star
              width={size}
              height={size}
              className="rating-stars__star rating-stars__star--empty"
            />
            {(filled || isHalf) && (
              <span
                className="rating-stars__fill"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Star
                  width={size}
                  height={size}
                  className="rating-stars__star rating-stars__star--fill"
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
