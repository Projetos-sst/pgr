import { nextMockPeriod } from "@/shared/domains/billing/mock-period";
it.each([
  ["2027-01-31T12:30:00.000Z", "month", "2027-02-28T12:30:00.000Z"],
  ["2028-01-31T12:30:00.000Z", "month", "2028-02-29T12:30:00.000Z"],
  ["2028-02-29T12:30:00.000Z", "year", "2029-02-28T12:30:00.000Z"],
  ["2026-12-15T12:30:00.000Z", "month", "2027-01-15T12:30:00.000Z"],
] as const)("uses a bounded mock calendar for %s %s", (start, interval, expected) => {
  const original = new Date(start);
  expect(nextMockPeriod(original, interval).toISOString()).toBe(expected);
  expect(original.toISOString()).toBe(start);
});
