// No "server-only" marker: the background job worker (instrumentation) imports it.

export interface ValidationCounts {
  errors: number;
  warnings: number;
}

/** A safety net: every write path clears the cache (see invalidateValidationCounts). */
const TTL_MS = 5 * 60_000;

// On globalThis: request handlers and the job worker may load separate copies of
// this module.
const store = globalThis as unknown as {
  validationCounts?: Map<
    string,
    { at: number; value: Promise<ValidationCounts> }
  >;
};

/**
 * The sidebar's error and warning counts revalidate whole months (tens of
 * queries): computed once per role and month, then reused until data changes.
 */
export function cachedValidationCounts(
  key: string,
  compute: () => Promise<ValidationCounts>,
): Promise<ValidationCounts> {
  store.validationCounts ??= new Map();
  const hit = store.validationCounts.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = compute();
  store.validationCounts.set(key, { at: Date.now(), value });
  // A failed computation is not kept.
  value.catch(() => store.validationCounts?.delete(key));
  return value;
}

/** After any write to schedules or reference data. */
export function invalidateValidationCounts() {
  store.validationCounts?.clear();
}
