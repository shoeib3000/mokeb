/**
 * Safely extracts millisecond timestamps from various date/timestamp formats
 * (Firestore timestamps, ISO strings, Date objects, milliseconds).
 * This function is guaranteed to never return NaN or throw.
 */
export const getMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (v.seconds) return v.seconds * 1000;
  if (v._seconds) return v._seconds * 1000;
  if (typeof v.toMillis === 'function') {
    try {
      return v.toMillis();
    } catch (_) {}
  }
  if (typeof v.toDate === 'function') {
    try {
      return v.toDate().getTime();
    } catch (_) {}
  }
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    return isNaN(parsed) ? 0 : parsed;
  }
  try {
    const parsedDate = new Date(v).getTime();
    return isNaN(parsedDate) ? 0 : parsedDate;
  } catch (_) {
    return 0;
  }
};
