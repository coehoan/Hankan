# 한칸

식재료와 유통기한을 함께 관리하는 웹 서비스입니다. 승인된 설계는 `docs/superpowers/specs/2026-10-26-hankan-design.md`, 구현 계획은 `docs/superpowers/plans/2026-10-26-hankan.md`에 있습니다.

## 현재 범위

1단계는 이메일 회원가입·메일 확인·로그인·비밀번호 재설정·로그아웃과 가입 시 본인 냉장고 자동 생성입니다. 개인 프로필과 냉장고의 DB 접근 정책, 소유자·멤버의 기본 권한도 포함합니다. 재료 등록·공동 초대 UI·AI·알림은 후속 단계입니다.

## 로컬 실행

Node 24와 실행 중인 Docker가 필요합니다. Windows PowerShell에서는 다음 명령을 사용합니다.

```powershell
npm.cmd ci
npm.cmd run db:start -- -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

Supabase CLI의 상태·캐시는 `work/supabase-home`에 저장하며 사용자 홈을 수정하지 않습니다. `.env.example`을 `.env.local`로 복사하고 `node scripts/supabase.mjs status`에서 확인한 로컬 URL과 공개 키를 입력합니다. 통합 테스트에만 로컬 service role 키를 추가합니다. `.env.local`, CLI 상태 파일과 테스트 로그는 Git에서 제외합니다.

```powershell
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다. 요청 출처 검증을 위해 `NEXT_PUBLIC_SITE_URL`과 브라우저 주소의 origin이 같아야 합니다. 확인·재설정 메일은 CLI status의 Mailpit URL에서 확인하며 실제 외부 주소로 발송하지 않습니다.

## 검증

```powershell
npm.cmd run test:db
npm.cmd test
npm.cmd run test:integration
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

통합 테스트는 loopback 주소의 로컬 Supabase만 허용합니다. 생성한 테스트 계정만 정리하며 원격 프로젝트는 사용하지 않습니다. 새 로컬 DB를 만들 때 `node scripts/supabase.mjs db reset --local`로 마이그레이션을 적용합니다. 기존 데이터를 유지할 경우 reset을 사용하지 않습니다.

이 단계는 로컬 구현이며 공개 배포나 운영용 Supabase 설정을 포함하지 않습니다.
