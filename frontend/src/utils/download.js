/** Helpers for saving a file that the server generated. */

/**
 * Reads the file name from a Content-Disposition header. Only plain names (letters, digits, dot, dash, underscore)
 * are accepted, so a header can never make the browser save to a different folder or with a strange extension.
 */
export function filenameFromDisposition(header, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(header || '');
  const name = match ? match[1].trim() : '';
  return /^[\w.-]+$/.test(name) && !name.startsWith('.') ? name : fallback;
}

/** Saves a Blob as a download. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
