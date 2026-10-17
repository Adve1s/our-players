import type { Source, Team } from '@our-players/shared';
import { inArray } from 'drizzle-orm';
import type { Db } from './client';
import { teams } from './schema';
import { conflictUpdate, lastByKey } from './upsert';

const teamKey = (source: Source, externalId: string) => `${source}/${externalId}`;

export async function upsertTeams(db: Db, list: readonly Team[]): Promise<number> {
  const rows = lastByKey(list, (t) => teamKey(t.source, t.externalId));
  if (rows.length === 0) return 0;
  const written = await db
    .insert(teams)
    .values(rows)
    .onConflictDoUpdate({
      target: [teams.source, teams.externalId],
      ...conflictUpdate(teams, ['league', 'abbrev', 'name'], 'updatedAt'),
    })
    .returning({ id: teams.id });
  return written.length;
}

// One query for a batch's teams; the returned lookup throws on a team that isn't stored.
export async function teamIdLookup(
  db: Db,
  refs: readonly { source: Source; externalId: string }[],
): Promise<(source: Source, externalId: string) => number> {
  const externalIds = [...new Set(refs.map((r) => r.externalId))];
  const found =
    externalIds.length === 0
      ? []
      : await db
          .select({ id: teams.id, source: teams.source, externalId: teams.externalId })
          .from(teams)
          .where(inArray(teams.externalId, externalIds));
  // External IDs repeat across sources (NYI and the Celtics are both '2'), so key by both.
  const ids = new Map(found.map((t) => [teamKey(t.source, t.externalId), t.id]));
  return (source, externalId) => {
    const id = ids.get(teamKey(source, externalId));
    if (id === undefined) throw new Error(`unknown team ${teamKey(source, externalId)}`);
    return id;
  };
}
