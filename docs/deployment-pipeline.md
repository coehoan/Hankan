# dev push 통합 배포 설정

dev push는 아래 워크플로를 실행한다. 로컬 수정은 커밋과 push 전까지 운영에 반영되지 않는다. 설정을 확인하기 위해 운영 마이그레이션이나 배포를 실행하지 않는다.

## 최초 등록: GitHub Secrets

[Hankan 저장소 Actions 설정](https://github.com/coehoan/Hankan/settings/secrets/actions) → **Secrets and variables → Actions → Secrets → New repository secret**에 다음 세 개를 등록한다. 채팅, Git, .env.local에 넣을 값이 아니다.

| 이름 | 넣을 값 | 가져오는 곳 |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase 개인 액세스 토큰 | [Supabase 계정 Access Tokens](https://supabase.com/dashboard/account/tokens)에서 생성 |
| `SUPABASE_DB_PASSWORD` | Hankan 프로젝트 Database password | 프로젝트 생성 시 설정한 DB 비밀번호. API publishable/secret/service_role 키와 다름 |
| `VERCEL_TOKEN` | Hankan 팀에 접근 가능한 Vercel 토큰 | [Vercel 계정 Tokens](https://vercel.com/account/settings/tokens)에서 생성. 가능하면 Hankan 팀 범위와 필요한 만료 기간을 사용 |

기존 서비스의 Supabase API 키·OpenAI 키·VAPID·worker 비밀은 Vercel Production 환경변수에 그대로 둔다. 워크플로가 `vercel pull --environment=production`으로 읽는다. 운영 API 키를 GitHub 테스트 환경으로 복사하지 않는다.

현재 CLI는 팀 정보도 조회하므로 Vercel 토큰 Scope는 **Hankan → All Projects**를 사용한다. 개별 프로젝트에 한정한 토큰은 팀 조회가 제한될 수 있다. 스크립트는 검증된 `VERCEL_ORG_ID`·`VERCEL_PROJECT_ID`로 대상을 지정하고, 팀 토큰에서 불필요한 개인 사용자 조회를 유발하는 `--scope`를 전달하지 않는다.

## 최초 등록: GitHub Variables

같은 화면 **Variables → New repository variable**에 아래 공개 식별자를 등록한다.

| 이름 | 값 |
| --- | --- |
| `SUPABASE_PROJECT_ID` | `wtwvmerpucfdodieawul` |
| `VERCEL_ORG_ID` | `team_IzPoeQVchAzgQstQ4lF48zg1` |
| `VERCEL_PROJECT_ID` | `prj_2ZphxQuQiaPo8vJ8Vn8AZ8Yyoqbt` |

잘못된 대상이나 누락된 값이 있으면 운영 작업을 시작하기 전에 실패한다. 프로젝트를 바꿀 때에는 변수만 바꾸지 말고 `scripts/release-production.mjs`의 대상 검증도 함께 검토한다. 저장소의 GitHub Actions 실행이 허용되어 있어야 한다.

## dev push 이후 순서

1. 저장소·브랜치·대상·자격 증명을 검사한다. 다른 저장소/브랜치/PR에서는 운영 실행을 하지 않는다.
2. 고정된 Node24.15.0과 프로젝트 lockfile로 의존성을 설치한다. Supabase CLI는 프로젝트의2.122.0, Vercel CLI는65.7.0을 사용한다.
3. GitHub 러너의 폐기용 로컬 Supabase를 실행한다. `.env.test.local`은 loopback API와 임시 키만으로 생성한다. 기존 파일이 있으면 덮어쓰지 않는다.
4. 릴리스 로직·형식·린트·타입·단위·DB·통합·worker 빌드를 확인한다. 유료 실제 AI 검사는 실행하지 않는다.
5. Vercel Production 설정을 읽고 운영 앱을 빌드한다. 결과물과 연결 프로젝트·DB·사이트 주소가 한칸 대상인지 확인한다.
6. Supabase를 지정 프로젝트에 link하고 `db push --linked --dry-run`으로 미적용 목록을 확인한 뒤 `db push --linked --yes`로 적용한다.
7. 성공한 경우에만 같은 prebuilt 결과물을 Vercel Production으로 배포한다.

`vercel.json`은 **dev의 Git 직접 배포만 비활성화**한다. 다른 브랜치의 설정은 바꾸지 않는다. 따라서 이 파일과 workflow는 함께 push해야 한다. 이후 배포 주체는 GitHub Actions이고 Vercel은 배포 실행 대상이다. 기존 Vercel Git 연결·Production 환경변수·도메인은 유지한다. 기존 Vercel Deploy Hook이나 수동 배포는 이 순서를 보장하지 않으므로 운영 릴리스에 사용하지 않는다.

배포 동시 실행은 막고 실행 중인 작업을 새 push로 취소하지 않는다. 대기 중인 예전 push가 더 최신 push로 대체될 수 있으며, 최신 커밋에 누적된 모든 미적용 마이그레이션이 순서대로 적용된다.

## 실패와 복구

- 검사·빌드·대상 검증 실패: 운영 DB와 앱은 변경하지 않는다.
- 마이그레이션 실패: 앱 배포를 시작하지 않는다. 앞서 성공한 마이그레이션은 남을 수 있으므로 실행 로그와 이력을 확인하고 새 수정 마이그레이션을 추가한다.
- 앱 배포 실패: 적용된 DB 변경은 자동으로 되돌리지 않는다. 기존 앱과 호환되는 추가 위주의 DB 변경을 작성한다. 이미 적용한 migration 파일을 수정해 재실행하려 하지 않는다.
- 자격 증명/변수 누락: 기존 Vercel 직접 배포로 우회하지 말고 등록을 완료한 뒤 현재 dev 커밋의 작업을 다시 실행한다. 오래된 커밋의 실행을 재시도하면 과거 앱을 배포할 수 있으므로 먼저 실행 커밋을 확인한다.
- `vercel pull`에서 `User not found (404)`: 이전 `--scope` 옵션과 팀 범위 토큰의 개인 사용자 조회 충돌을 확인한다. 해당 옵션을 제거한 최신 커밋으로 실행해야 한다. 여전히 실패하면 Vercel 토큰의 만료·회수 여부와 Hankan 팀 접근 범위를 확인하고 GitHub `VERCEL_TOKEN`을 갱신한다. 실제 토큰 값을 로그나 채팅으로 보내지 않는다.
- prebuilt 배포에서 `.env.example` 등의 `ENOENT` 또는 `.vercelignore` 충돌: 환경파일이 Next.js 파일 추적에 포함된 경우다. `next.config.ts`의 `outputFileTracingExcludes`로 루트 `.env*`를 빌드 파일 목록에서 제외한다. `.vercelignore`의 환경파일 제외 규칙은 유지한다. 수정 후 새로 빌드한 결과물을 배포하며, 앞서 적용된 DB 마이그레이션은 다음 실행에서 다시 적용하지 않는다.
- 결과는 GitHub **Actions → Deploy Hankan production**에서 확인한다. 실제 운영 로그·사이트·DB 상태 점검은 첫 승인 배포 후 별도로 수행한다.

DB reset, seed, 자동 migration repair, 강제 rollback, 운영 데이터 복사는 수행하지 않는다. 배포용 토큰과 DB 비밀번호는 테스트·앱 빌드 명령에 전달하지 않고 필요한 자식 프로세스에만 전달한다. 비밀 파일과 prebuilt 산출물을 GitHub artifact로 업로드하지 않는다.

## 로컬 검증

`npm run test:release`는 가짜 command runner와 읽기 fixture로 순서·실패 중단·잘못된 대상 차단·키 전달 범위를 확인한다. 실제 운영 CLI를 실행하지 않는다. `scripts/release-production.mjs`는 GitHub의 원본 저장소 dev push 환경과 모든 필수 값을 확인하며, 명시적인 `--execute` 없이 배포하지 않는다. 로컬에서 환경변수를 흉내 내 실제 배포를 시도하지 않는다.

참고: [Supabase GitHub Actions 가이드](https://supabase.com/docs/guides/deployment/managing-environments), [Vercel GitHub Actions](https://vercel.com/docs/git/vercel-for-github), [Vercel Git 배포 설정](https://vercel.com/docs/project-configuration/git-configuration).
