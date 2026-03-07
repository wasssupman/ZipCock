# Muzeri

네이버 부동산 매물 모니터링 서비스. 관심 지역의 매물 변동을 자동으로 추적하고 알림을 보냅니다.

## 주요 기능

- **자동 크롤링** — Playwright 기반 네이버 부동산 매물 수집 (주기 설정 가능)
- **실시간 대시보드** — 지역별 매물 현황, 신규/사라진 매물 추적
- **지역 관리** — 네이버 부동산 지역 검색 및 모니터링 지역 등록
- **알림** — Discord, Telegram 웹훅을 통한 신규 매물 알림

## 기술 스택

- **Frontend** — Next.js 16, React 19, Tailwind CSS 4
- **Backend** — Next.js API Routes, Prisma ORM
- **DB** — SQLite (better-sqlite3)
- **크롤러** — Playwright

## 시작하기

```bash
# 의존성 설치
npm install

# Playwright 브라우저 설치
npx playwright install chromium

# DB 초기화
npx prisma db push

# 개발 서버
npm run dev
```

`http://localhost:3000`에서 대시보드에 접속할 수 있습니다.

## 환경 변수

`.env` 파일을 프로젝트 루트에 생성합니다.

```env
DATABASE_URL="file:./dev.db"
CRAWL_INTERVAL_MINUTES=60
DISCORD_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## 크롤링

```bash
# 수동 1회 크롤링
npm run crawl:once

# 스케줄러 실행 (cron 기반)
npm run crawler
```

대시보드에서 크롤링 버튼으로도 실행할 수 있습니다.

## 프로젝트 구조

```
src/
├── app/                # Next.js 페이지 & API
│   ├── api/            # REST API (regions, listings, crawl, alerts)
│   ├── alerts/         # 알림 설정 페이지
│   ├── listings/       # 매물 목록 페이지
│   ├── regions/        # 지역 관리 페이지
│   └── page.tsx        # 대시보드
├── crawler/            # 크롤링 엔진
├── components/         # UI 컴포넌트
└── lib/                # 유틸리티 (prisma, format, types)
prisma/
└── schema.prisma       # DB 스키마
```
