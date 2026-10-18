import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import { leagueSchema } from '../enums';
import { publicIdSchema } from '../ids';
import type { Prefs } from '../selection';

// VISION §10: at most 200 IDs per list (also caps countries).
export const MAX_LIST = 200;

const csv = <T extends z.ZodType<unknown, string>>(item: T, min = 0) =>
  z
    .string()
    .transform((s) => (s === '' ? [] : s.split(',')))
    .pipe(z.array(item).min(min).max(MAX_LIST));

export const prefsQuerySchema = z
  .object({
    // min 1: at least one league must stay on.
    leagues: csv(leagueSchema, 1).default([...leagueSchema.options]),
    countries: csv(countryCodeSchema).default([]),
    fav: csv(publicIdSchema).default([]),
    hide: csv(publicIdSchema).default([]),
  })
  .transform(
    (q): Prefs => ({
      leagues: new Set(q.leagues),
      countries: new Set(q.countries),
      favorites: new Set(q.fav),
      hidden: new Set(q.hide),
    }),
  );

export const gameDateSchema = z.iso.date();
