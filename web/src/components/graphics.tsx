// Flat geometric motifs drawn from the kitchen: a plate, a halved fig, a
// citrus slice, a bowl. Fills come from theme tokens so they follow dark mode.

export function Torchon({ className = "" }: { className?: string }) {
  return <div className={`torchon ${className}`} aria-hidden="true" />;
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" className={className} aria-hidden="true">
      <circle cx="13" cy="13" r="12" className="fill-rosemary-fill" />
      <path d="M13 1 A12 12 0 0 1 13 25 Z" className="fill-mulberry" />
    </svg>
  );
}

function Citrus({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 100})`}>
      <circle cx="50" cy="50" r="48" className="fill-saffron-bright" />
      <circle cx="50" cy="50" r="40" className="fill-paper" opacity={0.35} />
      <g className="stroke-paper" strokeWidth={3} fill="none">
        <line x1="50" y1="12" x2="50" y2="88" />
        <line x1="12" y1="50" x2="88" y2="50" />
        <line x1="23" y1="23" x2="77" y2="77" />
        <line x1="77" y1="23" x2="23" y2="77" />
      </g>
    </g>
  );
}

export function CitrusIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Citrus x={0} y={0} size={100} />
    </svg>
  );
}

// Plate, halved fig and citrus slice. Sits behind the landing video.
export function StillLife({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 260" className={className} aria-hidden="true">
      <circle cx="130" cy="120" r="118" className="fill-rosemary-fill" />
      <circle
        cx="130"
        cy="120"
        r="92"
        className="stroke-paper"
        strokeWidth={1.5}
        fill="none"
        opacity={0.5}
      />
      <path d="M8 250 A70 70 0 0 1 148 250 Z" className="fill-mulberry" />
      <rect x="228" y="6" width="84" height="84" className="fill-sage-mid" />
      <Citrus x={232} y={150} size={70} />
    </svg>
  );
}

// Variant for the rosemary login panel, where the plate is just an outline.
export function PanelStillLife({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden="true">
      <circle
        cx="150"
        cy="130"
        r="100"
        className="stroke-sage-mid"
        strokeWidth={2}
        fill="none"
        opacity={0.6}
      />
      <path d="M60 200 A70 70 0 0 1 200 200 Z" className="fill-mulberry" />
      <Citrus x={176} y={40} size={52} />
    </svg>
  );
}

// A bowl seen from above, for the corner of the chat panel.
export function NestedArcs({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g className="stroke-sage-mid" strokeWidth={12} fill="none">
        <circle cx="100" cy="100" r="88" />
        <circle cx="100" cy="100" r="60" />
      </g>
      <circle cx="100" cy="100" r="30" className="fill-mulberry" opacity={0.85} />
    </svg>
  );
}
