import { PDFDocument } from "pdf-lib";

/** Gộp nhiều file PDF thành một (in hàng loạt). */
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const indices = doc.getPageIndices();
    const pages = await merged.copyPages(doc, indices);
    for (const page of pages) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}
