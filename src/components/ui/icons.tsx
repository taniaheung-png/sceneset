import type { SVGProps } from "react";

const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const CircleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="7.5" />
  </svg>
);
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

// Navigation and metric icons: one 24 px grid, 1.8 stroke, rounded joins (the reference's line-icon style).
const line = { ...base, strokeWidth: 1.8 } as const;
export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);
export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </svg>
);
export const CheckCircleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.3l2.4 2.4 4.6-5" />
  </svg>
);
export const WalletIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10.5a1.5 1.5 0 0 1 1.5 1.5V9" />
    <rect x="4" y="8" width="16" height="11.5" rx="2.5" />
    <circle cx="15.8" cy="13.8" r="1.1" />
  </svg>
);
export const BriefcaseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <rect x="4" y="8" width="16" height="11.5" rx="2.5" />
    <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" />
  </svg>
);
export const UsersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.8 19.2c.5-3 2.8-4.7 5.7-4.7s5.2 1.7 5.7 4.7" />
    <path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 14.7c1.6.6 2.6 2 2.9 4.1" />
  </svg>
);
export const ClockIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);
export const LayoutIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <rect x="4" y="4.5" width="16" height="15" rx="2.5" />
    <path d="M4 10.5h7.5M11.5 10.5V19.5M11.5 14.5H20" />
  </svg>
);
export const PrinterIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <path d="M7.5 9V4.5h9V9" />
    <rect x="4" y="9" width="16" height="7.5" rx="2" />
    <path d="M7.5 14h9v5.5h-9z" />
  </svg>
);
export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <path d="M5 19l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L9 18z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);
export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M6.2 17.8l1.7-1.7M16.1 7.9l1.7-1.7" />
  </svg>
);
export const CardIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
    <path d="M3.5 10.5h17M7.5 15h3" />
  </svg>
);
export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <path d="M12 20.5s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z" />
    <circle cx="12" cy="10.5" r="2.2" />
  </svg>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const SignOutIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...line} {...p}>
    <path d="M10 5H7a2.5 2.5 0 0 0-2.5 2.5v9A2.5 2.5 0 0 0 7 19h3M14 8l4 4-4 4M18 12H9.5" />
  </svg>
);
