/**
 * Roost engraved field-guide illustration system.
 *
 * Vintage line-art / woodcut aesthetic to match branding/mockup.png:
 * thin forest-green strokes, sage + sand fills, brick accents, on bone/kraft.
 * All components accept className for sizing and are decorative by default
 * (aria-hidden) unless a label is provided.
 *
 * Palette (kept in sync with CLAUDE.md §14 / globals.css @theme):
 *   forest #2F4A37  sage #A7B49A  sand #E6D9BF  kraft #D9C9A8
 *   brick #A04A32   bone  #F1EBDC  bone-light #F7F3E9
 */

const FOREST = "#2F4A37";
const FOREST_LIGHT = "#3D6147";
const SAGE = "#A7B49A";
const SAGE_LIGHT = "#BCC7B2";
const SAND = "#E6D9BF";
const KRAFT = "#D9C9A8";
const BRICK = "#A04A32";
const BONE = "#F1EBDC";

interface IllustrationProps {
  className?: string;
  label?: string;
}

/* ── Faint topographic arcs, used as a texture layer inside scenes ── */
function TopoArcs({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <g stroke={FOREST} strokeWidth={0.6} fill="none" opacity={opacity}>
      <path d="M-10 150 Q80 120 170 140 T350 120" />
      <path d="M-10 130 Q90 100 180 120 T360 98" />
      <path d="M-10 110 Q70 84 160 100 T350 78" />
    </g>
  );
}

/* ── A single engraved conifer ── */
export function PineTree({ className, label }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 60 100"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <line x1="30" y1="74" x2="30" y2="92" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
      <g fill={FOREST_LIGHT} stroke={FOREST} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M30 6 L46 34 L36 34 L50 56 L40 56 L52 78 L8 78 L20 56 L10 56 L24 34 L14 34 Z" />
      </g>
      {/* engraving hatch on the shaded side */}
      <g stroke={FOREST} strokeWidth="0.7" opacity="0.4">
        <line x1="30" y1="20" x2="36" y2="30" />
        <line x1="30" y1="42" x2="40" y2="52" />
        <line x1="30" y1="62" x2="44" y2="74" />
      </g>
    </svg>
  );
}

/* ── Sun with engraved rays ── */
function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 12;
    const x1 = cx + Math.cos(angle) * (r + 4);
    const y1 = cy + Math.sin(angle) * (r + 4);
    const x2 = cx + Math.cos(angle) * (r + 11);
    const y2 = cy + Math.sin(angle) * (r + 11);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    <g stroke={BRICK} strokeWidth="1.4" strokeLinecap="round">
      <circle cx={cx} cy={cy} r={r} fill={BONE} />
      {rays}
    </g>
  );
}

/* ── Two small birds (distant V shapes) ── */
function Birds({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={FOREST} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.65">
      <path d={`M${x} ${y} q6 -5 12 0`} />
      <path d={`M${x + 16} ${y - 6} q5 -4 10 0`} />
    </g>
  );
}

/**
 * Cabin nestled in pines under a hill and sun — the hero / welcome illustration.
 * Echoes the Roost logo mark. Sits inside a rounded field-guide frame with topo texture.
 */
