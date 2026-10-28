# 한칸

식재료와 유통기한을 함께 관리하는 웹 서비스입니다. 승인된 설계는 `docs/superpowers/specs/2026-10-26-hankan-design.md`, 구현 계획은 `docs/superpowers/plans/2026-10-26-hankan.md`에 있습니다.

## 현재 상태

1~10단계 기능을 구현했고 11단계에서 새 DB 회귀 검사·실제 AI 연결·독립 리뷰·운영 문서를 검증합니다. 공개 릴리스는 아직 승인되지 않았습니다. [인수 체크리스트](docs/acceptance.md)에서 자동 검증과 실제 화면·기기 미검증을 구분합니다.

## 구현 범위

1단계는 이메일 회원가입·메일 확인·로그인·비밀번호 재설정·로그아웃과 가입 시 본인 냉장고 자동 생성입니다. 개인 프로필과 냉장고의 DB 접근 정책, 소유자·멤버의 기본 권한도 포함합니다.

2단계는 식재료 저장 서비스와 API입니다. 냉장·냉동·실온, 필수 유통기한, 남은 양, 구매 묶음별 관리, 중복 저장 방지, 동시 수정·삭제의 버전 충돌 검사를 제공합니다.

3단계에서 재료 목록·직접 등록·수정·남은 양·삭제, 검색과 보관 필터, 기한별 그룹을 연결했습니다. 본인·공유 냉장고를 전환하고 마지막 선택을 저장합니다. 활성·온라인 화면은 3초마다 목록을 갱신하며 포커스·온라인 복귀 시 다시 읽습니다. 냉장고가 바뀌면 이전 응답을 무시하고, 권한이 없어지면 목록과 요약을 지운 뒤 본인 냉장고로 돌아갑니다. 수정 충돌 때 입력을 보존하며 사용자가 최신 값으로 다시 편집할 수 있습니다.

4단계에서 소유자의 초대 링크 생성·복사·취소, 로그인 후 초대 확인·명시적 참여, 멤버 내보내기와 나가기를 연결했습니다. 링크는 32바이트 난수로 만들고 SHA-256 해시만 DB에 저장합니다. 7일 만료와 1회 수락을 DB 트랜잭션으로 검사하며 이미 참여한 멤버는 새 링크를 소비하지 않습니다. 탈퇴·내보내기 뒤에도 그 멤버가 등록한 재료는 유지합니다. AI와 알림은 아래 8~10단계 범위에서 연결했습니다.


5단계 기능으로 라이트·다크·시스템 테마, 계정별 테마 저장과 첫 렌더 cookie, 공통 대화상자의 키보드 포커스 가두기·복귀, 오류와 빈 목록 구분, 로딩 화면, 모바일 글자·조작 영역을 적용했습니다. Pretendard 1.3.9 가변 글꼴과 라이선스, 일곱 가지 재료 SVG를 로컬 자산으로 포함합니다. 테마 변경은 입력 중인 폼을 재생성하지 않으며, 계정 변경과 로그아웃 때 개인 화면 상태를 정리합니다. 320·390·768·1280px 및 사용자가 설정한 Chrome 200% 실제 확대에서 목록·등록 창·멤버 창과 키보드 접근 검증을 통과했습니다.

테마 저장은 `PATCH /api/preferences/theme`에 `{preference: "system" | "light" | "dark"}`를 전달합니다. 로그인한 본인 profile만 변경하며 같은 Origin의 JSON 요청을 검사합니다. 로그인 전 선택은 표시용 cookie에만 저장합니다. 저장 실패 시 현재 화면 색은 유지하고 재선택 안내를 표시합니다.


6단계에서 개인 영수증 업로드·확인 화면과 명시적 일괄 등록을 연결했습니다. JPEG/PNG/WebP를 실제 디코딩한 뒤 PNG로 다시 인코딩하여 EXIF를 제거하고, 10MB·25MP 제한을 검사합니다. 비공개 Storage 원본과 초안은 업로더만 접근하며 원본 링크는 60초 유효합니다. 사용자가 품목을 수정·제외·추가하고 유통기한을 직접 정해야 저장할 수 있습니다. 검토 내용은 별도로 임시 저장할 수 있고, 목적 냉장고는 초안 생성 때 고정됩니다. 초안당 원자적 1회 저장과 재시도 중복 방지, 멤버 탈퇴 시 자동 취소를 DB에서 검사합니다.

