'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { SignOutButton } from '@/features/auth/sign-out-button';

export function ProfileMenu({ accountName, fridgeId }: { accountName: string; fridgeId: string }) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    focusOnOpen = useRef(false),
    id = useId();
  const name = accountName.trim() || '사용자';
  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      className="profile-menu"
      ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (!open) {
          focusOnOpen.current = true;
          setOpen(true);
          return;
        }
        const items = Array.from(
            menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [],
          ),
          index = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? items[0]
            : event.key === 'End'
              ? items.at(-1)
              : event.key === 'ArrowUp'
                ? items.at(Math.max(index, 0) - 1)
                : (items[index + 1] ?? items[0]);
        next?.focus();
      }}
    >
      <button
        className="profile-avatar"
        ref={trigger}
        aria-label={name + ' 계정 메뉴'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          focusOnOpen.current = event.detail === 0;
          setOpen((value) => !value);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
      </button>
      {open && (
        <div className="profile-dropdown" ref={menu} id={id} role="menu" aria-label="계정 메뉴">
          <Link role="menuitem" href="/mypage" onClick={() => setOpen(false)}>
            마이페이지
          </Link>
          <Link
            role="menuitem"
            href={'/fridges/manage?fridgeId=' + encodeURIComponent(fridgeId)}
            onClick={() => setOpen(false)}
          >
            냉장고 관리
          </Link>
          <SignOutButton menuItem />
        </div>
      )}
    </div>
  );
}
