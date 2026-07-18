export type EntryType = "credit" | "debit";
export type EntrySource = "ai" | "manual" | "fallback";

export interface Entry {
  id: string;
  label: string;
  type: EntryType;
  amount: number;        // kcal, positive integer
  date: string;          // ISO yyyy-mm-dd (local)
  source: EntrySource;
}

export interface Period {
  id: string;
  startDate: string;     // inclusive
  endDate: string;       // inclusive (start + 13 for 14-day periods)
  budgetPerDay: number;  // snapshot at period creation
  entries: Entry[];
  outcome?: "positive" | "negative"; // set when sealed
}

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface UserStats {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
}

export interface Settings {
  tdee: number;
  deficit: number;
  stats?: UserStats;       // present when Mifflin path used; feeds AI prompt
  anchorDate: string;      // onboarding date; defines the period grid
  periodLengthDays: number; // 14
  apiKey?: string;
  model: string;           // default "claude-sonnet-4-6"
}

// Chosen via `npm run eval`: perfect type + kcal accuracy vs. Haiku
// misjudging exercise burns (e.g. 480 kcal for 100 press-ups).
export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const PERIOD_LENGTH_DAYS = 14;
export const STORAGE_KEY = "daily-dosh-food:v1";

export interface AppState {
  schemaVersion: 1;
  settings?: Settings;
  periods: Period[];
}

export const emptyState = (): AppState => ({ schemaVersion: 1, periods: [] });