8단계에서 OpenAI `gpt-6-luna`, 추론 강도 `high`를 연결했습니다. 프로젝트 루트 `.env.local`의 `OPENAI_API_KEY`에 서버용 키를 입력하고 개발 서버를 다시 시작합니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 키가 없으면 `provider_unconfigured`를 반환하고 품목 직접 입력을 제공합니다. 테스트용 공급자는 계약 검증에만 주입하며 사용자 화면에 가짜 분석 결과를 표시하지 않습니다. 실제 토큰·응답 시간·비용과 재현 명령은 [AI 평가 기록](docs/ai-evaluation.md)에 있습니다.

사진 삭제는 저장·취소 직후 시도하고 실패하면 `cleanup_pending`으로 남깁니다. 중단한 초안은 24시간 뒤 취소됩니다. 로컬에서는 `npm run dev:worker`를 별도 실행해 60초마다 발송과 사진 정리를 수행합니다. 배포는 `npm run build:worker` 후 `npm run start:worker`로 지속 실행합니다. 기존 `receipts:cleanup`은 사진 정리만 하는 호환 명령이며 두 정리 프로세스를 함께 켤 필요는 없습니다.

영수증 API는 `POST /api/receipts`(multipart: fridgeId, file), `GET /api/receipts?fridgeId=...`, `GET/PATCH/DELETE /api/receipts/:draftId`, `POST .../analyze`, `POST .../commit`입니다. PATCH는 `{items: ReviewItem[]}`, commit은 `{requestId, items: {name,storage,expiresOn}[]}`를 받습니다. 변경 요청은 같은 Origin만 허용하며 JSON은 64KiB, 사진 요청은 10MiB+multipart 여유분을 스트리밍으로 제한합니다. 취소는 멤버십을 잃은 업로더도 자기 사진 정리를 위해 수행할 수 있습니다.


7단계에서 ‘요리 추천’ 메뉴와 냉장고 요약 옆 추천 영역을 연결했습니다. NFKC·공백·계란/달걀 별칭을 정리하고 0%·기한 경과 묶음을 제외한 뒤 전체 필요 재료와 비교합니다. 소금·식용유도 등록하지 않으면 부족 재료입니다. 겹치는 재료가 없는 후보는 제외하고 보유 재료로 가능한 요리와 장보기가 필요한 요리를 나눕니다. 각 그룹은 가장 이른 임박 기한→임박 재료 종류 수 내림차순→부족 재료 수→요리명 순입니다. 같은 종류는 가장 이른 유효 묶음 하나를 먼저 사용하도록 안내합니다. 종류 기준 매칭이므로 실제 필요한 중량은 조리법에서 따로 확인해야 합니다.

추천 요청은 명시적 `POST /api/fridges/:fridgeId/recipes`의 빈 JSON `{}`으로 실행합니다. 응답은 `{data: RecipeMatch[], inventoryVersion, today}`이며 private/no-store입니다. 서버는 선택한 냉장고와 현재 멤버십을 검사하고 공급자 응답의 전체 재료·필요량·단계·시간·인분·출처를 검증합니다. 추천 후 멤버십·재료 버전·현지 날짜를 다시 확인합니다. 클라이언트도 요청 시작 때의 냉장고·재료 버전·날짜가 달라지면 카드와 상세 창을 폐기하며 이전 요청을 취소합니다. 추천으로 재료나 남은 양을 변경하지 않습니다.

생성형 조리법에는 생성형 결과 표시만 하고 출처 URL을 만들지 않습니다. 카탈로그 결과는 서버에 등록된 제공사·기록의 원본 정보로만 표시합니다. 현재 연결한 AI는 생성형 조리법만 반환하며 검증된 카탈로그 등록은 비어 있어 임의 출처를 거부합니다. 설정이 없거나 공급자가 실패해도 재료를 보존하고 재시도 안내를 표시합니다. 운영 화면에 예시 요리를 삽입하지 않습니다.

