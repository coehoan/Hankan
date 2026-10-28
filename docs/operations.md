# 한칸 운영과 worker

## 릴리스 상태

2026-10-28 기준 로컬 구현과 자동 검증을 진행했다. [인수 문서](acceptance.md)에 결과와 미검증 항목을 기록한다. 저장된 브라우저 접근 정책으로 이번 CUA 화면 검수가 차단됐고, 사용자는 HTTPS·지원 기기 환경이 없다고 확인했다. 실제 Android/데스크톱 푸시와 iOS 홈 화면 설치 수신 검증 전에는 공개 릴리스 완료로 판정하지 않는다. 호스팅 계정·도메인·DNS·외부 메일 변경은 이 로컬 작업의 승인에 포함되지 않는다.

## 설정 목록과 인증 메일

| 이름 | 사용하는 곳 | 설정 기준 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 인증 redirect·Origin 검증 | 사용자가 접속하는 정확한 origin. 개발 기본은 `http://127.0.0.1:3000`; localhost/다른 포트와 혼용 금지 |
| `NEXT_PUBLIC_SUPABASE_URL` | 웹/브라우저/기본 서버 연결 | 해당 Supabase API 주소. 테스트는 loopback만 허용 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 웹/브라우저 인증 | 프로젝트의 공개 키. service role과 교체하지 않음 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 사진 처리·worker·로컬 테스트 | 브라우저 노출 금지. 운영 비밀 저장소에서 주입 |
| `SUPABASE_SERVER_URL` | 서버/컨테이너 연결만 | 컨테이너에서 공개 URL로 연결할 수 없을 때 사용. 원격 배포는 원격 API를 명시 |
| `OPENAI_API_KEY` | 웹 서버 영수증·요리 API | 서버 전용. 실제 사용자 파일·전체 요청/응답을 로그로 남기지 않음 |
| 모델/추론 설정 | `src/features/ai/registry.ts`, `selected-provider.ts` | 평가한 `gpt-6-luna`/`high`로 서버 코드에 고정. 현재 `OPENAI_MODEL` 환경변수는 지원하지 않음 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 브라우저 구독·worker | 배포별 공개 키. 빌드할 때도 설정 |
| `VAPID_PRIVATE_KEY` | worker 전송 | 위 공개 키와 쌍인 서버 전용 개인 키 |
| `VAPID_SUBJECT` | worker 전송 | 실제 연락 가능한 mailto/HTTPS. 로컬 개발용 연락처를 그대로 배포하지 않음 |

Supabase Auth의 Site URL을 서비스 origin으로, 허용 redirect를 정확한 `/auth/callback`과 `/reset-password` 경로로 설정한다. 광범위한 운영 wildcard 대신 실제 주소만 허용한다. 가입 확인과 비밀번호 재설정 메일을 모두 검증하고, 인증 완료 후 내부 초대 경로 복귀도 확인한다. 로컬 `local_smtp`(Mailpit)는 외부 메일을 보내지 않는다. 운영 SMTP 제공사·발신 도메인·확인 메일 제한/반송은 실제 배포 단계에서 정하고 테스트한다.

웹 서버는 사진의 비공개 Storage 처리 때문에 서버 권한을 사용하며, 교차 사용자 예약 작업은 독립 worker가 실행한다. 일반 클라이언트는 발송 큐를 읽거나 claim할 수 없다. `.env.local`·서비스 키·VAPID 개인 키·원본 영수증·초대 원문은 Git, 빌드 인자, 오류 보고에 넣지 않는다. `NEXT_PUBLIC_*` 값은 공개됨을 전제로 설정한다. 키가 노출되면 공급자에서 폐기·교체하고 서버/worker를 재시작한다.

## 마이그레이션과 검증

기존 DB에는 `node scripts/supabase.mjs migration up --local`로 추가 migration만 적용한다. 001~009를 순서대로 유지하고 적용 이력을 먼저 확인한다. 새 migration을 먼저 적용한 뒤 호환되는 웹·worker를 배포한다. 기존 사용자 DB reset·볼륨 삭제는 하지 않는다. 새 DB 검증은 별도 project_id, 사용하지 않는 API/DB/메일 포트의 폐기용 Supabase를 만들어 수행한다. 11단계는 `hankan-stage11-20261028`과 5532x 포트를 사용해 원래 프로젝트와 분리했다.

`npm run check:stage11`은 pgTAP→단위/UI→실제 로컬 DB 통합→타입→lint→웹 빌드→worker 빌드를 실행한다. worker는 검사 중 테스트 작업을 가져가지 않게 멈추고 종료 후 다시 시작한다. 통합 검사는 자체 생성한 계정만 지운다. 유료 AI 호출은 기본 검사에서 실행하지 않으며 별도 `HANKAN_AI_LIVE=1 npm run test:ai-live` 결과를 기록한다. Windows 명령은 [AI 평가 문서](ai-evaluation.md)를 따른다.

