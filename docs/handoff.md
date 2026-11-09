# 현재 상태와 다른 PC 인수인계

기준일: 2026-11-09. A PC에서 B PC로 옮긴 뒤 작업한 재료 목록과 화면 개편까지 반영한 기록이다. 루트 AGENTS.md와 함께 읽고, 시작할 때 실제 Git·환경·배포 상태를 다시 확인한다.

## 저장소와 완료한 릴리스

- 원격: `https://github.com/coehoan/Hankan.git`, 작업·Production 브랜치: `dev`.
- 앱: https://hankan-murex.vercel.app. A1 원본 정렬과 정적 파일 캐시 수정은 `649997a`의 [Actions 실행](https://github.com/coehoan/Hankan/actions/runs/42193430376) 성공과 Vercel READY를 확인했다.
- Supabase 프로젝트 `wtwvmerpucfdodieawul`에 `20261106022629_async_recipe_jobs.sql`까지 적용했다. 매분 `hankan-worker-every-minute` 예약이 활성인 것을 확인했다. 이미 적용한 SQL을 재실행하거나 이력을 임의로 repair하지 않는다.
- 이번 릴리스에는 목록 아코디언과 더 보기 `977c9dd`, 화면 개편 `a2b9e91`, 프로필 메뉴 정리 `38a3173`이 포함된다. 운영 반영 여부는 이 문서 커밋의 [Actions 결과](https://github.com/coehoan/Hankan/actions/workflows/production.yml)와 Vercel READY를 확인한다. 이번 변경에 신규 마이그레이션은 없다.
- B PC에서는 개발 중 생성된 `next-env.d.ts` 변경을 커밋에서 제외했다. 환경파일·로컬 데이터·`work/` 자료를 보존했으며 미완료 기능 구현은 없다. 다음 기능은 새 사용자 요청에 따라 진행한다.

현재 구현은 일반 아이디 인증, 공동 냉장고·24시간 초대, 구매 묶음별 재료·기한·남은 양, private Realtime 목록 갱신, 영수증 확인 후 AI 분석·명시적 저장, 라이트/다크/시스템 화면과 자체 SVG 108종, 식약처·AI 비동기 추천, 본인 추천 내역·완료 알림이다. 출처·AI 표시는 사용자 목록·상세에서 숨긴다.

상단 주 메뉴에서 식재료·요리 추천·추천 내역을 연다. 계정 메뉴는 마이페이지·냉장고 관리·로그아웃을 제공한다. 식재료 화면 상단에 냉장고 요약과 직접 등록·영수증 등록 버튼이 있다. 목록의 기한 지남과 임박 구역은 기본으로 펼치고, 더 보기로 구역마다 5개씩 추가한다. 서비스 워커는 개발 CSS의 캐시 재검증 지시를 따르고 운영 immutable 파일과 공개 파일의 오프라인 사용을 유지한다.

## B PC에서 시작하기

1. 저장소를 clone하거나 기존 checkout에서 사용자 변경을 확인한 뒤 `dev`를 fast-forward 갱신한다. 충돌이 있으면 기존 변경을 보존한다. 루트 AGENTS.md → 이 문서 → `.agents/development.md` 순서로 읽는다.
2. Node `>=24.15.0 <25`, Git, Docker Desktop을 준비하고 루트에서 `npm ci`를 실행한다. Windows 실행 정책 문제가 있으면 `npm.cmd`를 사용한다. lockfile의 패키지를 유지한다.
3. A의 `.env.local`은 클라우드를 사용했다. 파일이 Git에 없다는 이유로 값을 추측하거나 테스트에 운영 키를 쓰지 않는다. 필요한 값은 사용자에게 안전한 별도 경로로 받거나 B의 새 로컬 환경을 만든다. 이미 있는 환경파일을 덮어쓰지 않는다.
4. 로컬 개발·DB 검사는 Docker와 `npm run db:start`로 B 자체의 Supabase를 준비한다. Realtime을 제외하지 않는다. 기본 API/DB 포트는 54321/54322, 프로젝트 이름은 `hankan`이다. 기존 같은 이름 컨테이너·포트가 있으면 먼저 대상을 확인하고 재사용한다. A의 Docker 데이터가 clone으로 이동하지 않는다.
5. 로컬 Supabase 상태에서 확인한 URL·공개 키·service role을 B의 로컬 환경에 입력한다. 상태 출력에는 비밀이 있으므로 채팅·로그·문서로 붙이지 않는다. `.env.test.local`에는 loopback URL과 그 로컬 프로젝트 키만 넣는다. 기존 DB는 reset하지 않고 필요한 경우 `node scripts/supabase.mjs migration up --local`로 미적용분만 반영한다.
6. `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`과 실제 접속 origin을 맞춘 후 `npm run dev`. 복구·사진 정리까지 개발할 때는 같은 **로컬 DB**를 가리키는 `npm run dev:worker`를 별도로 실행한다. 운영 DB를 가리키는 worker를 B에서 임의로 띄우지 않는다.
7. 변경에 맞는 [검증 명령](../.agents/development.md)을 실행한다. 브라우저·실기기 권한은 현재 환경에서 확인하고, 기존 거부를 다른 origin·포트·CDP로 우회하지 않는다.

### 환경파일의 경계

`.env.example`이 변수 이름의 기준이다. 최소 웹/DB 연결은 `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, 서버용 `SUPABASE_SERVICE_ROLE_KEY`다. AI 분석·추천에는 `OPENAI_API_KEY`, 카탈로그에는 `FOODSAFETY_API_KEY`, 푸시에는 VAPID 공개/개인 키와 실제 `VAPID_SUBJECT`를 사용한다. `SUPABASE_SERVER_URL`은 선택적 서버 내부 주소이고 `WORKER_SECRET`은 예약 HTTP 호출 인증용이다. 비밀은 `NEXT_PUBLIC_`에 넣지 않는다.

`.env.test.local`에는 `.env.example` 중 사이트·Supabase URL·공개 키·service role·서버 URL을 로컬 값으로 지정한다. 통합 검사는 원격 URL을 거부한다. `scripts/ci-test-env.mjs`의 실행 진입점은 CI 전용이므로 B 설정용으로 GitHub 환경을 흉내 내지 않는다. 기본 회귀 검사는 실제 OpenAI 호출을 하지 않는다.

### clone으로 옮겨지지 않는 것

- `.env*`(예제 제외), `.vercel/`, `work/`, `.serena/`, `.superpowers/`, 의존성·빌드 결과·로컬 캐시·Docker 데이터.
- `work/`의 Hallmark 시안·스크린샷·테스트 로그·원격 시각화 진단은 앱 실행 필수 파일이 아니다. 필요하면 사용자가 별도로 복사한다. 앱의 최종 디자인 CSS·SVG·폰트는 Git에 있다.
- 프로젝트 커밋 스킬은 `.agents/skills/`에 추적된다. 개인 설치 Hallmark·Superpowers·도구 플러그인과 MCP 인증은 별도 PC 설정이다. 실제 사용 가능한 스킬·권한을 확인한다.
- GitHub Actions Secrets/Variables와 Vercel Production 설정은 서비스 측에 유지된다. clone 때문에 다시 만들거나 값을 B 로컬 로그에 추출할 필요가 없다.

## 검증 근거와 남은 확인

이번 A1 정렬 릴리스의 B PC 로컬 검증은 단위 473건, pgTAP 125건, 통합 132건 통과와 선택적 실 API 2건 스킵이다. 릴리스 보호 테스트 59건, 타입·형식 검사, 격리된 Turbopack 운영 빌드와 worker 빌드를 통과했다. 린트 오류는 없고 변경하지 않은 파일의 기존 경고 3건이 남았다. DB 검사는 `.env.test.local`의 loopback Supabase에서 수행했다. 로컬 브라우저에서 375px 모바일 헤더와 데스크톱 화면을 확인했으며 이는 실제 모바일 기기 검증과 구분한다. 로그·캡처는 B의 `work/release-20261106-a1/`, `work/a1-original-alignment-20261106/`에 있고 Git에는 포함하지 않는다.

이전 비동기 릴리스의 로컬 검증은 단위 467건, pgTAP 125건, 통합 132개 고유 사례다. 통합 최초 실행의 Realtime 실패 1건은 중지된 로컬 Realtime 컨테이너를 복구한 후 해당 사례가 통과했다. 선택적 실 API 2건은 스킵이며 통과에 포함하지 않는다. 타입·린트·형식·앱/worker 빌드와 로컬 DB 보안 검사를 확인했고 배포 Actions도 성공했다. 이 수치는 A PC의 당시 기록이며 위 B PC 재검증과 구분한다.

배포 후 로그인 페이지, A1 CSS·SVG·서비스 워커 파일 일치, 미인증 추천 API 401/private,no-store를 확인했다. 합성 데이터를 쓴 오프라인 실제 컴포넌트 캡처도 확인했다. **실제 로그인 계정의 운영 비동기 추천 전 과정, 모바일 네이티브 날짜/시간 선택기, 실제 기기 완료 푸시·탭 이동은 별도 확인이 남아 있다.** [인수 절차](acceptance.md)에 결과를 기록한다.

## 원격 Codex 시각화 문제

A에서는 같은 Hallmark HTML이 열리지만 B의 Codex 원격 연결에서는 `Error: Invalid visualization read request`가 발생했다. 앱 사이트의 오류로 재현된 것은 아니다. 설치된 Codex의 Windows 원격 경로 검증 PowerShell 호출에서 읽기 전용 재현 오류를 확인했으나 실제 B의 실패 IPC 요청과 동일 분기인지는 확인하지 못했다. HTML 복사·경로 변경으로 해결됐다고 기록하지 않는다. 설치 앱·정책을 패치하거나 정상 앱 디자인을 변경하지 않는다. 이 문제는 Hankan 기능 수정과 분리해 다룬다.

## 다음 배포

사용자의 새 명시적 요청이 있어야 push·배포·클라우드 변경을 진행한다. `dev` push는 문서 변경만 있어도 [통합 배포](deployment-pipeline.md)를 실행한다. 별도 직접 배포로 우회하거나 workflow를 끄지 않는다. 커밋 요청만으로 push 승인까지 확대하지 않는다.
