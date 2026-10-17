import { z } from 'zod';

export const leagueSchema = z.enum(['NHL', 'NBA']);
export type League = z.infer<typeof leagueSchema>;

export const sportSchema = z.enum(['hockey', 'basketball']);
export type Sport = z.infer<typeof sportSchema>;

export const LEAGUE_SPORT = { NHL: 'hockey', NBA: 'basketball' } as const satisfies Record<
  League,
  Sport
>;

export const gameStatusSchema = z.enum(['SCHEDULED', 'LIVE', 'FINAL', 'POSTPONED', 'CANCELLED']);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const seasonTypeSchema = z.enum(['PRE', 'REG', 'POST']);
export type SeasonType = z.infer<typeof seasonTypeSchema>;

export const endedInSchema = z.enum(['REG', 'OT', 'SO']);
export type EndedIn = z.infer<typeof endedInSchema>;

export const statKindSchema = z.enum(['hockey_skater', 'hockey_goalie', 'basketball_player']);
export type StatKind = z.infer<typeof statKindSchema>;

export const sourceSchema = z.enum(['nhl', 'espn']);
export type Source = z.infer<typeof sourceSchema>;

export const positionGroupSchema = z.enum(['forward', 'defense', 'goalie', 'guard', 'center']);
export type PositionGroup = z.infer<typeof positionGroupSchema>;

export const nationalitySourceSchema = z.enum(['birth', 'override']);
export type NationalitySource = z.infer<typeof nationalitySourceSchema>;
