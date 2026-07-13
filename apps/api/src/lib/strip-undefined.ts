type WithoutUndefinedValues<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

// Zod's `.optional()` fields come back as `{ key?: T | undefined }`, but Prisma's
// input types (compiled under exactOptionalPropertyTypes) want `{ key?: T }` —
// a key that's either absent or a real value, never present-and-undefined.
// This bridges the two without hand-writing a stripped literal per route.
export function stripUndefined<T extends Record<string, unknown>>(obj: T): WithoutUndefinedValues<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as WithoutUndefinedValues<T>;
}
