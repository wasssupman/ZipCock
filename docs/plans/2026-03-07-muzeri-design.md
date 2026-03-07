# Muzeri - 네이버 부동산 매물 모니터링 시스템

## 개요

네이버 부동산의 비공식 내부 API를 활용하여 매물 데이터를 주기적으로 수집하고, 신규 매물 등록 시 Discord/Telegram으로 알림을 보내는 웹 애플리케이션.

## 요구사항

- **대상 매물**: 아파트, 빌라, 투룸, 상가주택, 전원주택 (오피스텔/원룸 제외)
- **거래 유형**: 매매, 전세, 월세 전체
- **지역 설정**: 웹 UI에서 시/도 > 시/군/구 > 읍/면/동 선택
- **크롤링 주기**: 1~3시간 (node-cron)
- **알림 채널**: Discord Webhook, Telegram Bot API
- **배포**: 로컬/자체 서버 실행

## 아키텍처

```
[Next.js App] ── 웹 UI (React) + API Routes (매물 조회, 설정 관리)
      │
      ├── Prisma ORM ── SQLite (매물, 지역, 알림설정, 크롤링 로그)
      │
[Crawler Script] ── node-cron 주기 실행
      │
      ├── 네이버 부동산 내부 API 호출 (land.naver.com)
      ├── 신규/변경 매물 감지 → DB 저장
      └── 알림 조건 매칭 → Discord/Telegram 발송
```

## 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Next.js 15+ (App Router) |
| 언어 | TypeScript |
| DB | SQLite + Prisma ORM |
| 스타일링 | Tailwind CSS |
| 크롤링 스케줄러 | node-cron |
| 알림 | Discord Webhook, Telegram Bot API |
