import { describe, it, expect } from 'vitest';
import { getDaysInMonth, isLeapYear, parsePortalTimestamp } from '../../src/shared/utils/date-parser';

describe('Date Parser Utility', () => {
  describe('isLeapYear', () => {
    it('correctly identifies leap years', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(1900)).toBe(false); // Century non-400 rule
    });
  });

  describe('getDaysInMonth', () => {
    it('returns 31 for 31-day months', () => {
      expect(getDaysInMonth(1, 2026)).toBe(31);
      expect(getDaysInMonth(3, 2026)).toBe(31);
      expect(getDaysInMonth(5, 2026)).toBe(31);
      expect(getDaysInMonth(7, 2026)).toBe(31);
      expect(getDaysInMonth(8, 2026)).toBe(31);
      expect(getDaysInMonth(10, 2026)).toBe(31);
      expect(getDaysInMonth(12, 2026)).toBe(31);
    });

    it('returns 30 for 30-day months', () => {
      expect(getDaysInMonth(4, 2026)).toBe(30);
      expect(getDaysInMonth(6, 2026)).toBe(30);
      expect(getDaysInMonth(9, 2026)).toBe(30);
      expect(getDaysInMonth(11, 2026)).toBe(30);
    });

    it('returns 29 for February in leap year and 28 in common year', () => {
      expect(getDaysInMonth(2, 2024)).toBe(29);
      expect(getDaysInMonth(2, 2026)).toBe(28);
    });
  });

  describe('parsePortalTimestamp', () => {
    it('correctly parses valid "DD/MM/YYYY HH:mm" into unzoned local ISO', () => {
      const result = parsePortalTimestamp('23/06/2026 23:30');
      expect(result.year).toBe(2026);
      expect(result.month).toBe(6);
      expect(result.day).toBe(23);
      expect(result.hour).toBe(23);
      expect(result.minute).toBe(30);
      expect(result.isoLocal).toBe('2026-06-23T23:30:00');
    });

    it('handles February 29 on leap years correctly', () => {
      const leapResult = parsePortalTimestamp('29/02/2024 12:00');
      expect(leapResult.isoLocal).toBe('2024-02-29T12:00:00');

      expect(() => parsePortalTimestamp('29/02/2026 12:00')).toThrow(
        /Day 29 is invalid for month 2\/2026/
      );
    });

    it('rejects 31st on a 30-day month (e.g. 31st April)', () => {
      expect(() => parsePortalTimestamp('31/04/2026 10:00')).toThrow(
        /Day 31 is invalid for month 4\/2026/
      );
    });

    it('rejects invalid hours or minutes', () => {
      expect(() => parsePortalTimestamp('15/05/2026 24:00')).toThrow(/Hour 24 is invalid/);
      expect(() => parsePortalTimestamp('15/05/2026 12:60')).toThrow(/Minute 60 is invalid/);
    });

    it('rejects malformed timestamp format', () => {
      expect(() => parsePortalTimestamp('2026-06-23 23:30')).toThrow(/does not match required format/);
      expect(() => parsePortalTimestamp('invalid-date')).toThrow(/does not match required format/);
    });
  });
});
