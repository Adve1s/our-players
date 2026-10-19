import { useQuery } from '@tanstack/react-query';
import { api } from './client';

// Both leagues always, so the list doesn't change when a league is toggled.
export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: () => api.countries(new Set(['NBA', 'NHL'])) });
