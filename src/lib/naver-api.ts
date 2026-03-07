import type {
  NaverArticleListResponse,
  NaverRegionListResponse,
  PropertyTypeCode,
  TradeTypeCode,
} from "./types";

const BASE_URL = "https://new.land.naver.com/api";

const HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://new.land.naver.com/",
};

export async function fetchRegions(
  cortarNo: string = "0000000000"
): Promise<NaverRegionListResponse> {
  const url = `${BASE_URL}/cortars?cortarNo=${cortarNo}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch regions: ${res.status}`);
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
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch articles: ${res.status}`);
  return res.json();
}
