# ZipCock v1.1 — AI 매물 분석 기능

> 신규 등록 매물에 대해 Claude CLI를 활용한 자동 분석. 시세 대비 가격 레벨 + 인프라 레벨을 3단계로 판단하여 태그.

---

## 기능 요약

크롤링으로 신규 매물이 DB에 insert될 때, Claude CLI를 호출하여 두 가지 축으로 분석:

| 축 | 판단 기준 | 레벨 |
|---|----------|------|
| **가격 레벨** (`priceLevel`) | 같은 지역/유형/면적대 기존 매물 대비 가격 위치 | `low` / `mid` / `high` |
| **인프라 레벨** (`infraLevel`) | 건물명+지역 기반 주변 인프라(교통, 학군, 편의시설) 판단 | `poor` / `fair` / `good` |

레벨 의미:
- 가격: `low` = 시세보다 저렴 (좋음), `mid` = 시세 수준, `high` = 시세보다 비쌈 (나쁨)
- 인프라: `poor` = 인프라 부족 (나쁨), `fair` = 보통, `good` = 인프라 우수 (좋음)

---

## Schema 변경

```prisma
model Listing {
  // ... 기존 필드 ...

  // v1.1: AI 분석 결과
  priceLevel      String?   // "low" | "mid" | "high"
  infraLevel      String?   // "poor" | "fair" | "good"
  aiAnalysis      String?   // Claude 원문 응답 (근거 텍스트)
  analyzedAt      DateTime? // 분석 완료 시각
}
```

migration: `npx prisma db push` (SQLite이므로 nullable 추가는 무손실)

---

## 구현 계획

### 1. 새 파일: `src/crawler/analyze.ts`

Claude CLI를 child process로 호출하여 매물을 분석하는 모듈.

```
analyzeNewListings(listingIds: number[])
  → DB에서 신규 매물 조회
  → 같은 지역의 기존 매물 시세 통계 조회 (비교 컨텍스트)
  → Claude CLI 호출 (배치)
  → 응답 파싱 → DB에 priceLevel, infraLevel, aiAnalysis 저장
```

#### Claude CLI 호출 방식

```typescript
import { execFile } from "child_process";

function callClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("claude", ["-p", prompt, "--output-format", "json"],
      { timeout: 30000 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      }
    );
  });
}
```

#### 프롬프트 설계

매물 배치 (최대 10개 단위)를 한 번의 Claude 호출로 분석:

```
다음은 {지역명} 지역의 신규 부동산 매물 목록이다.
같은 지역 기존 매물 시세 통계도 함께 제공한다.

## 기존 시세 통계 ({지역명}, {매물유형}, {거래유형})
- 매물 수: {count}건
- 평균가: {avg}만원
- 최저가: {min}만원
- 최고가: {max}만원
- 중위가: {median}만원

## 분석 대상 신규 매물
1. [ID:{id}] {buildingName} | {propertyType} {tradeType} | {price}만원 | {area}m² | {floor}층

각 매물에 대해 다음 JSON 배열로 응답하라:
[
  {
    "id": 매물ID,
    "priceLevel": "low" | "mid" | "high",
    "infraLevel": "poor" | "fair" | "good",
    "reason": "판단 근거 1~2문장"
  }
]

판단 기준:
- priceLevel: 시세 통계 대비 가격 위치. 중위가 대비 10% 이상 저렴하면 low, 10% 이상 비싸면 high, 그 사이 mid.
- infraLevel: 건물명과 지역으로 추론. 역세권/학군/대단지/신축 등 인프라 요소 종합 판단.
  poor=인프라 부족, fair=보통, good=인프라 우수.

JSON만 출력하라.
```

#### 시세 컨텍스트 조회

```typescript
// 같은 지역 + 같은 매물유형 + 같은 거래유형의 활성 매물 통계
const stats = await prisma.listing.aggregate({
  where: { regionId, propertyType, tradeType, isActive: true },
  _count: true,
  _avg: { price: true },
  _min: { price: true },
  _max: { price: true },
});

// 중위가는 별도 쿼리
const median = await prisma.listing.findMany({
  where: { regionId, propertyType, tradeType, isActive: true },
  orderBy: { price: "asc" },
  select: { price: true },
});
```

### 2. 크롤 파이프라인 연동 (`src/crawler/crawl.ts`)

