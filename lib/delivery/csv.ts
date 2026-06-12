export type CsvValue = string | number | boolean | null | undefined;

function escapeField(v: CsvValue): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** RFC 4180 CSV with CRLF line endings + a UTF-8 BOM so Excel/Sheets open it cleanly. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeField).join(','), ...rows.map((r) => r.map(escapeField).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
