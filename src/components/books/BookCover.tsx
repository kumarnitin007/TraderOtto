"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { bookInitials } from "@/lib/books";
import { openLibraryCoverUrl } from "@/lib/openLibrary";

export function BookCover({
  title,
  color,
  size = "md",
  coverId = null,
  externalCovers = true,
}: {
  title: string;
  color: string;
  size?: "sm" | "md" | "lg";
  coverId?: number | null;
  externalCovers?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const dimensions =
    size === "lg" ? "h-[134px] w-[94px] text-[15px]" : size === "sm" ? "h-[68px] w-[50px] text-[13px]" : "h-[84px] w-[58px] text-[13px]";
  const coverUrl = externalCovers && !failed ? openLibraryCoverUrl(coverId, size === "sm" ? "S" : "M") : null;

  useEffect(() => {
    setFailed(false);
  }, [coverId, externalCovers]);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] font-extrabold text-white shadow-sm ${dimensions}`}
      style={{ backgroundColor: color }}
      aria-label={`${title} cover`}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={`${title} cover`}
          fill
          sizes={size === "lg" ? "94px" : size === "sm" ? "50px" : "58px"}
          className="object-cover"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        bookInitials(title)
      )}
    </div>
  );
}

export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) =>
        onChange ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-[20px] ${star <= value ? "text-otto-amber" : "text-otto-text-faint"}`}
            aria-label={`${star} stars`}
          >
            ★
          </button>
        ) : (
          <span
            key={star}
            className={`text-[17px] ${star <= Math.round(value) ? "text-otto-amber" : "text-otto-text-faint"}`}
          >
            {star <= Math.round(value) ? "★" : "☆"}
          </span>
        )
      )}
    </span>
  );
}
