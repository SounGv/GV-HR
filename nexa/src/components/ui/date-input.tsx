"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { isoToThaiText, maskDate, thaiTextToIso } from "./date-text";

export { isoToThaiText, thaiTextToIso } from "./date-text";

const FIELD_CLASS =
  "h-full w-full min-w-0 rounded-lg border border-[color:var(--field-border)] bg-[var(--field-bg)] shadow-[var(--field-shadow)] pr-9 pl-2.5 py-1 text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

/**
 * A date field that reads and writes day/month/Buddhist-year ("20/11/2569"), whatever language the browser is set to (the browser's
 * own date box shows mm/dd/yyyy on an English browser). The real value stays an ISO "YYYY-MM-DD" string in a native date input,
 * so every form, schema and `onChange(event.target.value)` keeps working unchanged.
 *
 * The native date control is the tap target (the whole field on a phone, the calendar icon on a computer). iPhone Safari and the
 * installed app ignore `showPicker()` on an `opacity-0` / `pointer-events-none` input, which left the field opening a number pad
 * instead of the wheel.
 */
export function DateInput({
  className,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  ref,
  min,
  max,
  name,
  required,
  disabled,
  readOnly,
  ...rest
}: React.ComponentProps<"input">) {
  const nativeRef = React.useRef<HTMLInputElement | null>(null);
  const textRef = React.useRef<HTMLInputElement | null>(null);
  const [inner, setInner] = React.useState(String(defaultValue ?? ""));
  const [draft, setDraft] = React.useState<string | null>(null);
  const [coarse, setCoarse] = React.useState(false);
  const iso = value !== undefined && value !== null ? String(value) : inner;
  const shown = draft ?? isoToThaiText(iso);

  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function setNativeValue(next: string) {
    const el = nativeRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function attach(node: HTMLInputElement | null) {
    nativeRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
  }

  function typed(raw: string) {
    const text = maskDate(raw);
    if (text === "") {
      setDraft(null);
      if (iso !== "") setNativeValue("");
      return;
    }
    setDraft(text);
    const next = thaiTextToIso(text);
    if (next && next !== iso) setNativeValue(next);
  }

  const locked = !!disabled || !!readOnly;

  return (
    <div
      data-slot="date-input"
      className={cn("relative min-h-11 w-full min-w-0 md:h-8 md:min-h-8", className)}
    >
      <input
        {...rest}
        ref={textRef}
        type="text"
        inputMode={coarse ? undefined : "numeric"}
        autoComplete="off"
        placeholder={rest.placeholder ?? "วว/ดด/ปปปป"}
        maxLength={10}
        value={shown}
        disabled={disabled}
        readOnly={readOnly || coarse}
        className={FIELD_CLASS}
        onChange={(e) => typed(e.target.value)}
        onFocus={(e) => {
          onFocus?.(e);
          if (!coarse) return;
          // A label tap focuses this box; send it to the native control so iOS opens the wheel, not a number pad.
          e.target.blur();
          nativeRef.current?.click();
        }}
        onBlur={(e) => {
          setDraft(null);
          onBlur?.(e);
        }}
      />
      <input
        ref={attach}
        type="date"
        name={name}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        value={iso}
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          "absolute z-10 m-0 cursor-pointer border-0 bg-transparent p-0 text-[16px] text-transparent",
          "max-md:inset-0 md:inset-y-0 md:right-0 md:w-9",
          "opacity-[0.01] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
          locked && "pointer-events-none",
        )}
        onChange={(e) => {
          setInner(e.target.value);
          setDraft(null);
          onChange?.(e);
        }}
      />
      <span
        className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 z-20 flex w-9 items-center justify-center"
        aria-hidden="true"
      >
        <CalendarDays className="size-4" />
      </span>
    </div>
  );
}
