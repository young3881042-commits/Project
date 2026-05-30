export default function MemoNavIcon({ type }) {
  const paths = {
    home: <path d="M4 11.5 12 5l8 6.5V20H5v-8.5z" />,
    calendar: (
      <>
        <path d="M5 5h14v15H5z" />
        <path d="M8 3v4M16 3v4M5 10h14" />
      </>
    ),
    trip: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </>
    ),
    bold: (
      <>
        <path d="M8 5h5.2a3 3 0 0 1 0 6H8z" />
        <path d="M8 11h6a3.5 3.5 0 0 1 0 7H8z" />
        <path d="M8 5v13" />
      </>
    ),
    checkSquare: (
      <>
        <path d="M5 5h14v14H5z" />
        <path d="m8.5 12.5 2.2 2.2 4.8-5.4" />
      </>
    ),
    list: (
      <>
        <path d="M8 7h11" />
        <path d="M8 12h11" />
        <path d="M8 17h11" />
        <path d="M4.5 7h.01" />
        <path d="M4.5 12h.01" />
        <path d="M4.5 17h.01" />
      </>
    ),
    board: (
      <>
        <path d="M4 5h7v6H4z" />
        <path d="M13 5h7v14h-7z" />
        <path d="M4 13h7v6H4z" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
      </>
    ),
    mail: (
      <>
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    message: (
      <>
        <path d="M5 5h14v10H8l-3 3z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9z" />
        <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 7.7-7 10-4-2.3-7-5.5-7-10V6z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
      </>
    ),
    folder: (
      <>
        <path d="M4 6.5h6l1.8 2H20v9.5H4z" />
        <path d="M4 8.5V6a1 1 0 0 1 1-1h4.2l1.7 2" />
      </>
    ),
    chevronLeft: <path d="m15 6-6 6 6 6" />,
    chevronRight: <path d="m9 6 6 6-6 6" />,
    trash: (
      <>
        <path d="M5 7h14" />
        <path d="M9 7V5h6v2" />
        <path d="M8 10v8M12 10v8M16 10v8" />
        <path d="M7 7l1 14h8l1-14" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.1" />
        <path d="M12 18.4v2.1" />
        <path d="M4.8 7.2l1.5 1.5" />
        <path d="M17.7 15.3l1.5 1.5" />
        <path d="M3.5 12h2.1" />
        <path d="M18.4 12h2.1" />
        <path d="M4.8 16.8l1.5-1.5" />
        <path d="M17.7 8.7l1.5-1.5" />
      </>
    )
  };
  return (
    <span className="memoNavIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {paths[type] || paths.file}
      </svg>
    </span>
  );
}
