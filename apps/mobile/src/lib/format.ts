import type {
  DayGameResponse,
  GameStatus,
  League,
  MetaResponse,
  PlayerRow,
} from '@our-players/shared';

export function startTime(_iso: string, _locale?: string, _timeZone?: string): string {
  throw new Error('not implemented');
}

export function dayLabel(_date: string): string {
  throw new Error('not implemented');
}

export function statusLabel(
  _game: Pick<DayGameResponse, 'status' | 'endedIn' | 'startTimeUtc'>,
  _locale?: string,
  _timeZone?: string,
): string {
  throw new Error('not implemented');
}

export function scoreText(_game: Pick<DayGameResponse, 'away' | 'home'>): string {
  throw new Error('not implemented');
}

export function rowText(_row: PlayerRow, _status: GameStatus): string[] {
  throw new Error('not implemented');
}

export function rowLabel(_row: PlayerRow, _status: GameStatus, _team: string): string {
  throw new Error('not implemented');
}

export function latestDate(_meta: MetaResponse, _leagues: readonly League[]): string | null {
  throw new Error('not implemented');
}

export function dateParam(_raw: string | string[] | undefined): string | null {
  throw new Error('not implemented');
}
