import {
  type EndedIn,
  type GameStatus,
  isShown,
  type League,
  type PeriodScore,
  type Prefs,
  type PublicId,
  type SeasonType,
  type SelectablePlayer,
  type StatLine,
} from '@our-players/shared';

export type DayTeam = { id: number; abbrev: string };
export type DayGame = {
  publicId: PublicId;
  league: League;
  status: GameStatus;
  seasonType: SeasonType;
  gameDate: string;
  startTimeUtc: string;
  away: DayTeam;
  home: DayTeam;
  awayScore: number | null;
  homeScore: number | null;
  endedIn: EndedIn | null;
  periodScores: PeriodScore[] | null;
  // A FINAL game can be stored before its box score; until then its shown players are upcoming, not out of the lineup (D-049).
  boxScoreStored: boolean;
};
export type DayPlayer = SelectablePlayer & {
  firstName: string;
  lastName: string;
  currentTeamId: number | null;
};
export type DayLine = StatLine & { teamId: number };
export type DayRow = { player: DayPlayer; team: DayTeam } & (
  | { kind: 'line'; line: DayLine }
  | { kind: 'dnp'; reason: string | null }
  | { kind: 'not-in-lineup' }
  | { kind: 'upcoming' }
);

// Within a team: played skaters and basketball players by points, then goalies, then DNP, then not in lineup, then upcoming.
function rank(row: DayRow): [number, number] {
  if (row.kind === 'dnp') return [2, 0];
  if (row.kind === 'not-in-lineup') return [3, 0];
  if (row.kind === 'upcoming') return [4, 0];
  const { line } = row;
  if (line.kind === 'hockey_goalie') return [1, 0];
  return [0, line.played ? -line.stats.points : 0];
}

// Ties broken by public ID so the order is the same on every run.
export const byStartTime = (a: DayGame, b: DayGame): number =>
  a.startTimeUtc.localeCompare(b.startTimeUtc) || a.publicId.localeCompare(b.publicId);

// VISION §4.1's rows for one game day; S06's /v1/days reuses this so the recap and the app can't drift.
export function gameDayRows(
  day: { games: DayGame[]; lines: DayLine[]; players: DayPlayer[] },
  prefs: Prefs,
): { game: DayGame; rows: DayRow[] }[] {
  const shown = day.players.filter((p) => isShown(p, prefs));
  return [...day.games]
    .sort(byStartTime)
    .map((game) => {
      const teams = [game.away, game.home];
      const team = (id: number) => teams.find((t) => t.id === id);
      const rows = shown.flatMap((player): DayRow[] => {
        const line = day.lines.find(
          (l) => l.gamePublicId === game.publicId && l.playerPublicId === player.publicId,
        );
        if (line) {
          const t = team(line.teamId);
          if (!t)
            throw new Error(
              `stat line ${game.publicId}/${player.publicId}: team ${line.teamId} not in the game`,
            );
          return line.played
            ? [{ player, team: t, kind: 'line', line }]
            : [{ player, team: t, kind: 'dnp', reason: line.dnpReason }];
        }
        // shortcut: the current team, not the team on that date, so older dates can be wrong after a trade (VISION §4.1); upgrade if rosters are kept per date
        const t = player.currentTeamId === null ? undefined : team(player.currentTeamId);
        // A line elsewhere that day means he played for another team (traded since), not that he sat out.
        if (!t || day.lines.some((l) => l.playerPublicId === player.publicId)) return [];
        // D-049: absence from a stored FINAL box score means not in lineup; with no box score yet he's upcoming.
        if (game.boxScoreStored) {
          return game.status === 'FINAL' ? [{ player, team: t, kind: 'not-in-lineup' }] : [];
        }
        return game.status === 'SCHEDULED' || game.status === 'LIVE' || game.status === 'FINAL'
          ? [{ player, team: t, kind: 'upcoming' }]
          : [];
      });
      rows.sort((a, b) => {
        const [ka, pa] = rank(a);
        const [kb, pb] = rank(b);
        return (
          teams.indexOf(a.team) - teams.indexOf(b.team) ||
          ka - kb ||
          pa - pb ||
          a.player.publicId.localeCompare(b.player.publicId)
        );
      });
      return { game, rows };
    })
    .filter((g) => g.rows.length > 0);
}
