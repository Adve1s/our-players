import type { CountryCode, HockeyGoalieStats, HockeySkaterStats, Prefs } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import {
  type DayGame,
  type DayLine,
  type DayPlayer,
  type DayTeam,
  gameDayRows,
} from '../src/game-day-rows';

const CBJ: DayTeam = { id: 1, abbrev: 'CBJ' };
const PIT: DayTeam = { id: 2, abbrev: 'PIT' };
const TBL: DayTeam = { id: 3, abbrev: 'TBL' };
const BOS: DayTeam = { id: 4, abbrev: 'BOS' };

const prefs = (over: Partial<Prefs> = {}): Prefs => ({
  leagues: new Set(['NHL', 'NBA']),
  countries: new Set(['LVA']),
  favorites: new Set(),
  hidden: new Set(),
  ...over,
});

function game(
  publicId: string,
  away: DayTeam,
  home: DayTeam,
  over: Partial<DayGame> = {},
): DayGame {
  return {
    publicId,
    league: 'NHL',
    status: 'FINAL',
    startTimeUtc: '2026-01-18T00:00:00.000Z',
    away,
    home,
    awayScore: 4,
    homeScore: 3,
    endedIn: 'REG',
    boxScoreStored: true,
    ...over,
  };
}

function player(
  publicId: string,
  currentTeamId: number | null,
  nationality: CountryCode = 'LVA',
): DayPlayer {
  return {
    publicId,
    league: 'NHL',
    nationality,
    firstName: 'First',
    lastName: publicId,
    currentTeamId,
  };
}

const skater = (points: number): HockeySkaterStats => ({
  goals: points,
  assists: 0,
  points,
  plusMinus: 0,
  shots: 1,
  toiSeconds: 900,
});
const goalie: HockeyGoalieStats = {
  saves: 30,
  shotsAgainst: 33,
  goalsAgainst: 3,
  savePct: 0.909091,
  toiSeconds: 3900,
  decision: 'W',
};

function skaterLine(gamePublicId: string, p: DayPlayer, team: DayTeam, points: number): DayLine {
  return {
    gamePublicId,
    playerPublicId: p.publicId,
    teamExternalId: String(team.id),
    teamId: team.id,
    dnpReason: null,
    starter: null,
    kind: 'hockey_skater',
    played: true,
    stats: skater(points),
  };
}
function goalieLine(gamePublicId: string, p: DayPlayer, team: DayTeam): DayLine {
  return {
    gamePublicId,
    playerPublicId: p.publicId,
    teamExternalId: String(team.id),
    teamId: team.id,
    dnpReason: null,
    starter: true,
    kind: 'hockey_goalie',
    played: true,
    stats: goalie,
  };
}
function dnpLine(
  gamePublicId: string,
  p: DayPlayer,
  team: DayTeam,
  reason: string | null,
): DayLine {
  return {
    gamePublicId,
    playerPublicId: p.publicId,
    teamExternalId: String(team.id),
    teamId: team.id,
    dnpReason: reason,
    starter: false,
    kind: 'hockey_skater',
    played: false,
    stats: null,
  };
}

const G1 = 'nhl-1';
const G2 = 'nhl-2';
const one = game(G1, CBJ, PIT);

// One game's rows as `kind:publicId`, for compact assertions.
function rowsOf(day: Parameters<typeof gameDayRows>[0], p: Prefs = prefs()) {
  return gameDayRows(day, p).map((g) => ({
    game: g.game.publicId,
    rows: g.rows.map((r) => `${r.kind}:${r.player.publicId}`),
  }));
}

