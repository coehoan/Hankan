# 한칸

식재료와 유통기한을 함께 관리하는 웹 서비스입니다. 승인된 설계는 `docs/superpowers/specs/2026-10-26-hankan-design.md`, 구현 계획은 `docs/superpowers/plans/2026-10-26-hankan.md`에 있습니다.

## 현재 범위

1단계는 이메일 회원가입·메일 확인·로그인·비밀번호 재설정·로그아웃과 가입 시 본인 냉장고 자동 생성입니다. 개인 프로필과 냉장고의 DB 접근 정책, 소유자·멤버의 기본 권한도 포함합니다.

2단계는 식재료 저장 서비스와 API입니다. 냉장·냉동·실온, 필수 유통기한, 남은 양, 구매 묶음별 관리, 중복 저장 방지, 동시 수정·삭제의 버전 충돌 검사를 제공합니다. 재료를 입력하고 조작하는 화면은 3단계에서 연결합니다. 공동 초대 UI·AI·알림도 후속 단계입니다.

## 식재료 API

로그인 쿠키가 필요합니다. 변경 요청에는 사이트와 같은 `Origin` 및 `Content-Type: application/json`을 보냅니다. 모든 응답은 `private, no-store`입니다.

| 메서드와 경로 | JSON 본문 | 성공 결과 |
| --- | --- | --- |
| GET `/api/fridges/:fridgeId/ingredients` | 없음 | `{data: Ingredient[]}`, 기한·등록 시각 순 |
| POST `/api/fridges/:fridgeId/ingredients` | `{requestId, name, storage, expiresOn}` | `{data: Ingredient}`, 201 |
| PATCH `/api/fridges/:fridgeId/ingredients/:ingredientId` | `{expectedVersion, patch}` | `{data: Ingredient}`, 버전 증가 |
| DELETE `/api/fridges/:fridgeId/ingredients/:ingredientId` | `{expectedVersion}` | `{data: null}` |

`requestId`는 새 등록 시 생성한 UUID이며 재시도에도 동일한 값을 사용합니다. 같은 요청 ID로 다른 내용을 저장하면 409입니다. 이미 삭제된 묶음의 등록 요청을 재시도하면 404이며 복원하지 않습니다. 같은 이름을 별도 묶음으로 등록할 때에는 새 요청 ID를 사용합니다.

`storage`는 `fridge | freezer | pantry`, `expiresOn`은 실제로 존재하는 `YYYY-MM-DD`, 이름은 앞뒤 공백을 뺀 1~80자입니다. 새 묶음은 100%이며 수정할 남은 양은 0~100의 5 단위입니다. 0%여도 직접 삭제하기 전까지 유지합니다. `patch`에는 `name`, `storage`, `expiresOn`, `remainingPercent`만 허용합니다.

접근 권한이 없으면 401/403, 삭제되었거나 다른 냉장고의 묶음이면 404, 버전 충돌은 409, 입력 오류는 422를 반환합니다. 409 발생 시 최신 목록을 가져온 뒤 다시 편집해야 합니다.

## 로컬 실행

Node 24와 실행 중인 Docker가 필요합니다. Windows PowerShell에서는 다음 명령을 사용합니다.

```powershell
npm.cmd ci
npm.cmd run db:start -- -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

Supabase CLI의 상태·캐시는 `work/supabase-home`에 저장하며 사용자 홈을 수정하지 않습니다. `.env.example`을 `.env.local`로 복사하고 `node scripts/supabase.mjs status`에서 확인한 로컬 URL과 공개 키를 입력합니다. 통합 테스트에만 로컬 service role 키를 추가합니다. `.env.local`, CLI 상태 파일과 테스트 로그는 Git에서 제외합니다.

```powershell
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다. 요청 출처 검증을 위해 `NEXT_PUBLIC_SITE_URL`과 브라우저 주소의 origin이 같아야 합니다. 확인·재설정 메일은 CLI status의 Mailpit URL에서 확인하며 실제 외부 주소로 발송하지 않습니다.

## 검증

```powershell
npm.cmd run test:db
npm.cmd test
npm.cmd run test:integration
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

통합 테스트는 loopback 주소의 로컬 Supabase만 허용합니다. 생성한 테스트 계정만 정리하며 원격 프로젝트는 사용하지 않습니다. 새 로컬 DB를 만들 때 `node scripts/supabase.mjs db reset --local`로 마이그레이션을 적용합니다. 기존 DB에는 `node scripts/supabase.mjs migration up --local`로 새 마이그레이션만 추가하며 reset을 사용하지 않습니다. 2단계 전체 검증은 `npm.cmd run check:stage2`로 실행합니다.

이 단계는 로컬 구현이며 공개 배포나 운영용 Supabase 설정을 포함하지 않습니다.
