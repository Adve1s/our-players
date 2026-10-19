import type { League, PlayerSummary, PlayersResponse, PublicId } from '@our-players/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { players, teams } from '../db/schema';

const SEARCH_LIMIT = 20;

// Players with their current team; a free agent has none.
function summaryQuery(db: Db) {
  return db
    .select({
      publicId: players.publicId,
      league: players.league,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      nationality: players.nationality,
      active: players.active,
      teamAbbrev: teams.abbrev,
      teamName: teams.name,
    })
    .from(players)
    .leftJoin(teams, eq(players.currentTeamId, teams.id));
}

type SummaryRow = Awaited<ReturnType<typeof summaryQuery>>[number];

function toSummary(row: SummaryRow): PlayerSummary {
  return {
    id: row.publicId,
    league: row.league,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    team:
      row.teamAbbrev === null || row.teamName === null
        ? null
        : { abbrev: row.teamAbbrev, name: row.teamName },
    nationality: row.nationality,
    active: row.active,
  };
}

// strpos, not LIKE: a % or _ in the term is just a character.
// shortcut: a full scan of players, add a pg_trgm index if search shows in the p95.
export async function searchPlayers(
  db: Db,
  term: string,
  leagues: ReadonlySet<League>,
): Promise<PlayersResponse> {
  const rows = await summaryQuery(db)
    .where(
      and(sql`strpos(${players.searchName}, ${term}) > 0`, inArray(players.league, [...leagues])),
    )
    .orderBy(
      desc(players.active),
      // A word start: the first name, the last name, or a part after a hyphen.
      desc(sql`strpos(' ' || translate(${players.searchName}, '-', ' '), ' ' || ${term}) > 0`),
      asc(players.lastName),
      asc(players.firstName),
      asc(players.publicId),
    )
    .limit(SEARCH_LIMIT);
  return { players: rows.map(toSummary) };
}

// Not filtered by league: favorites and hidden lists show every league.
export async function playersByIds(db: Db, ids: readonly PublicId[]): Promise<PlayersResponse> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { players: [] };
  const rows = await summaryQuery(db).where(inArray(players.publicId, unique));
  const byId = new Map(rows.map((r) => [r.publicId, r]));
  return { players: unique.flatMap((id) => byId.get(id) ?? []).map(toSummary) };
}
