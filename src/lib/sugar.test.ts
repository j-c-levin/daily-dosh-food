import { sugarLevel } from "./sugar";

test("sugarLevel maps grams to 0–5 bands (lower bound inclusive)", () => {
  expect(sugarLevel(0)).toBe(0);
  expect(sugarLevel(1.9)).toBe(0);
  expect(sugarLevel(2)).toBe(1);
  expect(sugarLevel(9.9)).toBe(1);
  expect(sugarLevel(10)).toBe(2);   // honeyed oats ≈ 10 g
  expect(sugarLevel(20)).toBe(3);
  expect(sugarLevel(25)).toBe(3);   // chocolate bar ≈ 25 g
  expect(sugarLevel(30)).toBe(4);
  expect(sugarLevel(45)).toBe(5);
  expect(sugarLevel(53)).toBe(5);   // 500 ml full-sugar cola ≈ 53 g
});
