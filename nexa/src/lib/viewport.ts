/**
 * True on a phone-width screen: below the `md` breakpoint (768px), the same line the layout uses to show the phone
 * screens instead of the desktop ones. The app draws both and hides one with CSS, so anything the hidden copy does on
 * its own (asking for the location, for one) must check this first. Call it only inside an effect or an event handler.
 */
export function isPhoneWidth(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}
