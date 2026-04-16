import { describe, test, expect } from 'bun:test';
import { testConnectionSchema } from '../validators/source.validator.js';

describe('testConnectionSchema', () => {
  test('accepts valid razorpay credentials', () => {
    const result = testConnectionSchema.safeParse({
      provider: 'razorpay',
      credentials: { keyId: 'rzp_test_abc', keySecret: 'secret123' },
    });
    expect(result.success).toBe(true);
  });

  test('rejects missing provider', () => {
    const result = testConnectionSchema.safeParse({ credentials: {} });
    expect(result.success).toBe(false);
  });

  test('rejects invalid provider', () => {
    const result = testConnectionSchema.safeParse({ provider: 'paypal', credentials: {} });
    expect(result.success).toBe(false);
  });

  test('rejects missing credentials', () => {
    const result = testConnectionSchema.safeParse({ provider: 'stripe' });
    expect(result.success).toBe(false);
  });
});
