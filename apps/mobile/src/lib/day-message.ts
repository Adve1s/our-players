import type { DayResponse } from '@our-players/shared';

export type DayMessage = { text: string; action: 'prev' | 'next' | 'settings' | null };

export function dayMessage(
  _day: Pick<DayResponse, 'gameDate' | 'games' | 'prevGameDate' | 'nextGameDate'>,
  _latest: string | null,
  _following: boolean,
): DayMessage | null {
  throw new Error('not implemented');
}
