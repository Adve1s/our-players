import {
  type EndedIn,
  type GameStatus,
  isShown,
  type League,
  type Prefs,
  type PublicId,
  type SelectablePlayer,
  type StatLine,
} from '@our-players/shared';

export type DayTeam = { id: number; abbrev: string };
export type DayGame = {
  publicId: PublicId;
  league: League;
  status: GameStatus;
  startTimeUtc: string;
  away: DayTeam;
  home: DayTeam;
  awayScore: number | null;
  homeScore: number | null;
  endedIn: EndedIn | null;
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
);

// Within a team: played skaters and basketball players by points, then goalies, then DNP, then not in lineup.
function rank(row: DayRow): [number, number] {
  if (row.kind === 'dnp') return [2, 0];
  if (row.kind === 'not-in-lineup') return [3, 0];
  const { line } = row;
  if (line.kind === 'hockey_goalie') return [1, 0];
  return [0, line.played ? -line.stats.points : 0];
}

// VISION §4.1's rows for one game day; S06's /v1/days reuses this so the recap and the app can't drift.
export function gameDayRows(
  day: { games: DayGame[]; lines: DayLine[]; players: DayPlayer[] },
  prefs: Prefs,
): { game: DayGame; rows: DayRow[] }[] {
  const shown = day.players.filter((p) => isShown(p, prefs));
  return [...day.games]
    .sort((a, b) => a.startTimeUtc.localeCompare(b.startTimeUtc))
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
        return game.status === 'FINAL' && t ? [{ player, team: t, kind: 'not-in-lineup' }] : [];
      });
      rows.sort((a, b) => {
        const [ka, pa] = rank(a);
        const [kb, pb] = rank(b);
        return teams.indexOf(a.team) - teams.indexOf(b.team) || ka - kb || pa - pb;
      });
      return { game, rows };
    })
    .filter((g) => g.rows.length > 0);
}
