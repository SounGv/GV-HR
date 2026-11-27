/**
 * URL of one clock-in or clock-out photo as a real image.
 *
 * The response is cached for a year, so the record's last-change time goes in
 * the URL: a record that changes gets a new URL instead of a stale picture.
 */
export function attendancePhotoUrl(recordId: string, kind: "in" | "out", updatedAt: string): string {
  return `/api/attendance/${recordId}/photo?kind=${kind}&v=${new Date(updatedAt).getTime()}`;
}

/** The same photo as a small picture (about 160px, a few KB) for table cells and Excel sheets; other URLs are returned unchanged. */
export function attendancePhotoThumbUrl(photoUrl: string): string {
  return photoUrl.startsWith("/api/attendance/") && !photoUrl.includes("s=thumb") ? `${photoUrl}&s=thumb` : photoUrl;
}
