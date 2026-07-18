import { bmr, tdee } from "./tdee";
import type { UserStats } from "./types";

const male: UserStats = { sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "sedentary" };
const female: UserStats = { sex: "female", age: 25, heightCm: 165, weightKg: 60, activity: "moderate" };

test("bmr: Mifflin-St Jeor", () => {
  expect(bmr(male)).toBe(1780);        // 800 + 1125 − 150 + 5
  expect(bmr(female)).toBeCloseTo(1345.25); // 600 + 1031.25 − 125 − 161
});

test("tdee applies activity multiplier and rounds", () => {
  expect(tdee(male)).toBe(2136);   // 1780 × 1.2
  expect(tdee(female)).toBe(2085); // 1345.25 × 1.55 = 2085.1375
});
