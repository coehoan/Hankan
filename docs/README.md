# 문서 지도

현재 기준일: 2026-11-06. 새 에이전트는 [인수인계](handoff.md)와 루트 [AGENTS.md](../AGENTS.md)를 먼저 읽는다. 동작의 최종 근거는 현재 코드이며, 검증 기록에는 검사 날짜·커밋·환경의 범위가 있다.

## 현재 실행·동작 안내

| 목적 | 문서 |
| --- | --- |
| PC 이동, 현재 릴리스, 남은 확인 사항 | [인수인계](handoff.md) |
| 개발 실행·검증 명령 | [개발·테스트](../.agents/development.md) |
| 코드 위치·보존할 기능 | [구조·핵심 동작](../.agents/architecture.md) |
| DB 변경·운영 안전 수칙 | [에이전트 운영 안내](../.agents/operations.md) |
| 환경변수·worker·장애 복구 | [운영](operations.md) |
| dev push, Secrets/Variables, DB→앱 배포 | [배포 파이프라인](deployment-pipeline.md) |
| AI 추천 접수·저장 내역·완료 푸시 | [비동기 추천](async-recipes.md) |
| 과거 식약처 추천 내역 호환 | [레시피 DB](foodsafety-recipes.md) |
| 재료 변경 신호·권한·로컬 Realtime | [Realtime](inventory-realtime.md) |
| 개인 알림 시각·예약 계산 | [알림 일정](notification-schedules.md) |
| SVG 범위·이름 연결·추가 방법 | [재료 일러스트](ingredient-illustrations.md) |

## 검증 기록과 과거 설계

- [인수 체크리스트](acceptance.md): 최신 릴리스 검사와 실제 기기에서 남은 절차. 과거 검사 숫자를 현재 검사 결과로 재사용하지 않는다.
- [AI 평가](ai-evaluation.md): 2026-10-28 실제 API 평가와 당시 비용·품질의 기록. 현재 코드의 새 추천은 AI만 사용한다.
- [11단계 리뷰](release-review.md): 2026-10-28 결함·수정 근거. 최신 릴리스 승인 상태를 나타내지 않는다.
- [설계·구현 기록](superpowers/README.md): 날짜별 승인 범위·결정·당시 검증을 보존한다. 문서 안의 실행 지시·미완료 체크박스·당시의 배포 금지는 새 작업 지시나 현재 상태가 아니다. 현재 사용자 요청과 AGENTS.md를 따른다.

폰트의 출처·라이선스는 [폰트 안내](../public/fonts/README.md), 커밋 규약은 [프로젝트 스킬](../.agents/skills/project-git-commit-korean-convention/SKILL.md)을 참고한다.
