# dev push 통합 배포

사용자 요청: dev push 시 미적용 DB 마이그레이션과 앱을 함께 순서대로 배포하도록 설정한다. 지금은 배포하지 않는다. 필요한 자격 증명 등록 위치를 안내한다.

- `coehoan/Hankan`의 `refs/heads/dev` push만 운영 배포한다. GitHub Actions가 검사 → 운영 빌드 → 마이그레이션 → Vercel prebuilt 배포를 순서대로 수행한다.
- `vercel.json`은 dev Git 자동 배포만 끈다. 다른 브랜치의 기존 동작은 유지한다. 설정 파일은 아직 push하지 않는다.
- 동일 운영 환경 배포는 동시에 실행하지 않고, 실행 중인 배포를 새 push 때문에 중간 취소하지 않는다.
- 검사에는 단위·DB·로컬 통합·형식·타입·린트가 포함된다. DB 테스트 자격 증명은 CI의 폐기용 loopback Supabase에서 생성한다. 운영·OpenAI 키를 테스트에 넣지 않는다.
- GitHub Secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, VERCEL_TOKEN. Repository Variables: SUPABASE_PROJECT_ID, VERCEL_ORG_ID, VERCEL_PROJECT_ID. 프로젝트 값은 기존 한칸 대상과 일치해야 한다.
- Vercel 운영 환경변수는 Vercel pull로 읽는다. 실제 빌드 결과·연결 대상·Supabase URL을 확인한 뒤에만 DB 쓰기를 수행한다.
- 마이그레이션은 CLI history에 없는 파일만 적용한다. reset, seed, 자동 history repair, 운영 데이터 복사, 기존 migration 수정 재실행은 하지 않는다.
- 앞 단계 실패 시 뒤 단계는 실행하지 않는다. 적용된 DB 변경의 자동 rollback은 하지 않는다. 기존 앱과 호환되는 DB 변경이 필요하다.
- 워크플로·스크립트는 로컬에서 가짜 command runner로 실패 순서와 대상 차단을 검증한다. 원격 workflow 실행, 실제 운영 link/push/deploy, 키 발급·등록은 이번 작업에서 하지 않는다.
