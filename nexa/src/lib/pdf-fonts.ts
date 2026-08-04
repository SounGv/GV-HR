import type { jsPDF } from "jspdf";

async function loadFontBase64(url: string): Promise<string> {
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * jsPDF's built-in fonts (helvetica, etc.) have no Thai glyphs — without this,
 * Thai text in exported PDFs renders as blank boxes. Registers Sarabun
 * (SIL OFL, public/fonts/) as a real embedded font instead.
 */
export async function registerThaiFont(doc: jsPDF): Promise<string> {
  const [regular, bold] = await Promise.all([
    loadFontBase64("/fonts/Sarabun-Regular.ttf"),
    loadFontBase64("/fonts/Sarabun-Bold.ttf"),
  ]);
  doc.addFileToVFS("Sarabun-Regular.ttf", regular);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", bold);
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  return "Sarabun";
}
