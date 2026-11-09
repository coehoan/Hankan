const paths = {
  fridge:
    'M5 11h14M9 7v1m0 7v3M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  bowl: 'M3 12h18a9 9 0 0 1-18 0Zm5 9h8M9 8c-2-2 2-3 0-5m6 5c-2-2 2-3 0-5',
  history: 'M3 10a9 9 0 1 1 2 8m-2-8V5m0 5h5m4-3v5l3 2',
  check: 'm5 12 4 4L19 6',
  alert:
    'M12 8v5m0 3h.01M10.3 4.5 3 18a1.5 1.5 0 0 0 1.3 2.2h15.4A1.5 1.5 0 0 0 21 18L13.7 4.5a2 2 0 0 0-3.4 0Z',
} as const;

export function PantryIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
