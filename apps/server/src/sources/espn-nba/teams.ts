import type { Team } from '@our-players/shared';
import { parsePayload, toTeam } from './common';
import { teamsSchema } from './schemas';

export function mapTeams(raw: unknown): { teams: Team[] } {
  const { sports } = parsePayload(teamsSchema, 'teams', raw);
  return { teams: sports[0].leagues[0].teams.map((t) => toTeam(t.team)) };
}
