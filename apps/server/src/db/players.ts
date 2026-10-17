import {
  type CountryCode,
  type League,
  type Player,
  type PublicId,
  resolveNationality,
} from '@our-players/shared';
import { inArray } from 'drizzle-orm';
import type { Db } from './client';
import { playerExternalIds, players } from './schema';
import { teamIdLookup } from './teams';
import { conflictUpdate, lastByKey } from './upsert';

// shortcut: letters that don't decompose (ø, ł, đ) stay as they are; upgrade when S07's search needs them
export function searchName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export async function upsertPlayers(
  db: Db,
  list: readonly Player[],
  overrides: ReadonlyMap<PublicId, { readonly nationality: CountryCode }>,
): Promise<number> {
  const batch = lastByKey(list, (p) => p.publicId);
  if (batch.length === 0) return 0;
  const teamId = await teamIdLookup(
    db,
    batch.flatMap((p) =>
      p.currentTeamExternalId === null
        ? []
        : [{ source: p.source, externalId: p.currentTeamExternalId }],
    ),
  );
  const rows = batch.map((p) => {
    const { nationality, source } = resolveNationality(p, overrides);
    return {
      publicId: p.publicId,
      league: p.league,
      firstName: p.firstName,
      lastName: p.lastName,
      searchName: searchName(`${p.firstName} ${p.lastName}`),
      position: p.position,
      positionGroup: p.positionGroup,
      currentTeamId:
        p.currentTeamExternalId === null ? null : teamId(p.source, p.currentTeamExternalId),
      jersey: p.jersey,
      birthDate: p.birthDate,
      birthCity: p.birthCity,
      birthCountry: p.birthCountry,
      nationality,
      nationalitySource: source,
    };
  });
  return db.transaction(async (tx) => {
    const written = await tx
      .insert(players)
      .values(rows)
      .onConflictDoUpdate({
        target: players.publicId,
        // `active` is the roster job's rule (S04a), so a write leaves it alone.
        ...conflictUpdate(
          players,
          [
            'league',
            'firstName',
            'lastName',
            'searchName',
            'position',
            'positionGroup',
            'currentTeamId',
            'jersey',
            'birthDate',
            'birthCity',
            'birthCountry',
            'nationality',
            'nationalitySource',
          ],
          'updatedAt',
        ),
      })
      .returning({ id: players.id });
    // Unchanged rows return nothing above, so read every ID back.
    const playerId = await playerIdLookup(
      tx,
      batch.map((p) => p.publicId),
    );
    // The public ID derives from (source, external ID), so a stored mapping never changes.
    await tx
      .insert(playerExternalIds)
      .values(
        batch.map((p) => ({
          source: p.source,
          externalId: p.externalId,
          playerId: playerId(p.publicId),
        })),
      )
      .onConflictDoNothing();
    return written.length;
  });
}

// One query for a batch's players; the returned lookup throws on a player that isn't stored.
export async function playerLookup(
  db: Db,
  publicIds: readonly PublicId[],
): Promise<(publicId: PublicId) => { id: number; league: League }> {
  const unique = [...new Set(publicIds)];
  const found =
    unique.length === 0
      ? []
      : await db
          .select({ id: players.id, league: players.league, publicId: players.publicId })
          .from(players)
          .where(inArray(players.publicId, unique));
  const rows = new Map(found.map((p) => [p.publicId, p]));
  return (publicId) => {
    const row = rows.get(publicId);
    if (row === undefined) throw new Error(`unknown player ${publicId}`);
    return row;
  };
}

export async function playerIdLookup(
  db: Db,
  publicIds: readonly PublicId[],
): Promise<(publicId: PublicId) => number> {
  const player = await playerLookup(db, publicIds);
  return (publicId) => player(publicId).id;
}
