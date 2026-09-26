/**
 * Colourful menu icons for every mobile/services tile, the bottom nav and quick menus.
 * Same 40×40 grid, palette and weight as illustrated-icons.tsx (GV menu icon standard).
 * Fixed artwork: do not recolour per theme.
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

export function CheckInIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="2" width="22" height="36" rx="5" fill="#1F2330"/><rect x="12" y="6" width="16" height="26" rx="2.5" fill="#F4FAD2"/><path d="M15 12v-3h3M25 12v-3h-3M15 26v3h3M25 26v3h-3" fill="none" stroke="#131516" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15.5 19h9" stroke="#E5484D" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="35" r="1.5" fill="#64748B"/>
    </Base>
  );
}

export function TimeEditIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="18" cy="19" r="14" fill="#E6EEFC" stroke="#3B82F6" strokeWidth="3"/><path d="M18 11v8h6" fill="none" stroke="#1F2330" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M24 37l1.5-6 9-9 4.5 4.5-9 9Z" fill="#F5A524"/><path d="M24 37l1.5-6 4.5 4.5Z" fill="#1F2330"/>
    </Base>
  );
}

export function ShiftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="7" width="28" height="26" rx="4" fill="#FFFFFF" stroke="#C9CED8" strokeWidth="2"/><path d="M3 11a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v4H3Z" fill="#6366F1"/><path d="M10 4v6M24 4v6" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"/><rect x="8" y="19" width="6" height="4" rx="1" fill="#A5B4FC"/><rect x="8" y="26" width="6" height="4" rx="1" fill="#A5B4FC"/><rect x="16" y="19" width="6" height="4" rx="1" fill="#A5B4FC"/><circle cx="29" cy="29" r="9" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2.5"/><path d="M29 24.5V29h3.5" fill="none" stroke="#1F2330" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Base>
  );
}

export function ExpenseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="10" width="34" height="20" rx="3" fill="#22A55B"/><rect x="6" y="13" width="28" height="14" rx="2" fill="none" stroke="#86E0A8" strokeWidth="1.5"/><circle cx="20" cy="20" r="5.5" fill="#86E0A8"/><text x="20" y="23.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#136C3A" fontFamily="system-ui, sans-serif">฿</text>
    </Base>
  );
}

export function BenefitsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 35S5 26 5 15.5A8 8 0 0 1 20 11a8 8 0 0 1 15 4.5C35 26 20 35 20 35Z" fill="#E5484D"/><path d="M20 15v11M14.5 20.5h11" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"/>
    </Base>
  );
}

export function KpiIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="18" cy="22" r="15" fill="#E5484D"/><circle cx="18" cy="22" r="10.5" fill="#FFFFFF"/><circle cx="18" cy="22" r="6" fill="#E5484D"/><circle cx="18" cy="22" r="2.2" fill="#FFFFFF"/><path d="M18 22L33 7" stroke="#1F2330" strokeWidth="2.5" strokeLinecap="round"/><path d="M29 4l5 1 1 5-3.5 1.5-4-4Z" fill="#F5A524"/>
    </Base>
  );
}

export function MeetingIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-9l-6 5v-5H8a4 4 0 0 1-4-4Z" fill="#3B82F6"/><path d="M12 26h13l6 5v-5h1a4 4 0 0 0 4-4V14a4 4 0 0 0-4-4h-2v8a6 6 0 0 1-6 6H12Z" fill="#F5A524"/><circle cx="10" cy="13" r="1.8" fill="#FFFFFF"/><circle cx="16" cy="13" r="1.8" fill="#FFFFFF"/><circle cx="22" cy="13" r="1.8" fill="#FFFFFF"/>
    </Base>
  );
}

export function AddPersonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="16" cy="13" r="7" fill="#60A5FA"/><path d="M2 35c0-8 6-13 14-13s14 5 14 13Z" fill="#3B82F6"/><circle cx="30" cy="27" r="8" fill="#22A55B"/><path d="M30 23v8M26 27h8" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round"/>
    </Base>
  );
}

export function OrgChartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 13v6M9 19h22M9 19v5M31 19v5M20 19v5" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"/><rect x="13" y="3" width="14" height="10" rx="3" fill="#6366F1"/><rect x="3" y="24" width="12" height="10" rx="3" fill="#60A5FA"/><rect x="14" y="24" width="12" height="10" rx="3" fill="#60A5FA"/><rect x="25" y="24" width="12" height="10" rx="3" fill="#60A5FA"/>
    </Base>
  );
}

export function AccessIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 3l14 5v10c0 9-6 15.5-14 19C12 33.5 6 27 6 18V8Z" fill="#1D5FD1"/><path d="M20 7l10 3.6V18c0 6.6-4.2 11.4-10 14.2Z" fill="#3B82F6"/><circle cx="20" cy="17" r="3.8" fill="#FFFFFF"/><path d="M20 20v6" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round"/>
    </Base>
  );
}

export function AttendanceReportIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="6" width="26" height="30" rx="4" fill="#B7793E"/><rect x="10" y="10" width="20" height="23" rx="2" fill="#FFFFFF"/><rect x="14" y="3.5" width="12" height="6" rx="2" fill="#64748B"/><rect x="13.5" y="23" width="3.5" height="6" rx="1" fill="#3B82F6"/><rect x="18.5" y="17" width="3.5" height="12" rx="1" fill="#22A55B"/><rect x="23.5" y="20" width="3.5" height="9" rx="1" fill="#F5A524"/>
    </Base>
  );
}

export function LeaveOverviewIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="7" width="30" height="28" rx="4" fill="#FFFFFF" stroke="#C9CED8" strokeWidth="2"/><path d="M5 11a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v4H5Z" fill="#22A55B"/><path d="M13 4v6M27 4v6" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"/><rect x="9" y="19" width="16" height="4.5" rx="2.25" fill="#2FBF6B"/><rect x="15" y="26" width="16" height="4.5" rx="2.25" fill="#F5A524"/>
    </Base>
  );
}

export function KpiOrgIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M11 4h18v9a9 9 0 0 1-18 0Z" fill="#F5A524"/><path d="M11 7H6v3a6 6 0 0 0 6 6M29 7h5v3a6 6 0 0 1-6 6" fill="none" stroke="#C77C0E" strokeWidth="2.5" strokeLinecap="round"/><rect x="17.5" y="21" width="5" height="7" fill="#C77C0E"/><rect x="11" y="28" width="18" height="7" rx="2" fill="#475569"/><path d="M20 7.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1L20 14.6l-2.8 1.5.6-3.1-2.3-2.2 3.1-.4Z" fill="#FFFFFF"/>
    </Base>
  );
}

export function ExportIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 24h9l2 4h10l2-4h9v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill="#475569"/><path d="M20 4v16" stroke="#22A55B" strokeWidth="4" strokeLinecap="round"/><path d="M13 14l7 7 7-7" fill="none" stroke="#22A55B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </Base>
  );
}

export function MenuSettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="5" width="32" height="30" rx="6" fill="#EEF0F2" stroke="#C9CED8" strokeWidth="2"/><path d="M10 13h20M10 20h20M10 27h20" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"/><circle cx="16" cy="13" r="3.5" fill="#6366F1"/><circle cx="26" cy="20" r="3.5" fill="#F5A524"/><circle cx="13" cy="27" r="3.5" fill="#22A55B"/>
    </Base>
  );
}

export function OrgSettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="20" cy="20" r="13" fill="none" stroke="#475569" strokeWidth="6" strokeDasharray="5 5.2"/><circle cx="20" cy="20" r="11" fill="#94A3B8"/><circle cx="20" cy="20" r="4.5" fill="#FFFFFF"/>
    </Base>
  );
}

export function OnsiteIcon(props: IconProps) {
  return (
    <Base {...props}>
      <ellipse cx="20" cy="34" rx="13" ry="4" fill="#86E0A8"/><path d="M20 35S8 23.5 8 15a12 12 0 0 1 24 0c0 8.5-12 20-12 20Z" fill="#E5484D"/><circle cx="20" cy="15" r="4.5" fill="#FFFFFF"/>
    </Base>
  );
}
