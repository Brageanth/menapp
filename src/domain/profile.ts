export type PersonLabel = 'yo' | 'pareja';

export interface Profile {
  id: string;
  personLabel: PersonLabel;
  kcalTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
}