describe('gameDayRows', () => {
  it('a shown player with a played line gets a line row', () => {
    const p = player('nhl-10', CBJ.id);
    const [group] = gameDayRows(
      { games: [one], lines: [skaterLine(G1, p, CBJ, 2)], players: [p] },
      prefs(),
    );
    const [row] = group?.rows ?? [];
    expect(row?.kind).toBe('line');
    expect(row?.team).toEqual(CBJ);
    expect(row?.kind === 'line' && row.line.stats).toEqual(skater(2));
  });

  it('a non-LVA player gets no row', () => {
    const p = player('nhl-10', CBJ.id, 'SWE');
    expect(rowsOf({ games: [one], lines: [skaterLine(G1, p, CBJ, 2)], players: [p] })).toEqual([]);
  });

  it('a hidden LVA player gets no row', () => {
    const p = player('nhl-10', CBJ.id);
    const day = { games: [one], lines: [skaterLine(G1, p, CBJ, 2)], players: [p] };
    expect(rowsOf(day, prefs({ hidden: new Set(['nhl-10']) }))).toEqual([]);
  });

  it('a favorite non-LVA player gets a row', () => {
    const p = player('nhl-10', CBJ.id, 'SWE');
    const day = { games: [one], lines: [skaterLine(G1, p, CBJ, 2)], players: [p] };
    expect(rowsOf(day, prefs({ favorites: new Set(['nhl-10']) }))).toEqual([
      { game: G1, rows: ['line:nhl-10'] },
    ]);
  });

  it('a played: false line is a dnp row with its reason', () => {
    const p = player('nhl-10', CBJ.id);
    const [group] = gameDayRows(
      { games: [one], lines: [dnpLine(G1, p, CBJ, "COACH'S DECISION")], players: [p] },
      prefs(),
    );
    const [row] = group?.rows ?? [];
    expect(row?.kind).toBe('dnp');
    expect(row?.kind === 'dnp' && row.reason).toBe("COACH'S DECISION");
  });

  it('a shown player whose current team played a FINAL game without him is not in lineup', () => {
    const p = player('nhl-10', PIT.id);
    const [group] = gameDayRows({ games: [one], lines: [], players: [p] }, prefs());
    const [row] = group?.rows ?? [];
    expect(row?.kind).toBe('not-in-lineup');
    expect(row?.team).toEqual(PIT);
  });

  it("no not-in-lineup row when the game isn't FINAL", () => {
    const p = player('nhl-10', PIT.id);
    const live = game(G1, CBJ, PIT, { status: 'LIVE' });
    expect(rowsOf({ games: [live], lines: [], players: [p] })).toEqual([]);
  });

  it("no not-in-lineup row for a FINAL game whose box score isn't stored", () => {
    const p = player('nhl-10', PIT.id);
    const unfetched = game(G1, CBJ, PIT, { boxScoreStored: false });
    expect(rowsOf({ games: [unfetched], lines: [], players: [p] })).toEqual([]);
  });

  it('a line whose team is neither away nor home throws', () => {
    const p = player('nhl-10', TBL.id);
    const day = { games: [one], lines: [skaterLine(G1, p, TBL, 1)], players: [p] };
    expect(() => gameDayRows(day, prefs())).toThrow(
      'stat line nhl-1/nhl-10: team 3 not in the game',
    );
  });

  it('no row for a player with no current team', () => {
    const p = player('nhl-10', null);
    expect(rowsOf({ games: [one], lines: [], players: [p] })).toEqual([]);
  });

  it('games without shown players are left out; groups are in start-time order', () => {
    const early = game(G2, TBL, BOS, { startTimeUtc: '2026-01-17T23:00:00.000Z' });
    const empty = game('nhl-3', { id: 5, abbrev: 'NYR' }, { id: 6, abbrev: 'NJD' });
    const a = player('nhl-10', CBJ.id);
    const b = player('nhl-11', TBL.id);
    const day = {
      games: [one, empty, early],
      lines: [skaterLine(G1, a, CBJ, 1), skaterLine(G2, b, TBL, 1)],
      players: [a, b],
    };
    expect(rowsOf(day).map((g) => g.game)).toEqual([G2, G1]);
  });

  it('rows: away team first; skaters by points descending, then goalies, then dnp and not-in-lineup', () => {
    const homeSkater = player('nhl-20', PIT.id);
    const awayLow = player('nhl-10', CBJ.id);
    const awayHigh = player('nhl-11', CBJ.id);
    const awayGoalie = player('nhl-12', CBJ.id);
    const awayDnp = player('nhl-13', CBJ.id);
    const awayScratch = player('nhl-14', CBJ.id);
    const day = {
      games: [one],
      lines: [
        skaterLine(G1, homeSkater, PIT, 3),
        dnpLine(G1, awayDnp, CBJ, null),
        goalieLine(G1, awayGoalie, CBJ),
        skaterLine(G1, awayLow, CBJ, 0),
        skaterLine(G1, awayHigh, CBJ, 2),
      ],
      players: [awayScratch, homeSkater, awayLow, awayHigh, awayGoalie, awayDnp],
    };
    expect(rowsOf(day)).toEqual([
      {
        game: G1,
        rows: [
          'line:nhl-11',
          'line:nhl-10',
          'line:nhl-12',
          'dnp:nhl-13',
          'not-in-lineup:nhl-14',
          'line:nhl-20',
        ],
      },
    ]);
  });
});
