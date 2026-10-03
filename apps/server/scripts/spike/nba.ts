import { z } from 'zod';
import type { PoliteClient } from '../../src/http/polite-client';
import { espnNbaEndpoints } from '../../src/sources/espn-nba/endpoints';

const TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';

const scoreboardSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      status: z.object({ type: z.object({ state: z.string() }) }),
    }),
  ),
});

const teamsSchema = z.object({
  sports: z.array(
    z.object({
      leagues: z.array(
        z.object({ teams: z.array(z.object({ team: z.object({ id: z.string() }) })) }),
      ),
    }),
  ),
});

const rosterSchema = z.object({
  athletes: z.array(
    z.object({
      id: z.string(),
      birthPlace: z.object({ country: z.string().optional() }).optional(),
    }),
  ),
});

const summarySchema = z.object({
  header: z.object({
    competitions: z.array(
      z.object({
        status: z.object({ type: z.object({ shortDetail: z.string() }) }),
        competitors: z.array(
          z.object({
            homeAway: z.string(),
            score: z.string().optional(),
            team: z.object({ abbreviation: z.string() }),
          }),
        ),
      }),
    ),
  }),
  boxscore: z.object({
    players: z.array(
      z.object({
        team: z.object({ abbreviation: z.string() }),
        statistics: z.array(
          z.object({
            labels: z.array(z.string()),
            athletes: z.array(
              z.object({
                athlete: z.object({
                  id: z.string(),
                  displayName: z.string(),
                  position: z.object({ abbreviation: z.string() }).optional(),
                }),
                didNotPlay: z.boolean().optional(),
                reason: z.string().optional(),
                stats: z.array(z.string()),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
});

function parse<T>(schema: z.ZodType<T>, body: string, what: string): T {
  const result = schema.safeParse(JSON.parse(body));
  if (!result.success) throw new Error(`espn-nba ${what}: ${z.prettifyError(result.error)}`);
  return result.data;
}

// ESPN has no past-season rosters (`?season=` returns no athletes) and box scores carry no
// birthplace, so the spike reads every current roster. It finds today's NBA Latvians on any past
// date, whichever team they played for then.
async function latvianIds(client: PoliteClient): Promise<Set<string>> {
  const teams = parse(teamsSchema, (await client.get(TEAMS)).body, 'teams');
  const ids = new Set<string>();
  for (const { team } of teams.sports[0]?.leagues[0]?.teams ?? []) {
    const roster = parse(
      rosterSchema,
      (await client.get(espnNbaEndpoints.roster(team.id))).body,
      `roster ${team.id}`,
    );
    for (const athlete of roster.athletes) {
      if (athlete.birthPlace?.country === 'Latvia') ids.add(athlete.id);
    }
  }
  return ids;
}

export async function nbaLines(client: PoliteClient, date: string): Promise<string[]> {
  const scoreboard = parse(
    scoreboardSchema,
    (await client.get(espnNbaEndpoints.scoreboard(date))).body,
    'scoreboard',
  );
  const started = scoreboard.events.filter((event) => event.status.type.state !== 'pre');
  if (started.length === 0) return [`NBA  no started games on ${date}`];
  const latvians = await latvianIds(client);

  const lines: string[] = [];
  for (const event of started) {
    const summary = parse(
      summarySchema,
      (await client.get(espnNbaEndpoints.summary(event.id))).body,
      `summary ${event.id}`,
    );
    const competition = summary.header.competitions[0];
    const away = competition?.competitors.find((c) => c.homeAway === 'away');
    const home = competition?.competitors.find((c) => c.homeAway === 'home');
    const header = `${away?.team.abbreviation} ${away?.score ?? '-'} @ ${home?.team.abbreviation} ${home?.score ?? '-'} (${competition?.status.type.shortDetail})`;
    for (const team of summary.boxscore.players) {
      for (const block of team.statistics) {
        for (const a of block.athletes) {
          if (!latvians.has(a.athlete.id)) continue;
          const who = `${a.athlete.displayName} (${team.team.abbreviation}, ${a.athlete.position?.abbreviation ?? '?'})`;
          if (a.didNotPlay || a.stats.length === 0) {
            lines.push(`NBA  ${header}  ${who}  DNP — ${a.reason ?? 'no reason given'}`);
            continue;
          }
          // Map by label, never by position in the array.
          const stat = (label: string) => a.stats[block.labels.indexOf(label)] ?? '?';
          lines.push(
            `NBA  ${header}  ${who}  ${stat('MIN')} MIN  ${stat('PTS')} PTS  ${stat('REB')} REB  ${stat('AST')} AST  FG ${stat('FG')}  3PT ${stat('3PT')}  FT ${stat('FT')}  ${stat('+/-')}`,
          );
        }
      }
    }
  }
  return lines.length > 0 ? lines : [`NBA  no Latvians played on ${date}`];
}
