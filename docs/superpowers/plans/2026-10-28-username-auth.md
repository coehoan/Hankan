# Username Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement inline with TDD.

**Goal:** 이메일 없이 아이디 가입·로그인, 본인 비밀번호 두 번 확인 변경, 관리자 CLI 초기화.
**Architecture:** 기존 Supabase Auth에 서버 내부 식별자를 매핑한다. 데이터 스키마는 바꾸지 않고 기존 UUID/RLS를 보존한다.
**Tech Stack:** 기존 Next/React/TypeScript/Supabase/Vitest/Node24.
**Spec:** ../specs/2026-10-28-username-auth-design.md

## Global Constraints

- 아이디 4~24자 영문/숫자/밑줄, 소문자 정규화. 비밀번호 8자 이상/UTF-8 최대72바이트, 공백 보존.
- 비밀번호 변경은 본인 세션 필수이며 두 번 입력을 서버 검증한다. 관리자 초기화는 공개 API를 제공하지 않는다.
- 메일 API를 제거한다. 기존 로컬 데이터와 비밀 설정을 보존하며 실제 계정의 비밀번호를 임의 변경하지 않는다.
- 사용자 지시로 설계·방향 승인됨. 추가 제품 기능이나 DB 스키마 변경은 없다.

## Review Focus

1. 대소문자/공백 정규화와 특수문자 차단.
2. 확인 불일치·미로그인 비밀번호 변경은 서버에서 차단.
3. 관리자 키와 비밀번호가 브라우저·인자·로그에 노출되지 않음.
4. 가입 즉시 내부 초대 목적지 보존, 외부 redirect 거부.
5. 실패·중복 가입 및 관리자 초기화가 다른 계정/데이터를 바꾸지 않음.

### Task 1: 아이디 인증과 비밀번호 관리

**Files:** src/features/auth/{validation,identity,actions,auth-form,admin-reset}.ts(x), auth 폼 테스트, src/app/api/auth/[action]/route.ts, change-password/reset-password 경로, AppShell, scripts/admin-reset-password.ts, supabase/config.toml, README/docs/operations.
**Interfaces:** usernameToEmail(username):string; parseAuthInput(sign-in/sign-up/update-password/sign-out); updatePassword(password,confirmPassword); resetAccountPassword(username,password,confirmPassword,clients).

- [x] RED: 정규화·아이디 형식·확인 불일치·메일 API 없음·미로그인 거부·즉시 가입 이동·CLI 정확한 대상 및 세션 해제 테스트.
- [x] GREEN: 검증/매핑, 서버 로그인/가입/변경, UI와 관리자 CLI를 연결한다.
- [x] 로컬 Confirm email=false 적용, 로컬 실제 DB/서버 시나리오 확인.
- [x] 클라우드 설정 저장 후 합성 계정 가입→로그인→비밀번호 변경→관리자 초기화→구 비밀번호 실패를 검사하고 검증용 계정만 정리.
- [x] 전체 check:stage11·새 인증 테스트·독립 리뷰의 중요 결함 수정, 커밋 및 운영 절차 기록.

## Verification

2026-10-28: check:stage11 exit0, DB101 + unit/UI215 + integration99 = 415 passed; two opt-in AI live tests skipped. Actual cloud API/CLI auth18 passed. Fresh reviewer found one invitation navigation regression; safe/external destination tests failed first, then passed after correction. No remaining Critical/Important/Minor findings. Existing browser/device acceptance gates remain separate in docs/acceptance.md.
