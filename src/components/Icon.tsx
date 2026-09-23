type Name =
  | "book"
  | "heart"
  | "search"
  | "plus"
  | "arrow"
  | "back"
  | "print"
  | "close"
  | "share"
  | "key";

const paths: Record<Name, React.ReactNode> = {
  book: (
    <>
      <path d="M4 5.5c2.8-1.5 5.6-1.5 8 0v14c-2.4-1.5-5.2-1.5-8 0z" />
      <path d="M20 5.5c-2.8-1.5-5.6-1.5-8 0v14c2.4-1.5 5.2-1.5 8 0z" />
    </>
  ),
  heart: (
    <path d="M20.4 8.2c0 4.5-8.4 10.2-8.4 10.2S3.6 12.7 3.6 8.2a4.2 4.2 0 0 1 8.4-.2 4.2 4.2 0 0 1 8.4.2z" />
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.7" />
      <path d="m16 16 4.3 4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  print: (
    <>
      <path d="M7 8V3h10v5M7 17H4V9h16v8h-3" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  close: <path d="M5 5l14 14M19 5 5 19" />,
  share: (
    <>
      <circle cx="18" cy="5" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="m8 11 8-5M8 13l8 5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9 2 2-3 3 1.5 1.5-2 2L17 10l-3 3" />
    </>
  ),
};

export default function Icon({
  name,
  size = 18,
  filled = false,
}: {
  name: Name;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
