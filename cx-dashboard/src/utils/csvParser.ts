import Papa from 'papaparse';
import type { VulnerabilityRow } from '../types';

export function parseCSV(file: File): Promise<VulnerabilityRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<VulnerabilityRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          reject(new Error(result.errors[0].message));
        } else {
          resolve(result.data);
        }
      },
      error: (err: Error) => reject(err),
    });
  });
}

export function extractTimestampFromFilename(filename: string): Date {
  const match = filename.match(/(\d{8})_(\d{6})/);
  if (match) {
    const [, datePart, timePart] = match;
    const iso = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function formatTimestamp(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
