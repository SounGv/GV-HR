"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

/** "2026-11-20" → "20/11/2569" (day/month/Buddhist year, as staff read dates). Anything else → "". */
export function isoToThaiText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : ""
}

/**
 * "20/11/2569" or "20/11/2026" → "2026-11-20". A year of 2400 or more is read as Buddhist era. Returns null when the text is
 * not a real calendar date, so a half-typed value never reaches the form.
 */
export function thaiTextToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  let year = Number(m[3])
  if (year >= 2400) year -= 543
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Keeps digits only and puts the slashes in while typing: 20112569 → 20/11/2569. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const FIELD_CLASS =
  "h-full w-full min-w-0 rounded-lg border border-[color:var(--field-border)] bg-[var(--field-bg)] shadow-[var(--field-shadow)] pr-9 pl-2.5 py-1 text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

/**
 * A date field that reads and writes day/month/Buddhist-year ("20/11/2569"), whatever language the browser is set to (the browser's
 * own date box shows mm/dd/yyyy on an English browser). The real value stays an ISO "YYYY-MM-DD" string in a hidden native date input,
 * so every form, schema and `onChange(event.target.value)` keeps working unchanged; the calendar button opens the browser's picker.
 */
export function DateInput({ className, value, defaultValue, onChange, onBlur, onFocus, ref, min, max, name, required, disabled, readOnly, ...rest }: React.ComponentProps<"input">) {
  const nativeRef = React.useRef<HTMLInputElement | null>(null)
  const textRef = React.useRef<HTMLInputElement | null>(null)
  const [inner, setInner] = React.useState(String(defaultValue ?? ""))
  const [draft, setDraft] = React.useState<string | null>(null)
  const iso = value !== undefined && value !== null ? String(value) : inner
  const shown = draft ?? isoToThaiText(iso)

  function setNativeValue(next: string) {
    const el = nativeRef.current
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    setter?.call(el, next)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }

  function attach(node: HTMLInputElement | null) {
    nativeRef.current = node
    if (node) {
      // A form library focuses the field's ref when it has an error: send that to the visible box.
      node.focus = () => textRef.current?.focus()
    }
    if (typeof ref === "function") ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
  }

  function typed(raw: string) {
    const text = maskDate(raw)
    if (text === "") {
      setDraft(null)
      if (iso !== "") setNativeValue("")
      return
    }
    setDraft(text)
    const next = thaiTextToIso(text)
    if (next && next !== iso) setNativeValue(next)
  }

  function openPicker() {
    const el = nativeRef.current
    if (!el || disabled || readOnly) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }

  return (
    <div data-slot="date-input" className={cn("relative h-8 w-full min-w-0", className)}>
      <input
        {...rest}
        ref={textRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={rest.placeholder ?? "วว/ดด/ปปปป"}
        maxLength={10}
        value={shown}
        disabled={disabled}
        readOnly={readOnly}
        className={FIELD_CLASS}
        onChange={(e) => typed(e.target.value)}
        onFocus={onFocus}
        onBlur={(e) => {
          setDraft(null)
          onBlur?.(e)
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
        value={iso}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0"
        onChange={(e) => {
          setInner(e.target.value)
          setDraft(null)
          onChange?.(e)
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || readOnly}
        aria-label="เลือกวันที่จากปฏิทิน"
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
