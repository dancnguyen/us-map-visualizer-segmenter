/** Saves a Blob as a file download. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Give the browser a moment to start the download before freeing the data.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves text (CSV by default) as a file download. */
export function downloadText(text: string, fileName: string, type = 'text/csv') {
  // The byte-order mark makes Excel read the file as UTF-8 (accents in city names).
  downloadBlob(new Blob(['﻿', text], { type: `${type};charset=utf-8` }), fileName);
}

/** "East Sales: Q3!" -> "east-sales-q3-2026-10-25" (today's date appended). */
export function fileStem(title: string, date = new Date()): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${slug || 'us-map'}-${day}`;
}
