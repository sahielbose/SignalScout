/**
 * Dotted world-map texture for the hero background. A dot pattern masked by
 * rough continent shapes, tinted with the warm paper-dot color. Decorative.
 */
export function WorldDots({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      role="presentation"
    >
      <defs>
        <pattern id="ss-worlddots" width="11" height="11" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill="hsl(var(--paper-dot))" />
        </pattern>
        <mask id="ss-continents">
          <rect width="1000" height="500" fill="#000" />
          <g fill="#fff">
            <ellipse cx="175" cy="150" rx="92" ry="64" />
            <ellipse cx="135" cy="110" rx="52" ry="34" />
            <ellipse cx="225" cy="205" rx="40" ry="30" />
            <ellipse cx="290" cy="330" rx="52" ry="86" />
            <ellipse cx="305" cy="260" rx="34" ry="40" />
            <ellipse cx="515" cy="150" rx="50" ry="36" />
            <ellipse cx="560" cy="295" rx="66" ry="88" />
            <ellipse cx="545" cy="225" rx="40" ry="34" />
            <ellipse cx="715" cy="170" rx="135" ry="82" />
            <ellipse cx="640" cy="135" rx="50" ry="32" />
            <ellipse cx="855" cy="365" rx="56" ry="34" />
          </g>
        </mask>
      </defs>
      <rect width="1000" height="500" fill="url(#ss-worlddots)" mask="url(#ss-continents)" opacity="0.85" />
    </svg>
  );
}
