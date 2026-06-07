export default function MemoNavIcon({ type }) {
  const paths = {
    home: <path d="M4 11.5 12 5l8 6.5V20H5v-8.5z" />,
    calendar: (
      <>
        <path d="M5 5h14v15H5z" />
        <path d="M8 3v4M16 3v4M5 10h14" />
      </>
    ),
    bell: (
      <>
        <path d="M7 11a5 5 0 0 1 10 0c0 3.1 1.2 4.3 2 5.2H5c.8-.9 2-2.1 2-5.2z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    briefcase: (
      <>
        <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
        <path d="M4 7h16v12H4z" />
        <path d="M4 12h16" />
        <path d="M10 12v2h4v-2" />
      </>
    ),
    menu: (
      <>
        <path d="M5 7h14" />
        <path d="M5 12h14" />
        <path d="M5 17h14" />
      </>
    ),
    edit: (
      <>
        <path d="M5 19h4l10-10-4-4L5 15z" />
        <path d="M13.5 6.5l4 4" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
        <path d="M8 6H5a3 3 0 0 0 3 5" />
        <path d="M16 6h3a3 3 0 0 1-3 5" />
        <path d="M12 12v5" />
        <path d="M9 20h6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 12a8 8 0 1 0 8-8v8z" />
        <path d="M12 4a8 8 0 0 1 8 8h-8z" />
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
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="5.8" />
        <path d="m15.2 15.2 4.3 4.3" />
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
    chevronDown: <path d="m6 9 6 6 6-6" />,
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
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z" />
        <path d="M13.7 2.8h-3.4l-.5 2.1a7.7 7.7 0 0 0-1.5.6l-1.8-1.1-2.4 2.4 1.1 1.8a7.7 7.7 0 0 0-.6 1.5l-2.1.5v3.4l2.1.5c.1.5.3 1 .6 1.5l-1.1 1.8 2.4 2.4 1.8-1.1c.5.3 1 .5 1.5.6l.5 2.1h3.4l.5-2.1c.5-.1 1-.3 1.5-.6l1.8 1.1 2.4-2.4-1.1-1.8c.3-.5.5-1 .6-1.5l2.1-.5v-3.4l-2.1-.5a7.7 7.7 0 0 0-.6-1.5l1.1-1.8-2.4-2.4-1.8 1.1c-.5-.3-1-.5-1.5-.6z" />
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
