const ICON_PATHS = {
  arrowUp: (
    <>
      <path d="M12 19V5" />
      <path d="m6.75 10.25 5.25-5.25 5.25 5.25" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.25" width="17" height="15" rx="3" />
      <path d="M7.5 3.5v3.75M16.5 3.5v3.75M3.5 9.25h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.75 12.2 2.7 2.7 5.85-6" />
    </>
  ),
  close: (
    <>
      <path d="m6.5 6.5 11 11" />
      <path d="m17.5 6.5-11 11" />
    </>
  ),
  edit: (
    <>
      <path d="M5.25 18.75 6 14.7 15.8 4.9a2.12 2.12 0 0 1 3 3L9 17.7l-3.75 1.05Z" />
      <path d="m14.25 6.5 3.25 3.25M5.25 18.75l3.75-1.05" />
    </>
  ),
  flame: (
    <path d="M12.2 21c4 0 6.7-2.65 6.7-6.4 0-2.75-1.35-5.05-4.1-7.45.15 2.1-.85 3.35-2 4.15.3-3.75-1.55-6.35-4.15-8.3.15 3.4-3.55 5.9-3.55 11.15C5.1 18.15 8 21 12.2 21Z" />
  ),
  leaf: (
    <>
      <path d="M19.5 4.5C12.2 4.45 7.2 7.35 6.7 13.2c-.25 2.85 1.65 5.25 4.65 5.25 5.6 0 7.75-6.2 8.15-13.95Z" />
      <path d="M4.5 20c2.4-5.2 6.25-8.55 11.6-10.4" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  note: (
    <>
      <path d="M6.25 3.75h8.9l3.6 3.6v12.9H6.25a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" />
      <path d="M14.75 3.75v4h4M8 12h7.5M8 15.5h5.25" />
    </>
  ),
  pin: (
    <>
      <path d="m8.15 4.4 7.45 7.45" />
      <path d="m14.8 3.75 5.45 5.45-3.15 1.2-3.85 3.85-1.2 3.15-5.45-5.45 3.15-1.2 3.85-3.85 1.2-3.15Z" />
      <path d="m10.45 14.75-6.2 6.2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.35 15.35 4.15 4.15" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z" />
      <path d="m18.5 14 .65 2.15 2.15.65-2.15.65-.65 2.15-.65-2.15-2.15-.65 2.15-.65.65-2.15Z" />
      <path d="m5.25 15 .55 1.7 1.7.55-1.7.55-.55 1.7-.55-1.7-1.7-.55 1.7-.55.55-1.7Z" />
    </>
  ),
  tag: (
    <>
      <path d="M4 5.25v5.1L13.65 20 20 13.65 10.35 4H5.25A1.25 1.25 0 0 0 4 5.25Z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
  trash: (
    <>
      <path d="M5.5 7.25h13M9 7.25V4.5h6v2.75M7.25 7.25l.8 13h7.9l.8-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  )
};

export default function DailyMemoIcon({ name, className = '', size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      aria-hidden="true"
      className={`dailyMemoIcon ${className}`.trim()}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      {ICON_PATHS[name] || ICON_PATHS.note}
    </svg>
  );
}

export function DailyMemoMark({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={`dailyMemoMark ${className}`.trim()}
      viewBox="0 0 48 48"
    >
      <rect width="48" height="48" rx="15" fill="#2f6f5e" />
      <path d="M14 12.5h14.8L35 18.7v16.8H16.5A4.5 4.5 0 0 1 12 31V14.5a2 2 0 0 1 2-2Z" fill="#fffdf8" />
      <path d="M28.5 12.5v6.4H35" fill="none" stroke="#b9ded1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M18 27.2c5.7.1 9.4-2.2 9.9-6.9-5.6-.1-9.4 2.2-9.9 6.9Z" fill="#f2b56b" />
      <path d="M17.2 32c1.8-4.3 5-7.2 9.2-9" fill="none" stroke="#2f6f5e" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
