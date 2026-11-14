/**
 * Menu-group icons (owner-approved mock, 14 Nov 2026, variant A): each group shows
 * the thing it is about (clock, palm tree for leave, money bag) in two teal tones,
 * so the one-accent rule still holds. Colours come from the --gi-* tokens in
 * globals.css (light and dark). Same props as a lucide icon so NavGroup.icon
 * accepts either; strokeWidth is ignored.
 */
import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string };

function Base({ size, strokeWidth, children, ...rest }: Props & { children: ReactNode }) {
  void strokeWidth;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export function OverviewGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <path fill="var(--gi-soft)" d="M7 19 20 8l13 11v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" /><path fill="var(--gi-main)" d="M4.6 19.6 20 6.4l15.4 13.2-2 2.3L20 10.4 6.6 21.9z" /><rect x="16" y="23" width="8" height="12" rx="1.5" fill="var(--gi-deep)" /><circle cx="28" cy="15" r="3" fill="var(--gi-hi)" />
    </Base>
  );
}

export function TimeGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <path fill="var(--gi-main)" d="M6 10a5 5 0 0 1 8-4L8 12a5 5 0 0 1-2-2zm28 0a5 5 0 0 0-8-4l6 6a5 5 0 0 0 2-2z" /><circle cx="20" cy="22" r="13" fill="var(--gi-main)" /><circle cx="20" cy="22" r="10" fill="var(--gi-soft)" stroke="var(--gi-line)" strokeWidth="1.5" /><path d="M20 15v7.5l5 3" fill="none" stroke="var(--gi-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path fill="var(--gi-deep)" d="M10 34l3-3 2 2-3 3zM30 34l-3-3-2 2 3 3z" />
    </Base>
  );
}

export function LeaveGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <ellipse cx="20" cy="35" rx="15" ry="3.5" fill="var(--gi-soft)" /><path fill="var(--gi-deep)" d="M18.5 15h3l1.5 19h-6z" /><path fill="var(--gi-main)" d="M20 15c-3-6-10-7-15-4 5 0 9 1 12 5-4-1-9 1-11 5 5-3 10-3 14-4zM20 15c3-6 10-7 15-4-5 0-9 1-12 5 4-1 9 1 11 5-5-3-10-3-14-4z" /><circle cx="31" cy="7" r="3.5" fill="var(--gi-hi)" />
    </Base>
  );
}

export function PeopleGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <rect x="5" y="9" width="30" height="24" rx="4" fill="var(--gi-soft)" stroke="var(--gi-line)" strokeWidth="2" /><rect x="5" y="9" width="30" height="6" rx="3" fill="var(--gi-main)" /><circle cx="14" cy="22" r="4" fill="var(--gi-deep)" /><path fill="var(--gi-deep)" d="M7.5 31c.8-4 3.4-6 6.5-6s5.7 2 6.5 6z" /><rect x="23" y="19" width="9" height="2.6" rx="1.3" fill="var(--gi-main)" /><rect x="23" y="24.5" width="6.5" height="2.6" rx="1.3" fill="var(--gi-hi)" /><rect x="17" y="5" width="6" height="6" rx="1.5" fill="var(--gi-deep)" />
    </Base>
  );
}

export function AppraisalGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <rect x="7" y="7" width="26" height="29" rx="3.5" fill="var(--gi-deep)" /><rect x="10" y="10" width="20" height="23" rx="2" fill="var(--gi-soft)" stroke="var(--gi-line)" strokeWidth="1.5" /><rect x="14" y="4.5" width="12" height="6" rx="2" fill="var(--gi-main)" /><path fill="var(--gi-main)" d="m20 13.5 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" /><rect x="13.5" y="29" width="13" height="2.2" rx="1.1" fill="var(--gi-hi)" />
    </Base>
  );
}

export function MoneyGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <path fill="var(--gi-deep)" d="M14 6h12l-3 6h-6z" /><rect x="15" y="11" width="10" height="3" rx="1.5" fill="var(--gi-deep)" /><path fill="var(--gi-main)" d="M15 13h10c6 4 10 10 10 15 0 5-4 8-9 8H14c-5 0-9-3-9-8 0-5 4-11 10-15z" /><path d="M20 19v13M23.5 21.5c-.6-1.4-2-2-3.5-2-2 0-3.5 1-3.5 2.6 0 3.6 7.2 2 7.2 5.6 0 1.7-1.6 2.8-3.7 2.8-1.7 0-3.2-.8-3.8-2.2" fill="none" stroke="var(--gi-paper)" strokeWidth="2.4" strokeLinecap="round" />
    </Base>
  );
}

export function ReportGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <rect x="5" y="6" width="30" height="28" rx="4" fill="var(--gi-soft)" stroke="var(--gi-line)" strokeWidth="2" /><rect x="10" y="21" width="5" height="9" rx="1.2" fill="var(--gi-hi)" /><rect x="17.5" y="15" width="5" height="15" rx="1.2" fill="var(--gi-main)" /><rect x="25" y="11" width="5" height="19" rx="1.2" fill="var(--gi-deep)" />
    </Base>
  );
}

export function DataGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <ellipse cx="20" cy="9" rx="13" ry="4.5" fill="var(--gi-main)" /><path fill="var(--gi-soft)" d="M7 9v7c0 2.5 5.8 4.5 13 4.5S33 18.5 33 16V9c0 2.5-5.8 4.5-13 4.5S7 11.5 7 9z" /><path fill="var(--gi-main)" d="M7 17v7c0 2.5 5.8 4.5 13 4.5S33 26.5 33 24v-7c0 2.5-5.8 4.5-13 4.5S7 19.5 7 17z" /><path fill="var(--gi-soft)" d="M7 25v6c0 2.5 5.8 4.5 13 4.5S33 33.5 33 31v-6c0 2.5-5.8 4.5-13 4.5S7 27.5 7 25z" /><circle cx="28" cy="16.5" r="1.6" fill="var(--gi-hi)" /><circle cx="28" cy="31" r="1.6" fill="var(--gi-hi)" />
    </Base>
  );
}

export function SystemGroupIcon(props: Props) {
  return (
    <Base {...props}>
      <path fill="var(--gi-main)" d="M17.3 4h5.4l.9 4.3 3 1.3 3.7-2.4 3.8 3.8-2.4 3.7 1.3 3 4.3.9v5.4l-4.3.9-1.3 3 2.4 3.7-3.8 3.8-3.7-2.4-3 1.3-.9 4.3h-5.4l-.9-4.3-3-1.3-3.7 2.4-3.8-3.8 2.4-3.7-1.3-3L4 22.7v-5.4l4.3-.9 1.3-3-2.4-3.7 3.8-3.8 3.7 2.4 3-1.3z" /><circle cx="20" cy="20" r="6.5" fill="var(--gi-soft)" /><circle cx="20" cy="20" r="3" fill="var(--gi-hi)" />
    </Base>
  );
}
