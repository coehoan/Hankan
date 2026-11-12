# 개발·테스트

## 빠른 시작

1. 저장소 루트에서 `git status`를 확인한다. 이미 실행 중인 서버·로컬 Supabase를 재사용하고 기존 프로세스를 임의로 종료하지 않는다.
2. Node 버전은 `>=24.15.0 <25`. 의존성이 없으면 `npm ci`로 lockfile 그대로 설치한다. Windows 실행 정책으로 `npm`이 막히면 `npm.cmd`를 사용한다.
3. 다른 PC의 새 환경은 [인수인계](../docs/handoff.md)를 먼저 확인한다. 환경파일이 이미 있으면 보존한다. 새 환경은 `.env.example`을 참고하되, `.env.local`의 클라우드 설정과 로컬 테스트 설정을 섞지 않는다.
4. 로컬 DB가 필요한 경우 Docker를 실행한 뒤 `npm run db:start`. CLI는 `scripts/supabase.mjs`를 통해 프로젝트의 `work/supabase-home`을 사용한다.
5. `npm run dev` → `http://127.0.0.1:3000`. `NEXT_PUBLIC_SITE_URL`과 접속 origin이 일치해야 한다. 서버 주소가 로컬이어도 연결 DB가 로컬이라는 뜻은 아니다.

현재 PC의 개발 앱은 Git에서 제외한 `.env.development.local`로 기존 로컬 Supabase(`http://127.0.0.1:54321`)에 연결한다. Next.js 개발 모드에서는 이 파일이 `.env.local`보다 우선하며, 기존 `.env.local`과 `.env.test.local`은 그대로 보존한다. 공개 URL·공개 키와 서버 URL·service role을 모두 같은 로컬 프로젝트로 지정한다. `npm run dev:worker`는 별도로 `.env.local`을 읽으므로 이 개발 앱 설정을 자동으로 사용하지 않는다. worker 실행 전에는 별도로 로컬 DB 대상을 확인한다.

## 검증 명령

개발 모드에서는 프로필 아이콘 → **개발 메뉴**에서 현재 기기 테스트 푸시와 추천 팝업(진행·준비·실패)을 확인한다. 푸시는 마이페이지에서 알림 받기를 켜 기기를 연결한 뒤 사용하며, 로그인한 사용자의 현재 기기 구독에만 전송한다. 팝업은 실제 추천 작업이나 내역을 만들지 않는 미리보기다. 진행은 3초 후 자동 닫힘, 준비·실패는 직접 닫을 때까지 유지한다. 운영 빌드에서는 메뉴·미리보기를 표시하지 않고 `/api/push/test`도 404로 차단한다.

| 목적 | 명령 |
| --- | --- |
| 단위·컴포넌트 테스트 | `npm test -- --maxWorkers=4` (뒤에 파일 경로로 범위 제한 가능) |
| 배포 순서·대상 차단 | `npm run test:release` (실제 배포 없이 가짜 실행기로 검사) |
| DB 정책·RPC | `npm run test:db` |
| 실제 로컬 DB와 API 통합 | `npm run test:integration` |
| 형식·타입·린트·빌드 | `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run build` |
| worker 변경 | `npm run build:worker`와 관련 테스트 |

- Realtime은 로컬 DB 검사에도 필요하다. 이전 README의 Realtime 제외 실행법을 재사용하지 않는다. `23514: no partition of relation "messages" found for row`가 나오면 기존 Realtime 컨테이너와 서비스 상태부터 확인하고 DB reset으로 해결하지 않는다.
- 통합 테스트는 `.env.test.local`을 읽으며 `tests/support/db.ts`가 원격 주소를 거부한다. 이 보호를 우회하지 않는다. 테스트용으로 생성한 데이터만 정리한다.
- 동작 변경에는 의미 있는 회귀 테스트를 추가하고, 단순 문구·스타일에는 구현을 그대로 복제하는 테스트를 만들지 않는다. 통과한 검사는 새 변경이나 실패 원인이 있을 때만 반복한다.
- `check:stage11`은 전체 일괄 검사다. worker 수를 제한해야 하는 환경에서는 위 명령을 개별 실행한다.
- `test:ai-live` / `ai:evaluate`는 실제 API를 호출하므로 기본 회귀 검사에 넣지 않는다. 실제 AI 호출이 필요한 작업에서만 사용한다.
- CI의 Vercel 빌드는 루트 환경파일을 임시 보관한 뒤 성공·실패 모두 복원하고, 최종 함수 산출물에서 환경파일 참조를 검사한다. `.vercel/.env.production.local`은 빌드에 그대로 사용한다. 자세한 근거는 [배포 안내](../docs/deployment-pipeline.md)를 따른다.
- 통과·실패·스킵·미실행을 구분한다. 화면·푸시 수신은 자동 테스트 통과만으로 검증 완료라고 하지 않는다.
- PWA 공개 정적 파일 캐시는 서버의 `no-cache`·`must-revalidate` 지시에 따라 온라인에서 다시 확인한다. `no-store` 응답은 저장하지 않으며, 운영의 immutable 파일과 공개 파일의 오프라인 사용은 유지한다. 서비스 워커를 수정한 뒤에는 갱신·활성화 후 화면을 다시 불러와 실제 CSS 반영을 확인한다.

## UX 회귀 확인 (2026-11-12)

- 재료 삭제와 영수증 초안 취소는 확인 창에서 확정해야 요청한다. 재료 버전 충돌 시 창을 닫고 최신 내용을 다시 확인한다. 기존 데이터를 삭제하는 수동 검사는 하지 않고 테스트에서 요청·취소·충돌을 재현한다.
- 영수증은 저장에 포함한 품목의 이름(Unicode 1~80자)·날짜 오류를 각 필드와 요약에 표시한다. 제외한 품목은 저장을 막지 않는다.
- 추천의 재료 조회 실패는 화면 안에서 재조회하고 결과 없는 분류는 숨긴다. `recipe-list.test.tsx`에서 실패→재조회 및 분류 표시를 검증한다.
- 알림 설정을 읽을 때 권한을 요청하지 않는다. 기기의 권한·브라우저 구독·서버 등록을 함께 확인하며, 연결 버튼을 눌렀을 때만 권한/등록 절차를 시작한다. 실기기 수신과 iOS 홈 화면 PWA는 별도 확인한다.

## 포맷과 커밋

- `.prettierrc.json` / `.prettierignore` / `.gitattributes` 기준: 2칸, 작은따옴표, 세미콜론, LF. 변경 파일은 로컬 Prettier로 정렬한다.
- `npm run format`은 전체 정렬이므로 요청되었을 때 사용한다. 비밀·생성·개인 파일과 문서는 포맷 대상에서 제외되어 있다.
- 범위 밖 변경을 섞지 않고 커밋한다. `.idea`의 공유 프로젝트 설정은 추적하며, 개인 상태·캐시는 `.idea/.gitignore`로 제외한다. AGENTS.md의 배포 제한은 커밋 요청에도 유지된다.
