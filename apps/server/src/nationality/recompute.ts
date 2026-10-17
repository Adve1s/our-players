import { type PublicId, resolveNationality } from '@our-players/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { searchName } from '../db/players';
import { players } from '../db/schema';
import type { NationalityOverride } from './overrides';

// For when the overrides file changes: re-resolves every stored player and checks each override.
export async function recomputeNationalities(
  db: Db,
  overrides: ReadonlyMap<PublicId, NationalityOverride>,
): Promise<{ updated: number; warnings: string[] }> {
  const stored = await db
    .select({
      id: players.id,
      publicId: players.publicId,
      birthCountry: players.birthCountry,
      firstName: players.firstName,
      lastName: players.lastName,
      searchName: players.searchName,
      nationality: players.nationality,
      nationalitySource: players.nationalitySource,
    })
    .from(players);

  const changed = stored.flatMap((p) => {
    const resolved = resolveNationality(p, overrides);
    const same = resolved.nationality === p.nationality && resolved.source === p.nationalitySource;
    return same ? [] : [{ id: p.id, ...resolved }];
  });
  if (changed.length > 0)
    await db.transaction(async (tx) => {
      for (const c of changed)
        await tx
          .update(players)
          .set({ nationality: c.nationality, nationalitySource: c.source, updatedAt: sql`now()` })
          .where(eq(players.id, c.id));
    });

  const byPublicId = new Map(stored.map((p) => [p.publicId, p]));
  const warnings: string[] = [];
  for (const o of overrides.values()) {
    const p = byPublicId.get(o.player);
    if (!p)
      warnings.push(`nationality override ${o.player} (${o.name}): player not in the database`);
    // By searchName, so case and diacritics don't warn (ESPN spells Porziņģis without them).
    else if (searchName(o.name) !== p.searchName)
      warnings.push(
        `nationality override ${o.player}: name "${o.name}" does not match stored "${p.firstName} ${p.lastName}"`,
      );
  }
  for (const w of warnings) console.warn(w);
  return { updated: changed.length, warnings };
}
