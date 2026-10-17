// Throwaway: replaced by pnpm recap in S04a.
// shortcut: NBA Latvians come from current rosters, so old dates can miss traded players; S04a's recap reads stored players instead
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../../src/config';
import { createPoliteClient, userAgent } from '../../src/http/polite-client';
import { endpoints } from '../endpoints';

// Local shapes for the fields the spike reads; unchecked casts are fine for throwaway code.
type Bios = { data: { playerId: number; skaterFullName?: string; goalieFullName?: string }[] };
type Score = { games: { id: number }[] };
type NhlPlayer = {
  playerId: number;
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  sog?: number;
  toi?: string;
  saveShotsAgainst?: string;
  decision?: string;
};
type NhlSide = { forwards: NhlPlayer[]; defense: NhlPlayer[]; goalies: NhlPlayer[] };
type Boxscore = {
  awayTeam: { abbrev: string };
  homeTeam: { abbrev: string };
  playerByGameStats: { awayTeam: NhlSide; homeTeam: NhlSide };
};
type Scoreboard = {
  events: { id: string; competitions: { competitors: { team: { id: string } }[] }[] }[];
};
type Roster = {
  athletes: { id: string; displayName: string; birthPlace?: { country?: string } }[];
};
type Summary = {
  boxscore: {
    players: {
      team: { abbreviation: string };
      statistics: {
        labels: string[];
        athletes: {
          athlete: { id: string };
          didNotPlay?: boolean;
          reason?: string;
          stats: string[];
        }[];
      }[];
    }[];
  };
};

// NHL seasons start in autumn: a July–December date belongs to the season starting that year.
function nhlSeasonId(date: string): string {
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}${start + 1}`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { date: { type: 'string' } } });
  const date = values.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('usage: pnpm spike --date YYYY-MM-DD');

  const pkg = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as {
    version: string;
  };
  const client = createPoliteClient({
    userAgent: userAgent(pkg.version, loadConfig(process.env).contactUrl),
  });
  const getJson = async <T>(url: string): Promise<T> => {
    const body: unknown = JSON.parse((await client.get(url)).text);
    return body as T;
  };
  const started = performance.now();

  try {
    // NHL: Latvian IDs from the nationality-filtered bios, then every box score of the day.
    const season = nhlSeasonId(date);
    const latvians = new Map<number, string>();
    for (const ep of ['skater-bios-lva', 'goalie-bios-lva'] as const) {
      const bios = await getJson<Bios>(endpoints.nhl[ep]?.(season) ?? '');
      for (const r of bios.data)
        latvians.set(r.playerId, r.skaterFullName ?? r.goalieFullName ?? '?');
    }
    const score = await getJson<Score>(endpoints.nhl.score?.(date) ?? '');
    for (const game of score.games) {
      const box = await getJson<Boxscore>(endpoints.nhl.boxscore?.(String(game.id)) ?? '');
      for (const [side, team] of [
        [box.playerByGameStats.awayTeam, box.awayTeam.abbrev],
        [box.playerByGameStats.homeTeam, box.homeTeam.abbrev],
      ] as const) {
        for (const p of [...side.forwards, ...side.defense]) {
          const name = latvians.get(p.playerId);
          if (name === undefined || !p.toi || p.toi === '00:00') continue;
          console.log(
            `NHL  ${name}  ${team}  G ${p.goals} A ${p.assists} P ${p.points} +/- ${p.plusMinus} SOG ${p.sog} TOI ${p.toi}`,
          );
        }
        for (const p of side.goalies) {
          const name = latvians.get(p.playerId);
          if (name === undefined || !p.toi || p.toi === '00:00') continue;
          console.log(`NHL  ${name}  ${team}  SV ${p.saveShotsAgainst} DEC ${p.decision ?? '-'}`);
        }
      }
    }

    // NBA: each playing team's roster → Latvian-born athletes → summaries of their games.
    const board = await getJson<Scoreboard>(endpoints['espn-nba'].scoreboard?.(date) ?? '');
    const nbaLatvians = new Map<string, string>(); // athlete id → name
    const gamesWithLatvians = new Set<string>();
    for (const ev of board.events) {
      for (const c of ev.competitions[0]?.competitors ?? []) {
        const roster = await getJson<Roster>(endpoints['espn-nba'].roster?.(c.team.id) ?? '');
        for (const a of roster.athletes) {
          if (a.birthPlace?.country !== 'Latvia') continue;
          nbaLatvians.set(a.id, a.displayName);
          gamesWithLatvians.add(ev.id);
        }
      }
    }
    for (const eventId of gamesWithLatvians) {
      const summary = await getJson<Summary>(endpoints['espn-nba'].summary?.(eventId) ?? '');
      for (const teamBox of summary.boxscore.players) {
        const s = teamBox.statistics[0];
        if (!s) continue;
        for (const a of s.athletes) {
          const name = nbaLatvians.get(a.athlete.id);
          if (name === undefined) continue;
          const prefix = `NBA  ${name}  ${teamBox.team.abbreviation}  `;
          if (a.didNotPlay) {
            console.log(`${prefix}DNP (${a.reason ?? 'no reason'})`);
            continue;
          }
          // Map by label, never by position: ESPN may reorder columns.
          const stat = (label: string) => a.stats[s.labels.indexOf(label)] ?? '?';
          console.log(
            `${prefix}MIN ${stat('MIN')} PTS ${stat('PTS')} REB ${stat('REB')} AST ${stat('AST')} FG ${stat('FG')} 3PT ${stat('3PT')} FT ${stat('FT')}`,
          );
        }
      }
    }
  } finally {
    const hosts = [...client.requestsByHost].map(([h, n]) => `${h}: ${n}`).join(', ');
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`requests: ${client.requestCount} (${hosts})  runtime: ${secs}s`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