export function CabinScene({ className, label = "A cabin nestled among pines" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 210"
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="cabin-frame">
          <rect x="6" y="6" width="308" height="198" rx="16" />
        </clipPath>
      </defs>

      {/* Sky / paper fill */}
      <rect x="6" y="6" width="308" height="198" rx="16" fill={BONE} />

      <g clipPath="url(#cabin-frame)">
        <TopoArcs opacity={0.16} />
        <Sun cx={252} cy={52} r={20} />
        <Birds x={66} y={48} />

        {/* Distant hill */}
        <path d="M-10 150 C70 120 150 150 230 132 S330 128 340 138 L340 210 L-10 210 Z" fill={SAGE_LIGHT} />
        {/* Mid hill */}
        <path d="M-10 168 C90 144 180 168 270 152 S340 158 340 160 L340 210 L-10 210 Z" fill={SAGE} />

        {/* Flanking pines */}
        <g transform="translate(20 96) scale(0.85)"><use href="#pine" /></g>
        <g transform="translate(252 104) scale(0.7)"><use href="#pine" /></g>
        <g transform="translate(286 110) scale(0.55)"><use href="#pine" /></g>

        {/* reusable pine def */}
        <defs>
          <g id="pine">
            <line x1="30" y1="74" x2="30" y2="92" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
            <path
              d="M30 6 L46 34 L36 34 L50 56 L40 56 L52 78 L8 78 L20 56 L10 56 L24 34 L14 34 Z"
              fill={FOREST_LIGHT}
              stroke={FOREST}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </g>
        </defs>

        {/* Cabin */}
        <g transform="translate(118 96)" stroke={FOREST} strokeLinejoin="round" strokeLinecap="round">
          {/* chimney + smoke */}
          <path d="M64 6 q3 -8 -2 -12 M70 2 q4 -7 -1 -12" fill="none" strokeWidth="1.6" opacity="0.55" />
          <rect x="58" y="14" width="10" height="16" fill={KRAFT} strokeWidth="1.6" />
          {/* roof */}
          <path d="M2 40 L42 12 L82 40 Z" fill={FOREST} strokeWidth="1.8" />
          <path d="M14 40 L42 21 L70 40" fill="none" stroke={BONE} strokeWidth="1.4" opacity="0.6" />
          {/* body with log lines */}
          <rect x="12" y="40" width="60" height="46" fill={SAND} strokeWidth="1.8" />
          <g stroke={FOREST} strokeWidth="1" opacity="0.45">
            <line x1="12" y1="52" x2="72" y2="52" />
            <line x1="12" y1="64" x2="72" y2="64" />
            <line x1="12" y1="76" x2="72" y2="76" />
          </g>
          {/* door */}
          <rect x="36" y="60" width="14" height="26" fill={BRICK} strokeWidth="1.6" />
          <circle cx="47" cy="73" r="1.3" fill={BONE} stroke="none" />
          {/* window */}
          <rect x="18" y="48" width="11" height="11" fill={BONE} strokeWidth="1.4" />
          <line x1="23.5" y1="48" x2="23.5" y2="59" strokeWidth="1" />
          <line x1="18" y1="53.5" x2="29" y2="53.5" strokeWidth="1" />
        </g>

        {/* foreground ground line */}
        <path d="M-10 182 H340" stroke={FOREST} strokeWidth="1.2" opacity="0.3" />
      </g>

      {/* Double field-guide frame */}
      <rect x="6" y="6" width="308" height="198" rx="16" fill="none" stroke={FOREST} strokeWidth="2" />
      <rect x="11" y="11" width="298" height="188" rx="12" fill="none" stroke={FOREST} strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

/**
 * Wide rolling-hills landscape with vine rows, sun and pines — used as the
 * banner across the top of a hero trip card and welcome cards.
 */
export function LandscapeBanner({ className, label = "Rolling hills landscape" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 400 130"
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* warm sky */}
      <rect width="400" height="130" fill={KRAFT} />
      <rect width="400" height="130" fill={BONE} opacity="0.35" />

      <Sun cx={336} cy={40} r={16} />
      <Birds x={60} y={34} />

      {/* distant ridge */}
      <path d="M0 74 C70 58 150 80 230 66 S360 60 400 72 L400 130 L0 130 Z" fill={SAGE_LIGHT} />
      {/* mid hill with vine rows */}
      <path d="M0 92 C90 76 180 96 270 82 S380 88 400 90 L400 130 L0 130 Z" fill={SAGE} />
      <g stroke={FOREST} strokeWidth="0.8" opacity="0.35">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={40 + i * 30} y1="92" x2={36 + i * 30} y2="104" />
        ))}
      </g>
      {/* front hill */}
      <path d="M0 110 C110 100 210 114 300 104 S400 110 400 112 L400 130 L0 130 Z" fill={FOREST_LIGHT} />

      {/* foreground pines */}
      <g transform="translate(8 60) scale(0.6)">
        <line x1="30" y1="74" x2="30" y2="92" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
        <path d="M30 6 L46 34 L36 34 L50 56 L40 56 L52 78 L8 78 L20 56 L10 56 L24 34 L14 34 Z" fill={FOREST} stroke={FOREST} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
      <g transform="translate(40 74) scale(0.42)">
        <line x1="30" y1="74" x2="30" y2="92" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
        <path d="M30 6 L46 34 L36 34 L50 56 L40 56 L52 78 L8 78 L20 56 L10 56 L24 34 L14 34 Z" fill={FOREST} stroke={FOREST} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ── Small location pin used as a wordmark accent ── */
export function LocationPin({ className, label }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
    >
      <path
        d="M12 2C8.1 2 5 5.1 5 9c0 5 7 13 7 13s7-8 7-13c0-3.9-3.1-7-7-7Z"
        fill={BRICK}
        stroke={FOREST}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.4" fill={BONE} stroke={FOREST} strokeWidth="1.2" />
    </svg>
  );
}

/* ── A short row of pines for footer / divider decoration ── */
export function PineRow({ className, label }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 40"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <line x1="0" y1="36" x2="200" y2="36" stroke={FOREST} strokeWidth="1" opacity="0.3" />
      {[18, 52, 100, 148, 182].map((x, i) => {
        const s = i % 2 === 0 ? 0.4 : 0.32;
        return (
          <g key={x} transform={`translate(${x - 30 * s} ${36 - 92 * s}) scale(${s})`}>
            <line x1="30" y1="74" x2="30" y2="92" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
            <path d="M30 6 L46 34 L36 34 L50 56 L40 56 L52 78 L8 78 L20 56 L10 56 L24 34 L14 34 Z" fill={FOREST_LIGHT} stroke={FOREST} strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}
