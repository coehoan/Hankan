# 개발·테스트

## 빠른 시작

1. 저장소 루트에서 `git status`를 확인한다. 이미 실행 중인 서버·로컬 Supabase를 재사용하고 기존 프로세스를 임의로 종료하지 않는다.
2. Node 버전은 `>=24.15.0 <25`. 의존성이 없으면 `npm ci`로 lockfile 그대로 설치한다. Windows 실행 정책으로 `npm`이 막히면 `npm.cmd`를 사용한다.
3. 환경파일이 이미 있으면 보존한다. 새 환경은 `.env.example`을 참고하되, `.env.local`의 클라우드 설정과 로컬 테스트 설정을 섞지 않는다.
4. 로컬 DB가 필요한 경우 Docker를 실행한 뒤 `npm run db:start`. CLI는 `scripts/supabase.mjs`를 통해 프로젝트의 `work/supabase-home`을 사용한다.
5. `npm run dev` → `http://127.0.0.1:3000`. `NEXT_PUBLIC_SITE_URL`과 접속 origin이 일치해야 한다. 서버 주소가 로컬이어도 연결 DB가 로컬이라는 뜻은 아니다.

## 검증 명령

| 목적 | 명령 |
| --- | --- |
| 단위·컴포넌트 테스트 | `npm test -- --maxWorkers=4` (뒤에 파일 경로로 범위 제한 가능) |
| DB 정책·RPC | `npm run test:db` |
| 실제 로컬 DB와 API 통합 | `npm run test:integration` |
| 형식·타입·린트·빌드 | `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run build` |
| worker 변경 | `npm run build:worker`와 관련 테스트 |

- 통합 테스트는 `.env.test.local`을 읽으며 `tests/support/db.ts`가 원격 주소를 거부한다. 이 보호를 우회하지 않는다. 테스트용으로 생성한 데이터만 정리한다.
- 동작 변경에는 의미 있는 회귀 테스트를 추가하고, 단순 문구·스타일에는 구현을 그대로 복제하는 테스트를 만들지 않는다. 통과한 검사는 새 변경이나 실패 원인이 있을 때만 반복한다.
- `check:stage11`은 전체 일괄 검사다. worker 수를 제한해야 하는 환경에서는 위 명령을 개별 실행한다.
- `test:ai-live` / `ai:evaluate`는 실제 API를 호출하므로 기본 회귀 검사에 넣지 않는다. 실제 AI 호출이 필요한 작업에서만 사용한다.
- 통과·실패·스킵·미실행을 구분한다. 화면·푸시 수신은 자동 테스트 통과만으로 검증 완료라고 하지 않는다.

## 포맷과 커밋

- `.prettierrc.json` / `.prettierignore` / `.gitattributes` 기준: 2칸, 작은따옴표, 세미콜론, LF. 변경 파일은 로컬 Prettier로 정렬한다.
- `npm run format`은 전체 정렬이므로 요청되었을 때 사용한다. 비밀·생성·개인 파일과 문서는 포맷 대상에서 제외되어 있다.
- 범위 밖 변경을 섞지 않고 커밋한다. `.idea`의 공유 프로젝트 설정은 추적하며, 개인 상태·캐시는 `.idea/.gitignore`로 제외한다. AGENTS.md의 배포 제한은 커밋 요청에도 유지된다.
