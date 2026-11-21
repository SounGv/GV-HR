/** Cookie names — kept separate so edge middleware can import them without
 *  pulling in `next/headers` (which only works in the Node request scope). */
export const ACCESS_COOKIE = "nexa_at";
export const REFRESH_COOKIE = "nexa_rt";
// Holds no secret: only says "a refresh token exists". The refresh cookie itself is limited to /api/auth, so the browser
// never sends it with a page request and edge middleware cannot see it; this marker (path "/", same lifetime) is what
// lets middleware send a reopened app through /api/auth/refresh instead of the sign-in page.
export const SESSION_MARKER_COOKIE = "nexa_rs";
export const OAUTH_STATE_COOKIE = "nexa_oauth_state";
// Double-submit CSRF token — deliberately NOT httpOnly so client JS can read
// it and echo it back as a header; the header/cookie pair is unforgeable
// cross-site because a foreign origin can neither read this cookie nor
// override it (same-origin policy), while sameSite=lax alone doesn't cover
// every mutating-request path (e.g. some cross-site fetches).
export const CSRF_COOKIE = "nexa_csrf";
export const CSRF_HEADER = "x-csrf-token";
// Carries a pending-2FA mfaToken across the Google OAuth redirect back to
// /login. Not httpOnly: the login page's client JS needs to read it and hand
// it to /api/auth/mfa/verify, exactly like the password-login flow already
// does with the mfaToken in its JSON response — it grants nothing on its own
// without a valid TOTP/recovery code.
export const MFA_PENDING_COOKIE = "nexa_mfa_pending";
