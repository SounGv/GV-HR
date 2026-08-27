"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon, SearchIcon } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

/**
 * Walk the JSX children to collect every <SelectItem>'s value + label so we can
 * feed Base UI's `items` prop. Without it, <Select.Value> shows the raw value
 * (e.g. a UUID) whenever a value is set before its popup has ever been opened —
 * which is the case for every edit form. Callers can still pass `items`
 * explicitly to override. Falls back to `undefined` (old behavior) if nothing
 * is found, so this never regresses.
 */
function deriveItems(
  children: React.ReactNode,
): ReadonlyArray<{ value: unknown; label: React.ReactNode }> | undefined {
  const out: { value: unknown; label: React.ReactNode }[] = []
  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      const props = child.props as { value?: unknown; children?: React.ReactNode }
      if (child.type === SelectItem && props.value !== undefined) {
        out.push({ value: props.value, label: props.children })
      } else if (props.children) {
        walk(props.children)
      }
    })
  }
  walk(children)
  return out.length ? out : undefined
}

/** Plain-text of a node's children — icons/other non-text nodes contribute
 * nothing, which is exactly what we want for matching a typed search query
 * against an item's visible label (e.g. "แผนกคลังสินค้า" from
 * `<SelectItem>{d.name}</SelectItem>`, or "ต้นตระกูล มาลาคำ (D0002)" from a
 * multi-part employee label). */
function nodeToText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join(" ")
  if (React.isValidElement(node)) {
    return nodeToText((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

function countSelectItems(nodes: React.ReactNode): number {
  let n = 0
  React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectItem) {
      n += 1
      return
    }
    const props = child.props as { children?: React.ReactNode }
    if (props.children) n += countSelectItems(props.children)
  })
  return n
}

/** Below this many options, a search box is more clutter than help — a
 * 3-item gender select doesn't need one, a 100-employee picker does. */
const SELECT_SEARCH_THRESHOLD = 8

function filterSelectChildren(nodes: React.ReactNode, query: string): React.ReactNode {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const filterNode = (node: React.ReactNode): React.ReactNode => {
    if (!React.isValidElement(node)) return node
    if (node.type === SelectItem) {
      const props = node.props as { children?: React.ReactNode }
      return nodeToText(props.children).toLowerCase().includes(q) ? node : null
    }
    const props = node.props as { children?: React.ReactNode }
    if (props.children) {
      const kept = React.Children.toArray(props.children)
        .map(filterNode)
        .filter((n) => n !== null)
      if (kept.length === 0) return null
      return React.cloneElement(node as React.ReactElement<{ children?: React.ReactNode }>, {}, kept)
    }
    return node
  }
  return React.Children.toArray(nodes)
    .map(filterNode)
    .filter((n) => n !== null)
}

function Select<Value = string, Multiple extends boolean | undefined = false>({
  children,
  items,
  ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
  const resolvedItems = (items ??
    deriveItems(children)) as SelectPrimitive.Root.Props<Value, Multiple>["items"]
  return (
    <SelectPrimitive.Root items={resolvedItems} {...props}>
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-base whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:text-sm data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  const [query, setQuery] = React.useState("")
  // Recomputed on every render (not memoized) — these walks are cheap
  // (a handful to a few hundred plain-object nodes) and only run while the
  // popup is actually open/mounted.
  const showSearch = countSelectItems(children) > SELECT_SEARCH_THRESHOLD
  const filteredChildren = showSearch ? filterSelectChildren(children, query) : children
  const noResults = showSearch && query.trim() && countSelectItems(filteredChildren) === 0

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 flex max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        >
          {showSearch && (
            <div className="shrink-0 border-b border-border p-1.5">
              <InputGroup className="h-8 rounded-md border-input/60">
                <InputGroupAddon>
                  <SearchIcon className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="ค้นหา…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Let Escape still close the popup; everything else
                    // (including arrow keys) stays local to the input so
                    // Base UI's own type-ahead doesn't fight our filtering.
                    if (e.key !== "Escape") e.stopPropagation()
                  }}
                  className="text-sm"
                />
              </InputGroup>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <SelectScrollUpButton />
            <SelectPrimitive.List>{filteredChildren}</SelectPrimitive.List>
            {noResults && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">ไม่พบผลลัพธ์</p>
            )}
            <SelectScrollDownButton />
          </div>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-1.5 text-base outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
