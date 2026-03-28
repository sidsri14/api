import { z } from 'zod';

export const createMonitorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  url: z.string().url('Invalid endpoint URL').startsWith('http', 'Only http/https protocols are allowed'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  interval: z.coerce.number().min(10, 'Minimum 10s interval').max(3600, 'Maximum 1h interval').default(60),
});

export const updateMonitorSchema = createMonitorSchema.partial();
