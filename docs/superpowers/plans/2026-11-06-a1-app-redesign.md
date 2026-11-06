# A1 전체 화면 적용 계획

> **For agentic workers:** Use superpowers:executing-plans inline; Hallmark finish review uses one fresh reviewer.

**Goal:** 승인된 A1 화이트 에어 시안을 한칸 전체 화면에 적용한다.

**Architecture:** 기존 컴포넌트의 기능 계약을 유지한다. 마지막으로 불러오는 `src/app/design-system.css`에서 A1 토큰과 화면별 표현을 관리하며 기존 입력·동기화·접근성 처리를 보존한다.

**Tech Stack:** Next.js 16, React 19, CSS, Pretendard, 기존 SVG.

**Spec:** 승인된 `work/hallmark-a-variations/a1.html`과 `a1.css`.

## 제약

- 배포·push·클라우드 변경 없음. 환경파일과 기존 검색 아이콘 변경 보존.
- 냉장고 로고·108종 SVG·Pretendard·라이트/다크/시스템 테마 유지.
- 배경 #f4f7f4, 카드 #fcfefb, 보조 #e6eee6, 글자 #263c2f, 보조 글자 #596e5c, 강조 #346548, 카드 24px, 입력 12px.
- PC 재료 카드 두 열, 휴대폰 한 열. 72px 그림, 카드 간격 12px, 작업 영역 간격 40px.
- 거부된 앱 origin 브라우저 접근 없음. 오프라인 fixture 렌더와 실제 앱 확인을 구분.

## 검토 초점

320px 긴 이름·100%·날짜·검색 넘침, 모달 높이·스크롤·포커스, 다크/시스템 대비, native 날짜/시간 폭, 기존 권한·동기화·추천·저장 동작.

## 실행

- [x] `src/app/design-system.css` 추가, `src/app/layout.tsx` 마지막 CSS import 연결. 공통 토큰·컨트롤·카드·모달·인증·공유·영수증·추천·설정 적용.
- [x] 재료 그룹을 grid로 전환. 기존 수정·슬라이더·삭제 핸들러 보존. `.agents/architecture.md` 갱신.
- [x] 실제 컴포넌트의 오프라인 fixture로 모바일·PC·다크·네 상태·모달 렌더 검사. Hallmark 검사와 fresh finish review.
- [x] 기존 단위 테스트, 타입·린트·변경 파일 포맷, CSS 빌드 검사. 스타일 복제 테스트 추가 없음.
- [x] 결과와 미검증 범위를 보고. 커밋·배포는 별도 요청 전 수행하지 않음.

## 검증 기록 · 2026-11-06

- 단위 테스트 최종 전체 실행: 45개 파일, 452개 통과. 첫 실행에서 기존 관리자 CLI 테스트 하나가 5초 제한을 초과했으나 단독 재실행과 최종 전체 재실행 모두 통과했다.
- TypeScript와 ESLint 성공. 기존 경고 3개 유지. 변경 파일 Prettier와 `git diff --check` 성공.
- `next build` 성공: 프로덕션 컴파일, 타입 검사, 15개 정적 페이지 생성 완료. 배포 명령은 실행하지 않았다.
- 실제 React 컴포넌트에 가짜 상태만 주입한 오프라인 fixture 17종을 320/375/1440px에서 51회 렌더했다. 가로 넘침, 화면 밖 입력창, 깨진 이미지 0건. 목록은 모바일 한 열/PC 두 열이다.
- 라이트·다크 목록, 계정/알림 설정, 관리, 레시피/상세, 재료 등록/수정, 영수증 업로드/검토, 인증, 로딩/빈 목록/오류 상태를 확인했다. 추가한 인증 fixture 제목 중복은 제거했다. 앱 컴포넌트의 중복 제목은 아니었다.
- Hallmark 신규 `design-system.css` 정적 검사: 0 FAIL, 0 REFLEX, 7 WARN. 밝은 accent-ink는 녹색 버튼 위에 사용하고, 카드 글자는 테마의 foreground를 상속한다. 같은 입력/카드 외형은 승인된 A1의 공통 컴포넌트 규칙이므로 유지했다.
- 기존 CSS를 모두 합친 fixture의 정적 검사는 덮어쓰기 전 선언까지 분석하여 25 FAIL/287 REFLEX/24 WARN을 보고했다. 전체 기존 CSS를 정리한 검사 통과로 보고하지 않는다. 렌더 검사와 실제 적용되는 새 CSS/캐스케이드를 별도로 검토했다.
- 별도 fresh finish reviewer 판정 `ship`: 검토한 화면과 CSS 캐스케이드에서 확인된 수정 사항 없음.
- 미검증: 실제 계정으로 사용하는 앱의 브라우저 동작과 실제 휴대폰의 native 날짜/시간 선택기. 거부된 앱 origin에 접근하지 않았으며 fixture는 서버/API/DB를 호출하지 않는다.
- 증거는 gitignored `work/a1-*.log`, `work/a1-app-fixtures/render-checks.json`, `work/a1-app-fixtures/shots/`에 보관한다. 환경파일·데이터·런타임·배포 설정 변경 없음.