DB 변경 시 타입 파일을 재생성하고 전체 검사를 반복한다. 사용 데이터와 비공개 Storage의 백업/보존·복구 절차는 배포 호스트에서 구성하고 복구 훈련 후 릴리스한다. 영수증 원본은 임시 데이터이므로 24시간 정리 정책과 백업 보존 정책도 함께 맞춘다.

## 로컬 실행

Node 24.15 이상(25 미만), 로컬 Supabase를 사용한다. `npm run dev`와 `npm run dev:worker`를 각각 실행한다. worker는 60초 간격이며 한 주기가 끝나기 전 다음 주기를 실행하지 않는다. `npm run build:worker` 후 `node dist/worker.cjs --once`로 한 주기만 실행할 수 있다. 배포 웹은 `npm run build` 후 `npm start`, worker는 `npm run start:worker`로 별도 실행한다. HTTP cron URL이나 비밀 토큰은 사용하지 않는다.

`.env.local`에 기존 Supabase 설정과 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`를 설정한다. 로컬용 키는 생성되어 있다. 배포마다 별도 키를 생성하고 subject에는 실제 연락 가능한 `mailto:` 주소 또는 HTTPS 주소를 사용한다. 키를 바꾸면 기존 브라우저 구독을 다시 연결해야 한다. 개인 키·service role 키는 공개 저장소, 로그, 클라이언트 번들에 넣지 않는다. VAPID가 없으면 푸시는 처리하지 않고 사진 정리만 실행한다.

## PWA와 브라우저 알림

알림 설정에서 일정을 켜고 시각을 저장한 후 **브라우저 알림 연결**을 누른다. 자동 권한 팝업은 없다. 각 브라우저에서 별도로 연결한다. 해제는 현재 브라우저만, 일정 끄기는 계정의 모든 서버 구독을 해제한다. 로그아웃 때 현재 브라우저 서버 구독과 native 구독, 개인 식별 정보를 정리한다. 다시 켜거나 로그인한 뒤에는 브라우저 알림을 다시 연결한다.

실기기는 HTTPS가 필요하다(localhost 개발 예외). iOS/iPadOS 16.4 이상은 Safari 공유 메뉴에서 홈 화면에 설치한 앱을 열어야 웹 푸시를 연결할 수 있다. 권한을 거부했다면 OS/브라우저의 해당 사이트 알림 권한을 변경한다. 실제 지원 기기의 수신·해제·탭 이동 검증은 11단계 릴리스 체크에 포함한다.

구독 endpoint는 Google FCM, Mozilla Push, Apple Web Push, Windows notify/wns 도메인의 HTTPS 주소만 허용한다. 임의 URL을 worker가 호출하지 않도록 DB와 전송 계층에서 검사한다. 새 push 공급자가 필요하면 검증 후 두 allowlist를 함께 갱신한다.

## 재시작과 중복 방지

사용자+현지 날짜의 작업이 유일하다. DB 잠금과 5분 임대, 갱신되는 임대 토큰으로 여러 worker를 보호한다. 전송 직전마다 현재 일정, 멤버십, 재료와 구독을 확인한다. 죽은 worker의 임대는 다음 worker가 회수한다. HTTP 성공 후 기록 전 장애가 나면 재전송될 수 있으나 서비스 워커의 안정적인 notification ID/tag 및 IndexedDB 유일 키로 중복 표시를 막는다. 브라우저 저장소를 사용자가 지우면 이전 표시 기록도 지워진다.

404/410 endpoint는 삭제한다. 다른 오류는 최대 10회, 60초부터 지수 증가(최대 1시간)로 재시도하며 다음 현지 날짜에는 이전 작업을 버린다. 한 구독의 실패가 다른 구독을 막지 않는다. 일부만 성공했어도 그날 새 작업은 만들지 않고 실패 구독만 재시도한다. 실제 발송 없이 종료된 작업은 아직 남아 있는 새 시각을 저장하면 같은 날짜로 재예약한다.

푸시에는 원문 재료 이름·사진 없이 개수와 일반 안내만 포함한다. 알림 상세는 클릭 시 로그인·본인 작업·현재 공유 권한으로 다시 계산한다. 개인 페이지/API/영수증/추천 결과를 오프라인 캐시에 저장하지 않는다. 정적 자산과 개인 데이터 없는 오프라인 안내만 캐시한다.

## 사진 정리

매 주기 24시간 지난 영수증을 만료 처리하고 `cleanup_pending` 원본 최대 100건을 삭제한다. 삭제가 성공한 뒤에만 정리 표시를 해제한다. 실패는 다음 주기에 재시도한다. 로그는 개수와 일반 오류만 기록한다. 예전 `receipts:cleanup` 명령도 유지되나 worker와 동시에 운영할 필요는 없다.

## Docker Compose

`docker compose --env-file .env.local build web` 후 `docker compose --env-file .env.local up -d web worker`로 이 프로젝트의 두 서비스만 시작한다. 공개 `NEXT_PUBLIC_*` 값은 빌드 시 고정된다. 외부 서비스에 배포하는 명령은 아니다.

기본 호스트 포트는 3001이다. `.env.local`의 `NEXT_PUBLIC_SITE_URL`을 접속할 주소(예: `http://127.0.0.1:3001`)로 맞춘 뒤 빌드한다. 기존 3000 개발 서버와 주소를 혼용하지 않는다. 브라우저용 Supabase URL은 `http://127.0.0.1:54321`, 컨테이너 내부용은 기본 `http://host.docker.internal:54321`이다. 원격 Supabase를 쓸 때는 `SUPABASE_SERVER_URL`도 해당 원격 URL로 지정한다. 인증 쿠키 이름은 공개 URL 기준으로 같게 유지한다.

