/**
 * Colorful illustration icons — lifted directly from the L/M mockup source
 * (GvOneHome2.dc.html / GvOneWebDashboard.dc.html), not brand-token colors:
 * these are fixed decorative artwork, same as the dataviz categorical
 * palette, not something a theme swap should recolor.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 40, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function LeaveIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 34c6-3 26-3 32 0v2H4Z" fill="#F5D38B" />
      <path d="M20 34c0-8 1-14 3-19" fill="none" stroke="#9A5B2E" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M23 15c-3-5-10-6-16-3 6 0 10 1 16 3Z" fill="#22A55B" />
      <path d="M23 15c3-6 10-7 15-4-6 0-10 1-15 4Z" fill="#1E8E4E" />
      <path d="M23 15c-1-5-4-8-9-10 4 3 6 6 9 10Z" fill="#2FBF6B" />
      <circle cx="33" cy="6" r="3" fill="#F5A524" />
    </Base>
  );
}

export function OvertimeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="16" y="2" width="8" height="5" rx="1.5" fill="#E5484D" />
      <rect x="18.5" y="6" width="3" height="4" fill="#C77C0E" />
      <circle cx="20" cy="23" r="14" fill="#F5A524" />
      <circle cx="20" cy="23" r="10.5" fill="#FFFFFF" />
      <path d="M20 16v7l4.5 3" fill="none" stroke="#1F2330" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="7" width="30" height="28" rx="4" fill="#FFFFFF" stroke="#C9CED8" strokeWidth="2" />
      <path d="M5 11a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v4H5Z" fill="#E5484D" />
      <path d="M13 4v6M27 4v6" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="10" y="19" width="5" height="4" rx="1" fill="#3B82F6" />
      <rect x="17.5" y="19" width="5" height="4" rx="1" fill="#3B82F6" />
      <rect x="25" y="19" width="5" height="4" rx="1" fill="#F5A524" />
      <rect x="10" y="26" width="5" height="4" rx="1" fill="#3B82F6" />
      <rect x="17.5" y="26" width="5" height="4" rx="1" fill="#3B82F6" />
      <rect x="25" y="26" width="5" height="4" rx="1" fill="#3B82F6" />
    </Base>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="6" width="26" height="30" rx="4" fill="#B7793E" />
      <rect x="10" y="10" width="20" height="23" rx="2" fill="#FFFFFF" />
      <rect x="14" y="3.5" width="12" height="6" rx="2" fill="#64748B" />
      <path d="M14 21l4 4 8-8" fill="none" stroke="#22A55B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function StarIllustrationIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M20 4l4.9 10 11 1.6-8 7.8 1.9 11L20 29l-9.8 5.4 1.9-11-8-7.8 11-1.6Z"
        fill="#F5A524"
        stroke="#C77C0E"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 17v17h22V17L20 8Z" fill="#F5D38B" />
      <rect x="17" y="24" width="6" height="10" fill="#B7793E" />
      <path d="M5 19L20 6l15 13" fill="none" stroke="#E5484D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="27" cy="13" r="6" fill="#1D5FD1" />
      <path d="M16 33c0-7 5-12 11-12s11 5 11 12Z" fill="#1D5FD1" />
      <circle cx="14" cy="14" r="6" fill="#60A5FA" />
      <path d="M3 34c0-7 5-12 11-12s11 5 11 12Z" fill="#3B82F6" />
    </Base>
  );
}

export function BarChartIllustrationIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="5" width="30" height="30" rx="5" fill="#FFFFFF" stroke="#C9CED8" strokeWidth="2" />
      <rect x="10" y="20" width="5" height="10" rx="1" fill="#3B82F6" />
      <rect x="17.5" y="12" width="5" height="18" rx="1" fill="#22A55B" />
      <rect x="25" y="16" width="5" height="14" rx="1" fill="#E5484D" />
    </Base>
  );
}

export function ProfileIllustrationIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="20" cy="13" r="7" fill="#60A5FA" />
      <path d="M6 35c0-8 6-13 14-13s14 5 14 13Z" fill="#3B82F6" />
    </Base>
  );
}
