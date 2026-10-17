// Fixture JSON arrives as `unknown`; these let a test reach into its own copy to read or mutate it.
export type JsonObject = Record<string, unknown>;

export function obj(root: unknown, ...path: (string | number)[]): JsonObject {
  let current = root;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) {
      throw new Error(`fixture path ${path.join('.')}: no object at ${key}`);
    }
    current = (current as JsonObject)[String(key)];
  }
  if (typeof current !== 'object' || current === null) {
    throw new Error(`fixture path ${path.join('.')}: not an object`);
  }
  return current as JsonObject;
}

export function list(root: unknown, ...path: (string | number)[]): JsonObject[] {
  const value = obj(root, ...path);
  if (!Array.isArray(value)) throw new Error(`fixture path ${path.join('.')}: not an array`);
  return value as JsonObject[];
}

// The one item matching, or a clear failure instead of an undefined further down the test.
export function only<T>(items: readonly T[], match: (item: T) => boolean, what: string): T {
  const found = items.filter(match);
  if (found.length !== 1) throw new Error(`expected exactly one ${what}, found ${found.length}`);
  return found[0] as T;
}