중지: `docker compose --env-file .env.local stop web worker`. 작업 데이터와 Supabase 볼륨을 삭제하는 `down -v` 또는 DB reset은 사용하지 않는다. 운영 환경은 HTTPS 역방향 프록시, 실제 VAPID 연락처, 비밀 관리와 백업을 구성한 뒤 11단계 체크를 수행한다.

## 장애 확인과 재개

웹과 지속 실행 Node worker를 모두 지원하는 호스트가 필요하다. worker를 요청 종료 때 중단되는 일회성 웹 함수에만 배치하지 않는다. 프로세스 관리자/Compose의 재시작 정책을 켜고, 배포 후 시작 로그와 60초 주기의 정리 개수 로그를 확인한다. 종료 중 전송 결과 기록이 남지 않은 작업은 5분 임대 만료 후 재개된다. DB 작업/구독 키를 수정해 임의로 다시 발송하지 않는다.

알림이 오지 않으면 사용자 일정 enabled/시간대/다음 시각→브라우저 연결/OS 권한→worker 생존→VAPID 쌍과 연락처→DB/RPC 연결 순으로 확인한다. 404/410은 구독 제거 후 브라우저에서 재연결한다. 인증/403 등 설정 오류는 키와 설정을 고치고 재시작한다. 재시도는 최대 10회로 제한되므로 실패 작업을 운영에서 확인해야 한다. 상세 큐 조회는 관리자 서버 환경에서만 하며 endpoint·인증 키를 로그에 출력하지 않는다.

사진 삭제 실패는 `cleanup_pending`을 유지해 다음 주기에 재시도한다. Storage/DB 연결 복구 후 감소하는지 확인한다. AI 공급자 장애는 재료를 보존하며 사용자에게 직접 입력 또는 재시도를 안내한다. 세 기능의 실패를 실제 성공으로 기록하거나 예시 결과로 대체하지 않는다.

웹/프록시/호스팅 접근 로그에서 초대 원문이 들어가는 `/invite/*`, `/api/invites/*` 경로와 인증 query·cookie·Authorization을 가린다. 요청 본문·서명된 사진 URL·AI 원문도 수집하지 않는다. 모니터링에는 상태 코드·익명화한 오류 코드·처리 시간·정리 개수만 기록한다. 호스트의 worker 중단, 오래된 미처리 작업, 반복 삭제 실패 알림은 공개 배포 때 실제 운영 서비스와 연결한다.

영수증 분석 중 서버가 중단돼 analyzing으로 남으면 5분 뒤 초안을 다시 확인한다. 본인과 현재 멤버십을 검사한 뒤 만료된 분석 실행만 복구한다. 저장해 둔 검토 내용을 보존하며 다시 분석/직접 입력을 사용할 수 있고, 이전 실행의 늦은 응답은 반영하지 않는다. 원본의 24시간 만료는 별도로 유지된다.

## 클라우드 연결 기록

2026-10-28 클라우드 프로젝트에 기존001~009 SQL을 순서대로 적용했다. MCP가 발급한 시각 기반 이력은 적용 결과 확인 후 저장소의001~009와 정합화해 다음 CLI 실행의 중복 적용을 방지했다. 새로 시작한 클라우드로 사용자 데이터를 복사하지 않았으며 로컬 DB는 유지했다.

현재 .env.local은 클라우드 접속을 사용한다. 변경 전 설정은 Git에서 제외된 work/env-backups/.env.local.before-cloud에 보관한다. 전체 DB 통합 검사는 .env.test.local의 기존 로컬 연결을 쓰도록 분리했다. .env.cloud.local은 준비 파일이며 Next가 자동으로 읽지 않는다. 키 값이나 백업 파일을 커밋하지 않는다.

클라우드 SDK 검사32건과 실제 Next 서버 로그인·알림 설정·구독 등록·로그아웃 API 흐름, worker 한 주기를 확인했다. 검증용 사용자/사진은 제거했다. 일반 사용자 인증메일 발송·SMTP, 실제 브라우저/기기 수신, 웹 공개 호스팅은 별도 검증 대상이다.

보안 Advisor의 authenticated SECURITY DEFINER 실행 경고20건은 소유권·멤버십을 검사하는 의도된 원자적 RPC다. [경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)을 확인하고 실제 접근 차단을 검사했으며 경고 제거를 위해 권한을 풀지 않았다. RLS 정책 없음 정보3건은 클라이언트가 접근하면 안 되는 서버 전용 표의 기본 거부다. [설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
