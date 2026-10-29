<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 한칸 작업 안내

식재료·유통기한을 함께 관리하는 PWA. Next.js App Router / React / TypeScript / Supabase / OpenAI를 사용한다.

### 항상 지킬 것

- 시작할 때 `git status`와 기존 실행 환경을 확인하고 사용자 변경·데이터·환경파일을 보존한다.
- **사용자가 배포를 명시적으로 요청하기 전에는 push·배포·클라우드 DB 변경을 하지 않는다.** `dev` push는 운영 배포를 유발한다. 승인된 GitHub Actions 전환 설정은 [배포 안내](docs/deployment-pipeline.md)를 따른다. 배포 연동을 임의로 끄거나 변경하지 않는다. 로컬 커밋은 가능하다.
- `.env.local`은 클라우드를 가리킬 수 있다. 덮어쓰지 말고, DB 테스트는 `.env.test.local`의 loopback Supabase만 사용한다. 키·토큰·비밀번호를 출력하거나 커밋하지 않는다.
- 기존 패턴을 따르고 변경 파일만 포맷한다. 변경 범위에 맞게 검증하고, 실제 화면·실기기 확인과 자동 테스트 결과를 구분해 보고한다.
- 관련 실행 방법이나 주요 동작을 바꾸면 아래 안내도 함께 갱신한다. 과거 단계별 문서보다 현재 코드와 검증 결과를 우선한다.

### 필요할 때 읽기

- 처음 실행하거나 검증할 때: [개발·테스트](.agents/development.md)
- 기능을 수정하거나 코드를 찾을 때: [구조·핵심 동작](.agents/architecture.md)
- DB·권한·사진·worker·배포를 다룰 때: [DB·운영](.agents/operations.md)
