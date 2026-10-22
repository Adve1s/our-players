import {
  type DayGameResponse,
  dnpText,
  finalLabel,
  type GameStatus,
  gameDateSchema,
  type League,
  type LineStats,
  lineText,
  localDate,
  type MetaResponse,
  type PlayerRow,
  type PublicId,
  publicIdSchema,
  savePct,
  sentenceCase,
  upcomingText,
} from '@our-players/shared';

// No locale or zone passed: the device decides both. timeStyle, not hour: 'numeric', keeps the
// locale's own pattern (en-GB "04:00", en-US "9:00 PM"). A night stays on its US game day (owner),
// so a start on another local date gets the local weekday: "Sat 04:00". The weekday is English like
// dayLabel's (v1 is English-only, owner); only the 12/24 h clock follows the device.
export function startTime(
  iso: string,
  gameDate: string,
  locale?: string,
  timeZone?: string,
): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone }).format(at);
  const day = localDate(at, timeZone);
  if (day === gameDate) return time;
  return `${abbr(WEEKDAYS, new Date(`${day}T00:00:00Z`).getUTCDay())} ${time}`;
}

const WEEKDAYS = 'SunMonTueWedThuFriSat';
const MONTHS = 'JanFebMarAprMayJunJulAugSepOctNovDec';
const abbr = (names: string, i: number) => names.slice(i * 3, i * 3 + 3);

// Without Intl, so neither Hermes' locale data nor the device's zone can shift the calendar day.
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${abbr(WEEKDAYS, d.getUTCDay())}, ${abbr(MONTHS, d.getUTCMonth())} ${d.getUTCDate()}`;
}

export function statusLabel(
  game: Pick<DayGameResponse, 'status' | 'endedIn' | 'startTimeUtc' | 'gameDate'>,
  locale?: string,
  timeZone?: string,
): string {
  switch (game.status) {
    case 'FINAL':
      return finalLabel(game.endedIn);
    case 'LIVE':
      return 'Live';
    case 'SCHEDULED':
      return startTime(game.startTimeUtc, game.gameDate, locale, timeZone);
    case 'POSTPONED':
      return 'Postponed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

export function scoreText({ away, home }: Pick<DayGameResponse, 'away' | 'home'>): string {
  return away.score === null || home.score === null
    ? `${away.abbrev} @ ${home.abbrev}`
    : `${away.abbrev} ${away.score} – ${home.score} ${home.abbrev}`;
}

export function rowText(row: PlayerRow, status: GameStatus): string[] {
  switch (row.type) {
    case 'line':
      return lineText(row.line);
    case 'dnp':
      return [dnpText(row.reason)];
    case 'not-in-lineup':
      return ['Not in lineup'];
    case 'upcoming':
      return [upcomingText(status)];
  }
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const DECISIONS = { W: 'win', L: 'loss', OTL: 'overtime loss' } as const;

// Screen readers can't say "SOG" or "+2", so the label spells the card out.
function lineParts(line: LineStats): (string | null)[] {
  switch (line.kind) {
    case 'hockey_skater': {
      const s = line.stats;
      const pm = s.plusMinus;
      return [
        count(s.goals, 'goal'),
        count(s.assists, 'assist'),
        pm > 0 ? `plus ${pm}` : pm < 0 ? `minus ${-pm}` : 'plus-minus 0',
        `${count(s.shots, 'shot')} on goal`,
        `${count(Math.floor(s.toiSeconds / 60), 'minute')} ${count(s.toiSeconds % 60, 'second')}`,
      ];
    }
    case 'hockey_goalie': {
      const s = line.stats;
      return [
        `${count(s.saves, 'save')} on ${count(s.shotsAgainst, 'shot')}`,
        s.savePct === null ? null : `save percentage ${savePct(s.savePct)}`,
        `${count(s.goalsAgainst, 'goal')} against`,
        s.decision === null ? null : DECISIONS[s.decision],
      ];
    }
    case 'basketball_player': {
      const s = line.stats;
      return [
        count(s.points, 'point'),
        count(s.rebounds, 'rebound'),
        count(s.assists, 'assist'),
        count(s.minutes, 'minute'),
        `field goals ${s.fgMade} of ${s.fgAttempted}`,
        `three-pointers ${s.threeMade} of ${s.threeAttempted}`,
        `free throws ${s.ftMade} of ${s.ftAttempted}`,
      ];
    }
  }
}

function rowParts(row: PlayerRow, status: GameStatus): (string | null)[] {
  switch (row.type) {
    case 'line':
      return lineParts(row.line);
    case 'dnp':
      return ['did not play', row.reason === null ? null : sentenceCase(row.reason)];
    case 'not-in-lineup':
      return ['not in lineup'];
    case 'upcoming':
      return [upcomingText(status).toLowerCase()];
  }
}

export function rowLabel(row: PlayerRow, status: GameStatus, team: string): string {
  return [`${row.player.firstName} ${row.player.lastName}`, team, ...rowParts(row, status)]
    .filter((part) => part !== null)
    .join(', ');
}

export function latestDate(meta: MetaResponse, leagues: readonly League[]): string | null {
  return meta.leagues
    .filter((l) => leagues.includes(l.league))
    .reduce<string | null>(
      (latest, { latestGameDate: d }) =>
        d !== null && (latest === null || d > latest) ? d : latest,
      null,
    );
}

// A repeated `?date=` arrives as an array; anything but one valid YYYY-MM-DD means the latest day.
export function dateParam(raw: string | string[] | undefined): string | null {
  return typeof raw === 'string' && gameDateSchema.safeParse(raw).success ? raw : null;
}

// Likewise for `?id=`: anything but one valid public ID is no page.
export const pageId = (raw: string | string[] | undefined): PublicId | null =>
  typeof raw === 'string' && publicIdSchema.safeParse(raw).success ? raw : null;

// The URL param for a stepped-to day: none on the latest, or the screen would stay pinned to it after the
// latest moves on (and Latest, disabled on that day, couldn't unpin it).
export function dateParamFor(day: string, latest: string | null): string | undefined {
  return day === latest ? undefined : day;
}
