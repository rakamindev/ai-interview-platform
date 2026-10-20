import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Extracts clean, human-readable text from a PDF file or binary buffer.
 * Replaces raw PDF bytecode (%PDF-1.7...) with actual document text across all pages.
 */
export async function extractTextFromPdf(
  fileOrBuffer: File | ArrayBuffer | Uint8Array
): Promise<string> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : fileOrBuffer instanceof Uint8Array
      ? fileOrBuffer.buffer
      : await fileOrBuffer.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageStrings: string[] = [];

    for (const item of textContent.items) {
      if ("str" in item && typeof item.str === "string") {
        pageStrings.push(item.str);
      }
    }

    if (pageStrings.length > 0) {
      pageTexts.push(pageStrings.join(" ").replace(/\s{2,}/g, " ").trim());
    }
  }

  return pageTexts.join("\n\n").trim();
}
