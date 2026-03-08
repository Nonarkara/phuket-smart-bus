type Props = {
  className?: string;
};

export function BrandLogo({ className }: Props) {
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 124 132" role="img">
        <title>PKSB Phuket Smart Bus</title>
        <g fill="none" fillRule="evenodd">
          <path
            d="M36 13h28l8 9v28l-6 9H30l-6-9V22l12-9Z"
            stroke="#19B8B1"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path d="M42 22h16v16H42z" fill="#19B8B1" />
          <path d="M32 45h40" stroke="#19B8B1" strokeWidth="5" strokeLinecap="round" />
          <path d="M40 59v12M64 59v12" stroke="#19B8B1" strokeWidth="5" strokeLinecap="round" />
          <path d="M21 83c14-6 28-9 42-9s28 3 42 9" stroke="#19B8B1" strokeWidth="3.2" strokeLinecap="round" />
          <text
            x="62"
            y="103"
            textAnchor="middle"
            fill="#1E63B8"
            fontFamily="Georgia, Times New Roman, serif"
            fontSize="31"
            letterSpacing="1.6"
          >
            PKSB
          </text>
          <text
            x="62"
            y="121"
            textAnchor="middle"
            fill="#979797"
            fontFamily="Plus Jakarta Sans, IBM Plex Sans Thai, sans-serif"
            fontSize="9"
            letterSpacing="1.45"
          >
            PHUKET SMART BUS
          </text>
        </g>
      </svg>
    </div>
  );
}
