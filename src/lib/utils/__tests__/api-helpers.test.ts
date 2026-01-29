import { describe, it, expect } from 'vitest';
import { calculateTrend } from '../api-helpers';

describe('calculateTrend', () => {
  it('should return +100% if previous value is 0 and current is positive', () => {
    expect(calculateTrend(100, 0)).toBe('+100%');
  });

  it('should return 0% if both values are 0', () => {
    expect(calculateTrend(0, 0)).toBe('0%');
  });

  it('should calculate positive trend correctly', () => {
    expect(calculateTrend(150, 100)).toBe('+50.0%');
  });

  it('should calculate negative trend correctly', () => {
    expect(calculateTrend(50, 100)).toBe('-50.0%');
  });

  it('should handle decimal values', () => {
    expect(calculateTrend(125.5, 100)).toBe('+25.5%');
  });
});
