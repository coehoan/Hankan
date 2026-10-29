# 식재료 목록 Realtime 운영

## 동작

3초 주기 GET은 없다. 브라우저는 현재 냉장고의 private 채널 `fridge:<uuid>:inventory`에서 `inventory_changed`를 수신한다. DB 트리거는 ingredients 및 fridge_members의 INSERT/UPDATE/DELETE가 커밋될 때 빈 `{}` payload만 보낸다. 멤버 변경도 목록 API를 재검증하게 하므로 제외된 멤버의 화면을 지울 수 있다.

Realtime 버전에 따라 `realtime.send`가 payload에 임의의 메시지 UUID(`id`)를 추가할 수 있다. 이 값은 재료·회원 ID와 관계없는 전송 메타데이터이며, 클라이언트는 payload를 목록에 적용하지 않는다.

브라우저는 신호를 150ms 동안 묶고 기존 GET API를 호출한다. 조회 중에 온 신호는 조회 후 한 번 더 반영하고 저장 중에 온 신호는 저장 후 재조회한다. 첫 진입·구독 완료/재연결·화면/온라인 복귀·본인 저장 후에도 확인한다. 숨김·오프라인·냉장고 전환·unmount에서 구독과 지연 작업을 정리한다. 로그아웃 또는 API의 401/403은 목록을 지운다. 연결 오류 시 사용자가 볼 수 있는 안내와 새로고침은 유지하며, 주기 조회를 재개하지 않는다.

Realtime 권한은 구독/JWT 갱신 시 평가되어 캐시된다. 제외된 멤버가 토큰 만료 전까지 변경 신호를 받을 가능성을 고려하여 재료·회원 식별자나 상세값을 payload에 넣지 않는다. 모든 데이터 조회·수정은 기존 HTTP/DB 권한 검사로 보호한다. 브라우저가 변경 신호를 직접 발행하도록 하는 INSERT 정책은 만들지 않는다.

## 나중에 배포할 때

사용자가 배포를 요청한 뒤에만 진행한다.

1. 대상 클라우드의 기존 미적용 마이그레이션을 먼저 확인하고 `20261029073618_inventory_realtime.sql`을 적용한다. 기존 `realtime.messages` 정책이 더 넓은 권한을 허용하는지도 확인한다.
2. Realtime이 활성화되어 있고 WebSocket이 허용되는지 확인한다. 클라이언트는 항상 `private: true`를 사용한다. 이 서비스만 사용하는 프로젝트라면 Realtime 설정의 Allow public access도 끄는 것을 권장한다.
3. DB 준비 후 프런트를 배포한다. 별도 SSE 서버·새 키·ingredients의 Postgres Changes publication 등록은 필요 없다.
4. 소유자/멤버 두 세션에서 추가·남은 양 수정·삭제·멤버 제외·화면 복귀를 확인한다. 유휴 상태에서 ingredients GET이 3초마다 발생하지 않아야 한다. WebSocket heartbeat는 목록 폴링과 별개다.

DB를 준비하기 전에 프런트만 배포하면 기본 목록 조회·수정은 가능해도 자동 갱신은 작동하지 않으며 연결 오류가 표시될 수 있다.

## 로컬 검증

- `npm run db:start`와 함께 로컬 Realtime 서비스가 실행되어 있어야 한다. 이미 일부 컨테이너만 실행 중이면 `supabase start`가 빠진 서비스를 추가하지 않을 수 있다. 기존 DB를 reset하거나 사용자 데이터를 삭제하지 않는다.
- `npm run test:db`는 수신 정책, 트리거, 소유자/멤버 수신·비회원 차단·발행 금지를 검사한다.
- `npm run test:integration -- tests/integration/inventory-realtime.test.ts`는 실제 loopback Supabase WebSocket과 DB 변경을 사용한다. 현재 테스트는 키/토큰을 출력하지 않고 테스트 계정·냉장고만 만들었다가 정리한다.
- 관련 훅/구독 단위 테스트는 유휴 조회 없음, 연속 이벤트 병합, 진행 중 조회/저장, 숨김/오프라인, 냉장고 전환, 로그아웃, 재연결 및 구독 정리 경합을 검사한다.

공식 문서: [Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization).
