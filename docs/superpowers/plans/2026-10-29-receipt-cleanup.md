# Immediate Receipt Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with TDD.

**Goal:** 저장/취소 직후 canonical PNG와 연결된 staging 원본을 함께 삭제한다.
**Architecture:** nullable server-owned staging link, shared removal helper, existing cleanup_pending retry, bounded replay cleanup.
**Spec:** ../specs/2026-10-29-receipt-cleanup-design.md

## Global Constraints

- 원본10MB/권한/수동 확인 저장과 기존 데이터 보존. 임의 경로 삭제 금지.
- 두 파일 모두 성공해야 cleanup_pending=false; 저장 결과 자체는 삭제 장애로 되돌리지 않는다.
- 파일은 즉시 삭제, staging 연결은125분 replay cleanup 후 해제. 미연결 파일은 기존 정책 유지.
- Production dev, Supabase wtwvmerpucfdodieawul, Vercel hankan1/hankan. 키를 출력하지 않는다.

## Review Focus

1. 다른 초안/공유 멤버 사진 삭제 차단.
2. 저장/취소 재시도 및 파일 일부 삭제 실패 후 회복.
3. signed URL 재생성 후 파일이 남지 않음.
4. 연결 등록/업로드와 취소가 겹친 경우의 정리.
5. 기존 nullable row와 기존 worker/배포 호환성.

### Task 1: 연결과 즉시/재시도 정리

**Files:** CLI-generated receipt_staging_link migration; database.types.ts; receipts/{direct-upload,service,file-cleanup}.ts; jobs/{worker,staging-cleanup}.ts; integration receipt-immediate-cleanup tests; worker boundary fixture; operations docs.
**Interfaces:** createReceiptDraft(access,image,stagedObjectPath?); removeReceiptFiles({objectPath,stagedObjectPath?}); worker pending paths carry staging link.

- [ ] RED: actual Storage save/cancel deletes both; other private upload preserved; staged delete failure keeps marker; replay is deleted next cycle.
- [ ] GREEN: migration/path checks/link, shared file removal, bounded worker replay cleanup.
- [ ] Verify targeted then check:stage11 and one fresh review; fix Important with RED→GREEN.
- [ ] Apply additive cloud migration, push dev, confirm READY and live save/cancel file deletion with synthetic account. Clean fixtures and record result.
