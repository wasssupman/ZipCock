"use client";

import { useState } from "react";

export default function StarButton({
  listingId,
  initialStarred,
}: {
  listingId: number;
  initialStarred: boolean;
}) {
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setStarred(!starred);
    setLoading(true);

    try {
      const res = await fetch("/api/starred", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      setStarred(data.starred);
    } catch {
      setStarred(starred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="shrink-0 p-1.5 transition-transform hover:scale-110 disabled:opacity-50"
      title={starred ? "관심 매물 해제" : "관심 매물 등록"}
    >
      <svg
        className={`h-5 w-5 ${starred ? "fill-yellow-400 text-yellow-400" : "fill-none text-zinc-300 hover:text-yellow-400"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  );
}
