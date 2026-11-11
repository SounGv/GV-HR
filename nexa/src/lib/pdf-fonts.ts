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
 * Thai text in exported PDFs renders as blank boxes. Registers Anuphan, the
 * same face as the app (SIL OFL, static TTFs from github.com/cadsondemak/Anuphan
 * in public/fonts/, licence in Anuphan-OFL.txt), as a real embedded font.
 */
export async function registerThaiFont(doc: jsPDF): Promise<string> {
  const [regular, bold] = await Promise.all([
    loadFontBase64("/fonts/Anuphan-Regular.ttf"),
    loadFontBase64("/fonts/Anuphan-Bold.ttf"),
  ]);
  doc.addFileToVFS("Anuphan-Regular.ttf", regular);
  doc.addFont("Anuphan-Regular.ttf", "Anuphan", "normal");
  doc.addFileToVFS("Anuphan-Bold.ttf", bold);
  doc.addFont("Anuphan-Bold.ttf", "Anuphan", "bold");
  return "Anuphan";
}
