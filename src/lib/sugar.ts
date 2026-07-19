// Display mapping for free-sugar grams. Grams are the stored and budgeted
// unit; the 0–5 level exists only at render time, so retuning these bounds
// re-labels all history for free.
export const SUGAR_LEVEL_BOUNDS = [2, 10, 20, 30, 45] as const; // lower bound of levels 1..5

export type SugarLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function sugarLevel(grams: number): SugarLevel {
  let level = 0;
  for (const bound of SUGAR_LEVEL_BOUNDS) if (grams >= bound) level++;
  return level as SugarLevel;
}

// Level 0 reuses the theme positive green; 5 is hotter than theme negative.
export const SUGAR_LEVEL_COLORS: Record<SugarLevel, string> = {
  0: "#3DDC97",
  1: "#8BD46B",
  2: "#C9C84E",
  3: "#E0B156",
  4: "#E07856",
  5: "#E0566B",
};
