import type { EntryType, UserStats } from "../src/lib/types";

export interface Fixture {
  text: string;
  expectedType: EntryType;
  kcalRange: [number, number];
}

// ~18 fixtures mixing clear foods, clear exercise, quantified items, and
// ambiguous/tricky entries. Ranges are generous but meaningful — wide enough
// to allow for legitimate portion-size uncertainty, tight enough to catch a
// model that's wildly off (e.g. reporting press-ups in the thousands).
export const FIXTURES: Fixture[] = [
  // Clear foods
  { text: "chicken sandwich and a coffee", expectedType: "debit", kcalRange: [400, 700] },
  { text: "toast + eggs", expectedType: "debit", kcalRange: [250, 500] },
  { text: "large pepperoni pizza, whole", expectedType: "debit", kcalRange: [1500, 2600] },
  { text: "cheeseburger and fries", expectedType: "debit", kcalRange: [700, 1200] },
  { text: "bowl of cereal with milk", expectedType: "debit", kcalRange: [150, 400] },
  { text: "medium banana", expectedType: "debit", kcalRange: [80, 150] },

  // Clear exercise
  { text: "100 press ups", expectedType: "credit", kcalRange: [20, 120] },
  { text: "30 min run", expectedType: "credit", kcalRange: [250, 450] },
  { text: "45 minute gym session, weights", expectedType: "credit", kcalRange: [200, 500] },
  { text: "20 minute swim", expectedType: "credit", kcalRange: [150, 350] },
  { text: "yoga session", expectedType: "credit", kcalRange: [100, 300] },
  { text: "5k run", expectedType: "credit", kcalRange: [250, 500] },

  // Quantified
  { text: "2 pints of lager", expectedType: "debit", kcalRange: [300, 600] },
  { text: "10k run", expectedType: "credit", kcalRange: [500, 900] },

  // Ambiguous / tricky
  { text: "big bowl of pasta", expectedType: "debit", kcalRange: [500, 900] },
  { text: "a handful of nuts", expectedType: "debit", kcalRange: [80, 250] },
  { text: "walked to work", expectedType: "credit", kcalRange: [50, 250] },
  { text: "protein shake", expectedType: "debit", kcalRange: [100, 300] },
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
