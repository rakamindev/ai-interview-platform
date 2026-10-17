/**
 * Helper to trigger browser downloads of blobs or JSON data seamlessly.
 */
export function downloadFile(data: unknown, filename: string, mimeType: string): void {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], {
          type: mimeType,
        });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
