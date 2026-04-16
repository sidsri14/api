import { z } from 'zod';

export const testConnectionSchema = z.object({
  provider: z.enum(['razorpay', 'stripe'], { error: 'provider must be "razorpay" or "stripe"' }),
  credentials: z.record(z.string(), z.unknown()),
});
