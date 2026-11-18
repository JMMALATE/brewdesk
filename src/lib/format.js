const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const formatPeso = (n) => peso.format(Number(n) || 0);

export const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null);

export const formatDateTime = (ts) =>
  toDate(ts)?.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) ?? '';

export const formatTime = (ts) =>
  toDate(ts)?.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) ?? '';

export const round2 = (n) => Math.round(n * 100) / 100;