`crawlRegion()` 에서 신규 매물 ID를 수집하고, 지역 크롤 완료 후 분석 호출:

```
crawlRegion()
  → ... 기존 로직 ...
  → newListingIds[] 수집 (create 시 push)
  → if (newListingIds.length > 0) await analyzeNewListings(newListingIds)
```

### 3. SSE 이벤트 추가 (`src/lib/crawl-events.ts`)

```typescript
// 기존 CrawlEvent union에 추가
| { type: "crawl:analyze"; regionName: string; count: number }
| { type: "crawl:analyze_done"; regionName: string; analyzed: number }
```

### 4. UI 태그 표시

#### 대시보드 (`src/app/page.tsx`) — 신규 매물 아이템

매물 정보 옆에 두 개의 레벨 뱃지 추가:

```
┌─────────────────────────────────────────────────┐
│ 래미안아파트                      3억 2,000만원  │
│ 아파트 / 매매 / 84m² / 12층       2시간 전      │
│ [저렴] [인프라 우수]                             │
└─────────────────────────────────────────────────┘
```

뱃지 스타일:

| 값 | 가격 뱃지 | 인프라 뱃지 |
|----|----------|------------|
| 좋음 | `low` → 초록 "저렴" | `good` → 초록 "인프라 우수" |
| 보통 | `mid` → 회색 "시세 적정" | `fair` → 회색 "인프라 보통" |
| 나쁨 | `high` → 빨강 "고가" | `poor` → 빨강 "인프라 부족" |

#### 매물 목록 (`src/app/listings/page.tsx`)

- 유형 뱃지 옆에 가격/인프라 뱃지 추가
- 분석 미완료 매물은 뱃지 미표시

#### 알림 메시지 (`src/crawler/alerts.ts`)

알림 텍스트에 레벨 태그 포함:

```
[신규 매물] 래미안아파트
유형: 아파트 / 매매
가격: 3억 2,000만원 💰저렴
인프라: 🏙️우수
면적: 84m² | 층: 12층
https://fin.land.naver.com/complexes/...
```

### 5. 분석 근거 표시 (선택적)

매물 아이템에 hover 또는 expand 시 `aiAnalysis` 텍스트 (reason) 표시:

```
"시세 중위가 3.5억 대비 3.2억으로 약 8.5% 저렴.
 래미안 대단지로 지하철 도보 5분, 학군 우수."
```

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | Listing 모델에 `priceLevel`, `infraLevel`, `aiAnalysis`, `analyzedAt` 추가 |
| `src/crawler/analyze.ts` | **신규** — Claude CLI 호출, 프롬프트 생성, 응답 파싱, DB 업데이트 |
| `src/crawler/crawl.ts` | 신규 매물 ID 수집, `analyzeNewListings()` 호출 추가 |
| `src/lib/crawl-events.ts` | `crawl:analyze`, `crawl:analyze_done` 이벤트 타입 추가 |
| `src/lib/types.ts` | `PRICE_LEVELS`, `INFRA_LEVELS` 상수 추가 |
| `src/app/page.tsx` | 신규 매물 아이템에 레벨 뱃지 렌더링 |
| `src/app/listings/page.tsx` | 매물 행에 레벨 뱃지 렌더링 |
| `src/crawler/alerts.ts` | 알림 메시지에 레벨 태그 포함 |
| `src/components/level-badge.tsx` | **신규** — 재사용 가능한 레벨 뱃지 컴포넌트 |

---

## 고려사항

- **Claude CLI 의존성**: `claude` 명령이 PATH에 있어야 함. 없으면 분석 skip (매물 등록은 정상 진행)
- **비용/속도**: 10개 매물 배치 → 1회 CLI 호출. 지역당 신규 매물이 많으면 여러 배치로 분할
- **분석 실패 처리**: CLI 타임아웃(30s) 또는 JSON 파싱 실패 시 해당 매물의 레벨 필드는 null 유지
- **기존 매물**: v1.1 배포 후 이미 DB에 있는 매물은 분석하지 않음 (신규만 대상). 필요시 수동 재분석 API 추가 가능
- **인프라 판단 한계**: Claude의 학습 데이터 기반 추론이므로 실시간 인프라 변화는 반영 불가. 건물명+지역명으로 알려진 정보에 의존
맴ㄴ