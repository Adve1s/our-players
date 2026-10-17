import type { Team } from '@our-players/shared';
import { parsePayload, toTeam } from './common';
import { scheduleCalendarSchema } from './schemas';

export function mapScheduleCalendar(raw: unknown): { teams: Team[] } {
  const { teams } = parsePayload(scheduleCalendarSchema, 'schedule-calendar', raw);
  return { teams: teams.map((t) => toTeam(t.id, t.abbrev, t.commonName.default)) };
}
