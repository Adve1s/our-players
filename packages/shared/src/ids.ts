import { z } from 'zod';

// D-010: derived from source IDs so favorites stored on devices survive DB rebuilds.
export const publicIdSchema = z
  .string()
  .regex(/^(nhl|nba)-\d+$/, 'expected a public ID like nhl-8478402');
export type PublicId = string;
