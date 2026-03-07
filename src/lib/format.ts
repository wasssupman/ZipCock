/** Format price in 만원 / 억 notation */
export function formatPrice(price: number): string {
  if (price >= 10000) {
    const eok = Math.floor(price / 10000);
    const man = price % 10000;
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억`;
  }
  return `${price.toLocaleString()}만원`;
}

/** Format date to Korean-friendly string */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** Direction code to Korean label */
const DIRECTION_MAP: Record<string, string> = {
  S: "남",
  N: "북",
  E: "동",
  W: "서",
  SE: "남동",
  SW: "남서",
  NE: "북동",
  NW: "북서",
  SS: "남남",
  EW: "동서",
  NS: "남북",
};

export function formatDirection(code: string | null): string | null {
  if (!code) return null;
  return DIRECTION_MAP[code] || code;
}

/** Region type code to Korean label */
export function cortarTypeLabel(type: string): string {
  switch (type) {
    case "sido":
    case "si":
      return "시/도";
    case "sigungu":
    case "gun":
      return "시/군/구";
    case "dong":
    case "eup":
      return "읍/면/동";
    default:
      return type;
  }
}
