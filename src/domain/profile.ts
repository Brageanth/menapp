export type PersonLabel = 'yo' | 'pareja';

export interface Profile {
  id: string;
  personLabel: PersonLabel;
  kcalTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  /** D4: presupuesto de gustos — null = sin presupuesto configurado. */
  treatBudgetKcal: number | null;
  treatBudgetPeriod: 'daily' | 'weekly' | null;
}
