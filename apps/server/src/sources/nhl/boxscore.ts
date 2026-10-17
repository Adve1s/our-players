import type { HockeyGoalieStats, Player, StatLine, Team } from '@our-players/shared';
import type { z } from 'zod';
import { lookup, parsePayload, positionGroup, toiSeconds, toTeam } from './common';
import { boxscoreSchema } from './schemas';

type Side = z.output<typeof boxscoreSchema>['playerByGameStats']['awayTeam'];
type RawPlayer = Side['forwards'][number] | Side['goalies'][number];

const DECISIONS: Readonly<Record<string, HockeyGoalieStats['decision']>> = {
  W: 'W',
  L: 'L',
  O: 'OTL',
};

function decision(value: string | undefined, where: string): HockeyGoalieStats['decision'] {
  if (value === undefined) return null;
  const mapped = lookup(DECISIONS, value);
  if (!mapped) throw new Error(`${where}: unknown decision "${value}"`);
  return mapped;
}

// The box score only gives "E. Merzlikins"; S04a enriches stubs from the player landing.
function stub(p: RawPlayer, teamExternalId: string, where: string): Player {
  const name = p.name.default;
  const space = name.indexOf(' ');
  return {
    publicId: `nhl-${p.playerId}`,
    league: 'NHL',
    source: 'nhl',
    externalId: String(p.playerId),
    firstName: space === -1 ? '' : name.slice(0, space),
    lastName: space === -1 ? name : name.slice(space + 1),
    position: p.position,
    positionGroup: positionGroup(p.position, where),
    currentTeamExternalId: teamExternalId,
    jersey: String(p.sweaterNumber),
    birthDate: null,
    birthCity: null,
    birthCountry: null,
  };
}

export function mapBoxscore(raw: unknown): {
  lines: StatLine[];
  teams: Team[];
  players: Player[];
} {
  const box = parsePayload(boxscoreSchema, 'boxscore', raw);
  const lines: StatLine[] = [];
  const players: Player[] = [];
  const sides = [
    [box.awayTeam, box.playerByGameStats.awayTeam],
    [box.homeTeam, box.playerByGameStats.homeTeam],
  ] as const;

  for (const [team, side] of sides) {
    const teamExternalId = String(team.id);
    const base = (p: RawPlayer) => {
      const where = `nhl boxscore: game ${box.id}: player ${p.playerId}`;
      players.push(stub(p, teamExternalId, where));
      // TOI 00:00 is a dressed player who never got on the ice: a DNP line (owner ruling).
      const toi = toiSeconds(p.toi, where);
      return {
        where,
        toi,
        line: {
          gamePublicId: `nhl-${box.id}`,
          playerPublicId: `nhl-${p.playerId}`,
          teamExternalId,
          dnpReason: null,
        },
      };
    };

    for (const p of [...side.forwards, ...side.defense]) {
      const { toi, line } = base(p);
      const played =
        toi === 0
          ? { played: false as const, stats: null }
          : {
              played: true as const,
              stats: {
                goals: p.goals,
                assists: p.assists,
                points: p.points,
                plusMinus: p.plusMinus,
                shots: p.sog,
                toiSeconds: toi,
                pim: p.pim,
                hits: p.hits,
                blocks: p.blockedShots,
                powerPlayGoals: p.powerPlayGoals,
              },
            };
      lines.push({ ...line, starter: null, kind: 'hockey_skater', ...played });
    }

    for (const p of side.goalies) {
      const { where, toi, line } = base(p);
      if (toi > 0 && p.shotsAgainst > 0 && p.savePctg === undefined) {
        throw new Error(`${where}: savePctg missing with ${p.shotsAgainst} shots against`);
      }
      const played =
        toi === 0
          ? { played: false as const, stats: null }
          : {
              played: true as const,
              stats: {
                saves: p.saves,
                shotsAgainst: p.shotsAgainst,
                goalsAgainst: p.goalsAgainst,
                savePct: p.shotsAgainst === 0 ? null : (p.savePctg ?? null),
                toiSeconds: toi,
                decision: decision(p.decision, where),
              },
            };
      // Preseason box scores have no starter field.
      lines.push({ ...line, starter: p.starter ?? null, kind: 'hockey_goalie', ...played });
    }
  }

  return {
    lines,
    teams: [box.awayTeam, box.homeTeam].map((t) => toTeam(t.id, t.abbrev, t.commonName.default)),
    players,
  };
}
