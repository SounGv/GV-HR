/** Cookie names — kept separate so edge middleware can import them without
 *  pulling in `next/headers` (which only works in the Node request scope). */
export const ACCESS_COOKIE = "nexa_at";
export const REFRESH_COOKIE = "nexa_rt";
