import type { Activity, UserStats } from "./types";

export const ACTIVITY_MULTIPLIERS: Record<Activity, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: "Sedentary (little exercise)",
  light: "Lightly active (1–3 days/week)",
  moderate: "Moderately active (3–5 days/week)",
  active: "Active (6–7 days/week)",
  very_active: "Very active (physical job)",
};

export function bmr(stats: UserStats): number {
  const sexTerm = stats.sex === "male" ? 5 : -161;
  return 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age + sexTerm;
}

export function tdee(stats: UserStats): number {
  return Math.round(bmr(stats) * ACTIVITY_MULTIPLIERS[stats.activity]);
}
