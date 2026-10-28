# 한칸 운영과 worker

## 로컬 실행

Node 24.15 이상(25 미만), 로컬 Supabase를 사용한다. `npm run dev`와 `npm run dev:worker`를 각각 실행한다. worker는 60초 간격이며 한 주기가 끝나기 전 다음 주기를 실행하지 않는다. `npm run build:worker` 후 `node dist/worker.cjs --once`로 한 주기만 실행할 수 있다. 배포 웹은 `npm run build` 후 `npm start`, worker는 `npm run start:worker`로 별도 실행한다. HTTP cron URL이나 비밀 토큰은 사용하지 않는다.

`.env.local`에 기존 Supabase 설정과 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`를 설정한다. 로컬용 키는 생성되어 있다. 배포마다 별도 키를 생성하고 subject에는 실제 연락 가능한 `mailto:` 주소 또는 HTTPS 주소를 사용한다. 키를 바꾸면 기존 브라우저 구독을 다시 연결해야 한다. 개인 키·service role 키는 공개 저장소, 로그, 클라이언트 번들에 넣지 않는다. VAPID가 없으면 푸시는 처리하지 않고 사진 정리만 실행한다.

## PWA와 브라우저 알림

알림 설정에서 일정을 켜고 시각을 저장한 후 **브라우저 알림 연결**을 누른다. 자동 권한 팝업은 없다. 각 브라우저에서 별도로 연결한다. 해제는 현재 브라우저만, 일정 끄기는 계정의 모든 서버 구독을 해제한다. 로그아웃 때 현재 브라우저 서버 구독과 native 구독, 개인 식별 정보를 정리한다. 다시 켜거나 로그인한 뒤에는 브라우저 알림을 다시 연결한다.

실기기는 HTTPS가 필요하다(localhost 개발 예외). iOS/iPadOS 16.4 이상은 Safari 공유 메뉴에서 홈 화면에 설치한 앱을 열어야 웹 푸시를 연결할 수 있다. 권한을 거부했다면 OS/브라우저의 해당 사이트 알림 권한을 변경한다. 실제 지원 기기의 수신·해제·탭 이동 검증은 11단계 릴리스 체크에 포함한다.

구독 endpoint는 Google FCM, Mozilla Push, Apple Web Push, Windows notify/wns 도메인의 HTTPS 주소만 허용한다. 임의 URL을 worker가 호출하지 않도록 DB와 전송 계층에서 검사한다. 새 push 공급자가 필요하면 검증 후 두 allowlist를 함께 갱신한다.

## 재시작과 중복 방지

사용자+현지 날짜의 작업이 유일하다. DB 잠금과 5분 임대, 갱신되는 임대 토큰으로 여러 worker를 보호한다. 전송 직전마다 현재 일정, 멤버십, 재료와 구독을 확인한다. 죽은 worker의 임대는 다음 worker가 회수한다. HTTP 성공 후 기록 전 장애가 나면 재전송될 수 있으나 서비스 워커의 안정적인 notification ID/tag 및 IndexedDB 유일 키로 중복 표시를 막는다. 브라우저 저장소를 사용자가 지우면 이전 표시 기록도 지워진다.

404/410 endpoint는 삭제한다. 다른 오류는 최대 10회, 60초부터 지수 증가(최대 1시간)로 재시도하며 다음 현지 날짜에는 이전 작업을 버린다. 한 구독의 실패가 다른 구독을 막지 않는다. 일부만 성공했어도 그날 새 작업은 만들지 않고 실패 구독만 재시도한다. 실제 발송 없이 종료된 작업은 아직 남아 있는 새 시각을 저장하면 같은 날짜로 재예약한다.

푸시에는 원문 재료 이름·사진 없이 개수와 일반 안내만 포함한다. 알림 상세는 클릭 시 로그인·본인 작업·현재 공유 권한으로 다시 계산한다. 개인 페이지/API/영수증/추천 결과를 오프라인 캐시에 저장하지 않는다. 정적 자산과 개인 데이터 없는 오프라인 안내만 캐시한다.

## 사진 정리

매 주기 24시간 지난 영수증을 만료 처리하고 `cleanup_pending` 원본 최대 100건을 삭제한다. 삭제가 성공한 뒤에만 정리 표시를 해제한다. 실패는 다음 주기에 재시도한다. 로그는 개수와 일반 오류만 기록한다. 예전 `receipts:cleanup` 명령도 유지되나 worker와 동시에 운영할 필요는 없다.

## Docker Compose

`docker compose --env-file .env.local build web` 후 `docker compose --env-file .env.local up -d web worker`로 이 프로젝트의 두 서비스만 시작한다. 공개 `NEXT_PUBLIC_*` 값은 빌드 시 고정된다. 외부 서비스에 배포하는 명령은 아니다.

기본 호스트 포트는 3001이다. `.env.local`의 `NEXT_PUBLIC_SITE_URL`을 접속할 주소(예: `http://127.0.0.1:3001`)로 맞춘 뒤 빌드한다. 기존 3000 개발 서버와 주소를 혼용하지 않는다. 브라우저용 Supabase URL은 `http://127.0.0.1:54321`, 컨테이너 내부용은 기본 `http://host.docker.internal:54321`이다. 원격 Supabase를 쓸 때는 `SUPABASE_SERVER_URL`도 해당 원격 URL로 지정한다. 인증 쿠키 이름은 공개 URL 기준으로 같게 유지한다.

중지: `docker compose --env-file .env.local stop web worker`. 작업 데이터와 Supabase 볼륨을 삭제하는 `down -v` 또는 DB reset은 사용하지 않는다. 운영 환경은 HTTPS 역방향 프록시, 실제 VAPID 연락처, 비밀 관리와 백업을 구성한 뒤 11단계 체크를 수행한다.
