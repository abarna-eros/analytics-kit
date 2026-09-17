import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function icon(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...props,
  };
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg {...icon(props)} fill="currentColor" stroke="none">
      <path d="M12 .5A11.5 11.5 0 0 0 8.5 22.9c.58.1.79-.25.79-.56v-2.17c-3.21.7-3.89-1.4-3.89-1.4-.53-1.35-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.19a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.19 3.17-1.19.64 1.59.24 2.77.12 3.06.74.81 1.18 1.85 1.18 3.11 0 4.43-2.7 5.4-5.28 5.69.41.35.78 1.05.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 3 3 8l9 5 9-5-9-5zM3 16l9 5 9-5M3 12l9 5 9-5" />
    </svg>
  );
}

export function NodesIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M8 7.2 10.6 16M16 7.2 13.4 16M8.2 6h7.6" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 3 5 6v6c0 4.2 2.7 7.2 7 9 4.3-1.8 7-4.8 7-9V6l-7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function TypeIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 7V5h16v2M12 5v14M8 19h8" />
    </svg>
  );
}

export function ConsentIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function GaugeIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 16a7 7 0 1 1 14 0" />
      <path d="M12 16 16 9" />
      <circle cx="12" cy="16" r="1.4" />
    </svg>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M9 8V4M15 8V4M8 8h8v5a4 4 0 0 1-8 0V8zM12 17v3" />
    </svg>
  );
}

export function WifiOffIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M12 19h.01M4 4l16 16" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5h.01" />
    </svg>
  );
}

export function QueueIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 8 12 4l9 4-9 4-9-4zM3 8v8l9 4 9-4V8" />
    </svg>
  );
}

export function ClickIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M10 4v8l3-2 2 5 2-1-2-5 4-1-9-5z" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" />
      <path d="M5 19 14 10" />
    </svg>
  );
}
