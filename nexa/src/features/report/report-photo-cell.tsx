/** Small clickable thumbnail for a photo-flagged report column — "-" (no
 * photo attached) renders as plain text, same as every other empty cell.
 * Shared by the desktop table and the mobile card list. */
export function PhotoCell({ url, onOpen }: { url: string | number; onOpen: (url: string) => void }) {
  if (typeof url !== "string" || !url || url === "-") return <span className="text-muted-foreground">-</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="block size-10 overflow-hidden rounded-md border border-border transition hover:opacity-80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="รูปถ่ายลงเวลา" className="size-full object-cover" />
    </button>
  );
}
