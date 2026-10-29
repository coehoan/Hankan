# DB·운영

## DB 변경

- 로컬과 Supabase 클라우드는 별개다. `.env.local`을 테스트용으로 덮어쓰거나 기존 로컬 DB에 reset을 실행하지 않는다. 초기화 검사는 별도 폐기용 DB에서 한다.
- CLI는 `node scripts/supabase.mjs ...`를 사용하고 해당 명령의 `--help`를 확인한다. 새 파일은 `migration new <name>`으로 생성하며, 검증한 마이그레이션만 `migration up --local`로 적용한다. 로컬 명령에는 대상을 명시한다.
- RLS·권한·RPC는 실제 소유자/멤버/비회원으로 검증한다. API 사전 확인만 믿지 말고 DB에서도 실행 시점의 권한을 검사한다. 공유 변경은 냉장고 → 초대/멤버 순으로 잠가 경합과 교착을 막는다.
- `SECURITY DEFINER`는 꼭 필요한 경계에서만 사용한다. 빈 `search_path`, 스키마 명시, 명시적 execute 회수를 유지한다. 사용자 RPC는 현재 사용자/소유자를 검사하고 worker RPC는 서버 전용 실행 권한을 유지한다. 단순 권한 오류를 우회하는 용도로 추가하지 않는다.
- 스키마 변경 후 `npm run db:types`로 `src/lib/supabase/database.types.ts`를 재생성하고 해당 파일을 포맷한다. DB·관련 통합 검사와 `db advisors --local --type security --level warn --fail-on error`를 확인한다.

## 환경·worker·배포

- 키 값은 문서·로그·커밋에 넣지 않는다. OpenAI 키와 Supabase 서버 키는 서버에서만 사용하고 `NEXT_PUBLIC_`에 넣지 않는다. `SUPABASE_SERVER_URL`은 서버용 내부 주소이며 공개 주소·쿠키 식별과 구분한다.
- 영수증 저장·취소 직후 파일 삭제를 시도하고 실패 시 worker가 재시도한다. 생성 전 중단 업로드는 125분, 방치한 초안은 24시간 기준으로 정리한다. staging 재업로드 경합·중복 전송 방지를 보존한다.
- 로컬 worker: `npm run dev:worker`. 독립 실행: `npm run build:worker` → `npm run start:worker`. 운영 Vercel은 Supabase 예약 작업이 인증된 worker API를 호출한다.
- **명시적 배포 요청 전 push·Vercel 배포·클라우드 마이그레이션 금지.** 승인된 `dev` push 통합 배포는 [배포 안내](../docs/deployment-pipeline.md)를 따른다. 검증·운영 빌드 → DB 마이그레이션 → Vercel 배포 순서이며 Git 직접 배포와 중복 실행하지 않는다. 이번 설정이 최초 push되기 전에는 기존 Vercel 자동 배포가 유지된다. 대상·환경변수와 미적용 마이그레이션을 먼저 확인한다.
- **Realtime:** `20261029073618_inventory_realtime.sql`의 비공개 수신 정책·DB 트리거가 프런트 배포 전에 필요하다. 로컬에서는 Realtime 컨테이너도 실행되어 있어야 한다. 연결 실패는 화면에 표시하고 3초 폴링으로 돌아가지 않는다. 상세 운영·검증은 [Realtime 안내](../docs/inventory-realtime.md)를 참고한다.

## 실제 화면 검증

- 브라우저 접근이 거부되면 다른 브라우저·origin·포트·CDP로 우회하지 않는다. 사용자가 접근 권한을 변경한 뒤 재확인한다. 페이지가 열려 있는 것과 에이전트 접근 승인은 별개다.
- 내장 브라우저 권한은 설정의 Browser → Agent permissions에서 관리한다([공식 안내](https://learn.chatgpt.com/docs/browser)). 실제 UI 검증·모바일 카메라 선택·푸시 수신은 환경과 권한이 갖춰진 경우에만 완료로 기록한다.

## 상세 문서

- 운영 환경변수·초기화·장애 대응: [운영 문서](../docs/operations.md)
- 두 계정·실기기 검증: [인수 체크리스트](../docs/acceptance.md)
- 알림 스케줄: [알림 설계](../docs/notification-schedules.md)
- 실제 AI 측정: [AI 평가](../docs/ai-evaluation.md)
- 과거 설계·구현 근거: `docs/superpowers/specs/`, `docs/superpowers/plans/` (작업 관련 문서만 읽고 현재 코드와 대조)
