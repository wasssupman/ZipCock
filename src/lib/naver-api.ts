import type {
  NaverArticleListResponse,
  NaverRegionListResponse,
  PropertyTypeCode,
  TradeTypeCode,
} from "./types";

const BASE_URL = "https://new.land.naver.com/api";

const HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://new.land.naver.com/complexes",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    if (res.status === 429 && i < retries - 1) {
      const delay = (i + 1) * 5000;
      console.log(`[NaverAPI] Rate limited, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Naver API error: ${res.status}`);
  }
  throw new Error("Naver API: max retries exceeded");
}

export async function fetchRegions(
  cortarNo: string = "0000000000"
): Promise<NaverRegionListResponse> {
  const url = `${BASE_URL}/cortars?cortarNo=${cortarNo}`;
  const res = await fetchWithRetry(url);
  return res.json();
}

export async function fetchArticles(
  cortarNo: string,
  tradeType: TradeTypeCode,
  propertyType: PropertyTypeCode,
  page: number = 1
): Promise<NaverArticleListResponse> {
  const params = new URLSearchParams({
    cortarNo,
    order: "prcDesc",
    realEstateType: propertyType,
    tradeType,
    page: String(page),
  });
  const url = `${BASE_URL}/articles/complex?${params}`;
  const res = await fetchWithRetry(url);
  return res.json();
}