초대 원문은 생성 응답에서 한 번만 표시하고 새로고침 후 복원하지 않습니다. 소유자는 생성한 초대 목록에서 사용 전 취소할 수 있습니다. 초대 경로에는 no-referrer/noindex 헤더를 사용하고 Next 개발 요청 로그를 비활성화했습니다. 배포 시 프록시·호스팅 접근 로그에서도 초대 경로를 기록하지 않도록 설정해야 합니다.

멤버 이름은 냉장고 멤버십을 검사하는 전용 RPC로 제공하며, 다른 사람의 profile·테마·알림 설정을 공개하지 않습니다. 초대 수락은 GET으로 실행하지 않습니다. 가입 확인 메일을 거친 경우에도 검증된 내부 초대 경로로 돌아갑니다.

냉장고 목록은 `GET /api/fridges`의 `{data: FridgeSummary[]}`, 선택 저장은 `PATCH /api/fridges`의 `{fridgeId}` 본문을 사용합니다. 선택 API도 같은 Origin의 JSON과 현재 멤버십을 확인하며, 사용자의 profile만 갱신합니다.

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

9단계에서 냉장고와 요리 추천 화면의 **알림 설정**을 추가했습니다. 본인 계정의 알림 일정 사용 여부와 매일 받을 시각(`HH:mm`)을 저장하고, 계정 시간대와 다음 발송 예정 시각을 표시합니다. 기본값은 꺼짐·09:00·Asia/Seoul입니다. 오늘 미발송이고 새 시각이 미래이면 오늘, 시각이 지났거나 오늘 이미 발송했다면 다음 날로 예약합니다. 오프라인이나 저장 실패 시 기존 저장값을 유지하며, 소유자도 다른 멤버의 설정을 읽거나 바꿀 수 없습니다. 10단계에서 PWA 설치 정보·서비스 워커·브라우저 연결/해제·발송 worker를 연결했습니다. 일정 저장 후 각 브라우저에서 알림 연결을 눌러야 합니다. 로그아웃은 현재 브라우저만, 일정 끄기는 모든 서버 구독을 해제합니다. 실패 재시도·DB 임대·구독별 전송 기록·IndexedDB 표시 기록으로 중복을 막습니다. 실제 기기의 수신 판정은 별도 인수 항목입니다. [알림 일정 설계와 검증](docs/notification-schedules.md)을 참고하세요.

Node 24와 실행 중인 Docker가 필요합니다. Windows PowerShell에서는 다음 명령을 사용합니다.

```powershell
npm.cmd ci
npm.cmd run db:start -- -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

Supabase CLI의 상태·캐시는 `work/supabase-home`에 저장하며 사용자 홈을 수정하지 않습니다. `.env.example`을 `.env.local`로 복사하고 `node scripts/supabase.mjs status`에서 확인한 로컬 URL과 공개 키를 입력합니다. 사진 저장/정리와 worker에도 서버 전용 service role 키가 필요합니다. 공개 키와 구분하고 브라우저에 전달하지 않습니다. `.env.local`, CLI 상태 파일과 테스트 로그는 Git에서 제외합니다.

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

통합 테스트는 loopback 주소의 로컬 Supabase만 허용합니다. 생성한 테스트 계정만 정리하며 원격 프로젝트는 사용하지 않습니다. 빈 DB 검증은 별도의 project_id와 포트를 가진 폐기용 Supabase를 시작해 마이그레이션을 처음부터 적용합니다. 기존 DB에는 `node scripts/supabase.mjs migration up --local`로 새 마이그레이션만 추가하며 reset을 사용하지 않습니다. 2단계 전체 검증은 `npm.cmd run check:stage2`로 실행합니다.

이 단계는 로컬 구현이며 공개 배포나 운영용 Supabase 설정을 포함하지 않습니다.

전체 회귀 검증은 `npm.cmd run check:stage11`입니다. 기본 실행은 유료 AI 호출을 하지 않으며 선택적 skip은 통과에 포함하지 않습니다. 실제 AI는 [평가 기록](docs/ai-evaluation.md)의 명시적 `test:ai-live` 명령으로 별도 확인합니다.

운영 환경변수·메일/redirect·Docker Compose·worker 재시작과 장애 대응은 [운영 문서](docs/operations.md), 두 계정 및 실기기 수동 절차는 [인수 체크리스트](docs/acceptance.md)를 참고하세요. VAPID 공개 키/개인 키/실제 연락처를 설정해야 푸시를 연결할 수 있습니다.
