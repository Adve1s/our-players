import { z } from 'zod';
import type { PoliteClient } from '../../src/http/polite-client';
import { nhlEndpoints } from '../../src/sources/nhl/endpoints';

const STATS = 'https://api.nhle.com/stats/rest/en';

const scoreSchema = z.object({
  games: z.array(z.object({ id: z.number(), gameState: z.string() })),
});

const biosSchema = z.object({
  data: z.array(z.object({ playerId: z.number() })),
  total: z.number(),
});

const skaterSchema = z.object({
  playerId: z.number(),
  name: z.object({ default: z.string() }),
  position: z.string(),
  goals: z.number(),
  assists: z.number(),
  points: z.number(),
  plusMinus: z.number(),
  sog: z.number(),
  toi: z.string(),
});

const goalieSchema = z.object({
  playerId: z.number(),
  name: z.object({ default: z.string() }),
  saves: z.number(),
  shotsAgainst: z.number(),
  goalsAgainst: z.number(),
  savePctg: z.number().optional(),
  toi: z.string(),
  decision: z.string().optional(),
});

const teamStatsSchema = z.object({
  forwards: z.array(skaterSchema),
  defense: z.array(skaterSchema),
  goalies: z.array(goalieSchema),
});

const boxscoreSchema = z.object({
  awayTeam: z.object({ abbrev: z.string(), score: z.number().optional() }),
  homeTeam: z.object({ abbrev: z.string(), score: z.number().optional() }),
  gameOutcome: z.object({ lastPeriodType: z.string() }).optional(),
  playerByGameStats: z.object({ awayTeam: teamStatsSchema, homeTeam: teamStatsSchema }),
});

function parse<T>(schema: z.ZodType<T>, body: string, what: string): T {
  const result = schema.safeParse(JSON.parse(body));
  if (!result.success) throw new Error(`nhl ${what}: ${z.prettifyError(result.error)}`);
  return result.data;
}

/** NHL season ID for a game day: games from July on belong to the season starting that year. */
function seasonId(date: string): string {
  const year = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? year : year - 1;
  return `${start}${start + 1}`;
}

// The stats API filters by birth country server-side: two requests cover every Latvian who
// played that season, whichever team he was on at the time.
async function latvianIds(client: PoliteClient, date: string): Promise<Set<number>> {
  const ids = new Set<number>();
  for (const kind of ['skater', 'goalie'] as const) {
    const params = new URLSearchParams({
      limit: '100',
      cayenneExp: `seasonId=${seasonId(date)} and birthCountryCode="LVA"`,
    });
    const bios = parse(
      biosSchema,
      (await client.get(`${STATS}/${kind}/bios?${params}`)).body,
      `${kind}/bios`,
    );
    for (const row of bios.data) ids.add(row.playerId);
  }
  return ids;
}

export async function nhlLines(client: PoliteClient, date: string): Promise<string[]> {
  const score = parse(scoreSchema, (await client.get(nhlEndpoints.score(date))).body, 'score');
  if (score.games.length === 0) return [`NHL  no games on ${date}`];
  const started = score.games.filter((game) => !['FUT', 'PRE'].includes(game.gameState));
  if (started.length === 0) return [`NHL  no started games on ${date}`];
  const latvians = await latvianIds(client, date);

  const lines: string[] = [];
  for (const game of started) {
    const box = parse(
      boxscoreSchema,
      (await client.get(nhlEndpoints.boxscore(String(game.id)))).body,
      `boxscore ${game.id}`,
    );
    const ended = box.gameOutcome ? ` (${box.gameOutcome.lastPeriodType})` : '';
    const header = `${box.awayTeam.abbrev} ${box.awayTeam.score ?? '-'} @ ${box.homeTeam.abbrev} ${box.homeTeam.score ?? '-'}${ended}`;
    for (const side of ['awayTeam', 'homeTeam'] as const) {
      const team = box[side].abbrev;
      const stats = box.playerByGameStats[side];
      for (const s of [...stats.forwards, ...stats.defense]) {
        if (!latvians.has(s.playerId)) continue;
        if (s.toi === '00:00') {
          lines.push(`NHL  ${header}  ${s.name.default} (${team}, ${s.position})  DNP`);
          continue;
        }
        const pm = s.plusMinus > 0 ? `+${s.plusMinus}` : String(s.plusMinus);
        lines.push(
          `NHL  ${header}  ${s.name.default} (${team}, ${s.position})  ${s.goals} G  ${s.assists} A  ${s.points} P  ${pm}  ${s.sog} SOG  ${s.toi} TOI`,
        );
      }
      for (const g of stats.goalies) {
        if (!latvians.has(g.playerId)) continue;
        // A dressed backup who never went in (D-024).
        if (g.toi === '00:00') {
          lines.push(`NHL  ${header}  ${g.name.default} (${team}, G)  DNP`);
          continue;
        }
        const pct = g.savePctg === undefined ? '—' : g.savePctg.toFixed(3).replace(/^0/, '');
        lines.push(
          `NHL  ${header}  ${g.name.default} (${team}, G)  ${g.saves}/${g.shotsAgainst} SV  ${g.goalsAgainst} GA  ${pct}  ${g.toi} TOI  ${g.decision ?? 'no decision'}`,
        );
      }
    }
  }
  return lines.length > 0 ? lines : [`NHL  no Latvians played on ${date}`];
}
