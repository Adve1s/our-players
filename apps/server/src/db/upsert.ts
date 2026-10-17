import { getTableColumns, type SQL, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

const excluded = (column: PgColumn) => sql.raw(`excluded."${column.name}"`);

// The idempotent upsert clause: overwrite `columns` from the incoming row and move `stamp`,
// but only when a value differs, so a repeat write touches no row (and returns none).
export function conflictUpdate<T extends PgTable>(
  table: T,
  columns: readonly (keyof T['_']['columns'] & string)[],
  stamp: keyof T['_']['columns'] & string,
): { set: Record<string, SQL>; setWhere: SQL } {
  const all: Record<string, PgColumn> = getTableColumns(table);
  const set: Record<string, SQL> = { [stamp]: sql`now()` };
  const cols = columns.map((key) => {
    const column = all[key];
    if (!column) throw new Error(`conflictUpdate: no column ${key}`);
    set[key] = excluded(column);
    return column;
  });
  const setWhere = sql`(${sql.join(cols, sql`, `)}) is distinct from (${sql.join(cols.map(excluded), sql`, `)})`;
  return { set, setWhere };
}

// Postgres rejects an upsert that hits the same row twice, so a batch keeps the last of each key.
export function lastByKey<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
