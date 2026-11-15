"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Crumb = { label: string; href?: string };

/** What a page tells the top band about itself. */
export interface Chrome {
  title?: React.ReactNode;
  description?: string;
  /** Facts about the thing the page is about ("1001 · ลาป่วย"), drawn after the title. Detail pages only. */
  subtitle?: string;
  crumbs?: Crumb[];
  status?: React.ReactNode;
}

/**
 * Page headers no longer draw a title block of their own on a computer: the page's title, path and buttons go up into the
 * band at the top of the screen (see section-band.tsx), so the work area starts higher and nothing is repeated.
 *
 * Three contexts on purpose: the writer (stable, so a header never re-renders because the band changed), the band's
 * read side, and the element the buttons are drawn into.
 */
type Setter = (chrome: Chrome | null) => void;
const SetChrome = createContext<Setter | null>(null);
const ReadChrome = createContext<Chrome | null>(null);
const Slot = createContext<HTMLElement | null>(null);
const SetSlot = createContext<((el: HTMLElement | null) => void) | null>(null);

export function PageChromeProvider({ children }: { children: React.ReactNode }) {
  const [chrome, setChromeState] = useState<Chrome | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const setChrome = useRef<Setter>((c) => setChromeState(c)).current;
  return (
    <SetChrome.Provider value={setChrome}>
      <SetSlot.Provider value={setSlot}>
        <ReadChrome.Provider value={chrome}>
          <Slot.Provider value={slot}>{children}</Slot.Provider>
        </ReadChrome.Provider>
      </SetSlot.Provider>
    </SetChrome.Provider>
  );
}

/** For the band: what the current page published. */
export const usePublishedChrome = () => useContext(ReadChrome);
/** For the band: the ref callback of the element that receives the page's buttons. */
export const useSlotSetter = () => useContext(SetSlot);

/**
 * Rendered by PageHeader and PageHeaderBar. Publishes the title, path and status, and draws `actions` into the band.
 * Also keeps a title for printing (the band is not printed). Draws nothing else.
 */
export function PageChromePublisher({ title, description, subtitle, crumbs, status, actions }: Chrome & { actions?: React.ReactNode }) {
  const set = useContext(SetChrome);
  const slot = useContext(Slot);
  // Client pages pass a new breadcrumb array on every render; compare by content so an unchanged path does not re-publish
  // (and re-draw the whole band) each time, for example on every keystroke in a form.
  const crumbsKey = JSON.stringify(crumbs ?? null);
  const stableCrumbs = useMemo(() => (JSON.parse(crumbsKey) as Crumb[] | null) ?? undefined, [crumbsKey]);

  // Leaving the page clears what it published.
  useEffect(() => () => set?.(null), [set]);
  // Publishes again whenever the page's header changes (a header drawn by a client page may pass new objects each render;
  // that only re-draws the band, never this component, because the writer context is stable).
  useEffect(() => {
    set?.({ title, description, subtitle, crumbs: stableCrumbs, status });
  }, [set, title, description, subtitle, stableCrumbs, status]);

  return (
    <>
      <p className="hidden text-xl font-bold print:block">{title}</p>
      {actions && slot ? createPortal(actions, slot) : null}
    </>
  );
}

/**
 * Draws its children in the band at the top of the screen (next to the group's tabs), for buttons that belong to the page
 * but are created deep inside a view rather than in the page header. Draws nothing on a screen without the band.
 */
export function PageActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(Slot);
  return slot ? createPortal(children, slot) : null;
}
