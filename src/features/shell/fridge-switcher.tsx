'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { FridgeSummary } from './contracts';
export type { FridgeSummary } from './contracts';
export function FridgeSwitcher({
  fridges,
  selectedId,
  onSelect,
  disabled = false,
}: {
  fridges: FridgeSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [highlight, setHighlight] = useState(selectedId),
    id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    options = useRef<HTMLDivElement>(null);
  const selected = fridges.find((fridge) => fridge.id === selectedId) ?? fridges[0],
    expanded = open && !disabled;
  const active = fridges.find((fridge) => fridge.id === highlight) ?? selected;
  const activeId = active?.id;
  const roleLabel = (role: FridgeSummary['role']) => (role === 'owner' ? '내 소유' : '함께 관리');
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [expanded]);
  useLayoutEffect(() => {
    const list = options.current,
      option = activeId ? document.getElementById(id + '-' + activeId) : null;
    if (!expanded || !list || !option || !list.contains(option)) return;
    const top = option.offsetTop,
      bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [expanded, activeId, id, fridges]);
  function show() {
    setHighlight(selectedId);
    setOpen(true);
  }
  function choose(value: string) {
    setOpen(false);
    trigger.current?.focus();
    if (value !== selectedId) onSelect(value);
  }
  return (
    <div
      className="fridge-switcher"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span>지금 보고 있는 냉장고</span>
      <div className="fridge-picker">
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-label="냉장고 선택"
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={id}
          aria-describedby={id + '-value'}
          aria-activedescendant={expanded && active ? id + '-' + active.id : undefined}
          disabled={disabled || !selected}
          onClick={() => {
            if (expanded) setOpen(false);
            else show();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === 'Tab') {
              setOpen(false);
              return;
            }
            if (['Enter', ' '].includes(event.key)) {
              event.preventDefault();
              if (expanded && active) choose(active.id);
              else show();
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !fridges.length)
              return;
            event.preventDefault();
            if (!expanded) {
              show();
              if (event.key === 'Home') setHighlight(fridges[0].id);
              if (event.key === 'End') setHighlight(fridges[fridges.length - 1].id);
              return;
            }
            const index = Math.max(
              0,
              fridges.findIndex((fridge) => fridge.id === active?.id),
            );
            setHighlight(
              fridges[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? fridges.length - 1
                    : (index + (event.key === 'ArrowUp' ? -1 : 1) + fridges.length) % fridges.length
              ].id,
            );
          }}
        >
          <span className="fridge-picker-value" id={id + '-value'}>
            <span className="fridge-picker-name">{selected?.name}</span>
            {selected && <span className="fridge-role-badge">{roleLabel(selected.role)}</span>}
          </span>
          <span className="fridge-picker-chevron" aria-hidden="true" data-expanded={expanded}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {expanded && (
          <div
            ref={options}
            id={id}
            role="listbox"
            aria-label="냉장고 목록"
            className="fridge-options"
          >
            {fridges.map((fridge) => (
              <div
                key={fridge.id}
                id={id + '-' + fridge.id}
                role="option"
                aria-selected={fridge.id === selectedId}
                aria-label={fridge.name + ' · ' + roleLabel(fridge.role)}
                className={fridge.id === active?.id ? 'highlighted' : ''}
                onPointerMove={() => setHighlight(fridge.id)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(fridge.id)}
              >
                <span className="fridge-picker-name">{fridge.name}</span>
                <span className="fridge-role-badge">{roleLabel(fridge.role)}</span>
                {fridge.id === selectedId && <span aria-hidden="true">✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
