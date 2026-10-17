import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { countryCodeSchema, type PublicId, publicIdSchema } from '@our-players/shared';
import { z } from 'zod';

const overrideSchema = z.strictObject({
  player: publicIdSchema,
  name: z.string().min(1),
  nationality: countryCodeSchema,
  note: z.string().min(1),
  addedAt: z.iso.date(),
});
// Entries are parsed one by one so an error can name the entry.
const fileSchema = z.strictObject({ overrides: z.array(z.unknown()) });

export type NationalityOverride = z.infer<typeof overrideSchema>;

export const DEFAULT_OVERRIDES_PATH = fileURLToPath(
  new URL('../../data/nationality-overrides.json', import.meta.url),
);

export function parseNationalityOverrides(
  json: string,
  file: string,
): ReadonlyMap<PublicId, NationalityOverride> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`${file}: invalid JSON: ${(e as Error).message}`, { cause: e });
  }
  const top = fileSchema.safeParse(raw);
  if (!top.success) throw new Error(`${file}: ${z.prettifyError(top.error)}`);

  const map = new Map<PublicId, NationalityOverride>();
  const firstIndex = new Map<PublicId, number>();
  top.data.overrides.forEach((entry, i) => {
    const result = overrideSchema.safeParse(entry);
    if (!result.success) {
      const player = (entry as { player?: unknown } | null)?.player;
      const label = typeof player === 'string' ? player : '?';
      throw new Error(`${file}: overrides[${i}] (${label}): ${z.prettifyError(result.error)}`);
    }
    const { player } = result.data;
    const first = firstIndex.get(player);
    if (first !== undefined)
      throw new Error(
        `${file}: overrides[${i}] (${player}): duplicate player, first at overrides[${first}]`,
      );
    firstIndex.set(player, i);
    map.set(player, result.data);
  });
  return map;
}

export async function loadNationalityOverrides(
  file = DEFAULT_OVERRIDES_PATH,
): Promise<ReadonlyMap<PublicId, NationalityOverride>> {
  let json: string;
  try {
    json = await readFile(file, 'utf8');
  } catch (e) {
    // Node's message repeats the path; the code is enough, and the full error stays in cause.
    const code = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
    throw new Error(`${file}: cannot read (${code})`, { cause: e });
  }
  return parseNationalityOverrides(json, file);
}
