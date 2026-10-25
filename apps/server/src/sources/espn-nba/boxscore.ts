import type { BasketballPlayerStats, Player, StatLine, Team } from '@our-players/shared';
import type { z } from 'zod';
import { parsePayload, position, toTeam } from './common';
import { summarySchema } from './schemas';

type Side = NonNullable<z.output<typeof summarySchema>['boxscore']['players']>[number];
type RawRow = Side['statistics'][0]['athletes'][number];
type Athlete = Extract<RawRow['athlete'], { id: string }>;

// Every label we read; stats are mapped by label, never by position (adapters.md).
const LABELS = [
  'MIN',
  'PTS',
  'FG',
  '3PT',
  'FT',
  'REB',
  'AST',
  'TO',
  'STL',
  'BLK',
  'OREB',
  'DREB',
  'PF',
  '+/-',
] as const;
type Label = (typeof LABELS)[number];

function columns(labels: string[], where: string): Record<Label, number> {
  const index: Partial<Record<Label, number>> = {};
  for (const label of LABELS) {
    const i = labels.indexOf(label);
    if (i === -1) throw new Error(`${where}: missing label "${label}"`);
    index[label] = i;
  }
  return index as Record<Label, number>;
}

function stats(row: RawRow, cols: Record<Label, number>, where: string): BasketballPlayerStats {
  const raw = (label: Label) => row.stats[cols[label]] as string;
  // Counts are plain digits; only "+/-" carries a sign ("+7", "-8", "0").
  const int = (label: Label) => {
    const value = raw(label);
    // A played row can show MIN "--" with every count 0 (2026-10-23, game 401909095).
    if (label === 'MIN' && value === '--') return 0;
    if (!(label === '+/-' ? /^[+-]?\d+$/ : /^\d+$/).test(value)) {
      throw new Error(`${where}: malformed ${label} "${value}"`);
    }
    return Number(value);
  };
  // "8-13" → made 8, attempted 13.
  const split = (label: Label) => {
    const match = /^(\d+)-(\d+)$/.exec(raw(label));
    if (!match) throw new Error(`${where}: malformed ${label} "${raw(label)}"`);
    return [Number(match[1]), Number(match[2])] as const;
  };
  const [fgMade, fgAttempted] = split('FG');
  const [threeMade, threeAttempted] = split('3PT');
  const [ftMade, ftAttempted] = split('FT');
  return {
    minutes: int('MIN'),
    points: int('PTS'),
    fgMade,
    fgAttempted,
    threeMade,
    threeAttempted,
    ftMade,
    ftAttempted,
    rebounds: int('REB'),
    assists: int('AST'),
    turnovers: int('TO'),
    steals: int('STL'),
    blocks: int('BLK'),
    offRebounds: int('OREB'),
    defRebounds: int('DREB'),
    fouls: int('PF'),
    plusMinus: int('+/-'),
  };
}

// The box score only gives a display name and no birth data; S04a enriches stubs from the athlete endpoint.
function stub(athlete: Athlete, teamExternalId: string, where: string): Player {
  const { id, displayName, jersey } = athlete;
  const space = displayName.indexOf(' ');
  return {
    publicId: `nba-${id}`,
    league: 'NBA',
    source: 'espn',
    externalId: id,
    firstName: space === -1 ? '' : displayName.slice(0, space),
    lastName: space === -1 ? displayName : displayName.slice(space + 1),
    ...position(athlete.position.abbreviation, where),
    currentTeamExternalId: teamExternalId,
    jersey: jersey ?? null,
    birthDate: null,
    birthCity: null,
    birthCountry: null,
  };
}

// One line and one stub per athlete row; a player absent from the box score gets neither.
export function mapSummary(raw: unknown): { lines: StatLine[]; teams: Team[]; players: Player[] } {
  const summary = parsePayload(summarySchema, 'summary', raw);
  const gameId = summary.header.id;
  const where = `espn-nba summary: game ${gameId}`;
  const sides = summary.boxscore.players;
  if (!sides?.length) throw new Error(`${where}: no box score players (game not started?)`);

  const lines: StatLine[] = [];
  const players: Player[] = [];
  for (const side of sides) {
    const block = side.statistics[0];
    const cols = columns(block.labels, where);
    for (const row of block.athletes) {
      const { athlete } = row;
      // The schema lets only a DNP row through without an athlete ID (schemas.ts).
      if (!('displayName' in athlete)) continue;
      const { id } = athlete;
      const rowWhere = `${where}: player ${id}`;
      players.push(stub(athlete, side.team.id, rowWhere));
      const line = {
        gamePublicId: `nba-${gameId}`,
        playerPublicId: `nba-${id}`,
        teamExternalId: side.team.id,
        starter: row.starter,
        kind: 'basketball_player' as const,
      };
      // Every played row also says "COACH'S DECISION", so reason is read only for a DNP row.
      if (!row.didNotPlay && row.stats.length !== block.labels.length) {
        throw new Error(`${rowWhere}: ${row.stats.length} stats for ${block.labels.length} labels`);
      }
      lines.push(
        row.didNotPlay
          ? { ...line, played: false, stats: null, dnpReason: row.reason ?? null }
          : { ...line, played: true, stats: stats(row, cols, rowWhere), dnpReason: null },
      );
    }
  }
  return { lines, teams: sides.map((s) => toTeam(s.team)), players };
}
