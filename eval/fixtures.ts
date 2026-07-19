import type { EntryType, UserStats } from "../src/lib/types";

export interface Fixture {
  text: string;
  expectedType: EntryType;
  kcalRange: [number, number];
  sugarRange: [number, number];
}

// ~18 fixtures mixing clear foods, clear exercise, quantified items, and
// ambiguous/tricky entries. Ranges are generous but meaningful — wide enough
// to allow for legitimate portion-size uncertainty, tight enough to catch a
// model that's wildly off (e.g. reporting press-ups in the thousands).
export const FIXTURES: Fixture[] = [
  // Clear foods
  { text: "chicken sandwich and a coffee", expectedType: "debit", kcalRange: [400, 700], sugarRange: [0, 12] },
  { text: "toast + eggs", expectedType: "debit", kcalRange: [250, 500], sugarRange: [0, 8] },
  { text: "large pepperoni pizza, whole", expectedType: "debit", kcalRange: [1500, 2600], sugarRange: [0, 30] },
  { text: "cheeseburger and fries", expectedType: "debit", kcalRange: [700, 1200], sugarRange: [0, 18] },
  { text: "bowl of cereal with milk", expectedType: "debit", kcalRange: [150, 400], sugarRange: [3, 30] },
  { text: "medium banana", expectedType: "debit", kcalRange: [80, 150], sugarRange: [0, 3] },

  // Clear exercise
  { text: "100 press ups", expectedType: "credit", kcalRange: [20, 120], sugarRange: [0, 0] },
  { text: "30 min run", expectedType: "credit", kcalRange: [250, 450], sugarRange: [0, 0] },
  { text: "45 minute gym session, weights", expectedType: "credit", kcalRange: [200, 500], sugarRange: [0, 0] },
  { text: "20 minute swim", expectedType: "credit", kcalRange: [150, 350], sugarRange: [0, 0] },
  { text: "yoga session", expectedType: "credit", kcalRange: [100, 300], sugarRange: [0, 0] },
  { text: "5k run", expectedType: "credit", kcalRange: [250, 500], sugarRange: [0, 0] },

  // Quantified
  { text: "2 pints of lager", expectedType: "debit", kcalRange: [300, 600], sugarRange: [0, 10] },
  { text: "10k run", expectedType: "credit", kcalRange: [500, 900], sugarRange: [0, 0] },

  // Ambiguous / tricky
  { text: "big bowl of pasta", expectedType: "debit", kcalRange: [500, 900], sugarRange: [0, 15] },
  { text: "a handful of nuts", expectedType: "debit", kcalRange: [80, 250], sugarRange: [0, 4] },
  { text: "walked to work", expectedType: "credit", kcalRange: [50, 250], sugarRange: [0, 0] },
  { text: "protein shake", expectedType: "debit", kcalRange: [100, 300], sugarRange: [0, 25] },

  // Free-sugar definition probes: whole fruit and plain milk must score ~0;
  // juice, honey, and cola must not.
  { text: "an apple", expectedType: "debit", kcalRange: [50, 120], sugarRange: [0, 3] },
  { text: "large glass of orange juice", expectedType: "debit", kcalRange: [80, 200], sugarRange: [15, 40] },
  { text: "porridge with a big drizzle of honey", expectedType: "debit", kcalRange: [250, 500], sugarRange: [8, 25] },
  { text: "500ml bottle of coca cola", expectedType: "debit", kcalRange: [180, 250], sugarRange: [40, 60] },
  { text: "glass of whole milk", expectedType: "debit", kcalRange: [120, 220], sugarRange: [0, 3] },
];

// Male, 30, 180cm, 80kg, moderate activity — used to build the system prompt
// for every eval call so results are directly comparable to the app's real
// prompt (see systemPrompt(stats) in src/lib/ai.ts).
export const EVAL_STATS: UserStats = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
};
