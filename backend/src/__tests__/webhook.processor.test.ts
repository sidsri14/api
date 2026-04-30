import { mock, describe, test, expect, beforeEach } from 'bun:test';

// Mock global fetch before importing the processor
const mockFetch = mock(async (_url: string, _opts?: any): Promise<any> => ({
  ok: true,
  status: 200,
  text: mock(async () => 'ok'),
}));
(globalThis as any).fetch = mockFetch;

// Mock isPrivateUrl before importing the processor
mock.module('../utils/isPrivateUrl.js', () => ({
  isPrivateUrl: mock(async () => false),
}));

// Mock prisma before importing the processor
const mockCreate = mock(async () => ({}));
const mockFindUnique = mock(async () => ({ secret: 'test-secret', active: true }));
mock.module('../utils/prisma.js', () => ({
  prisma: {
    webhookDelivery: { create: mockCreate },
    webhookEndpoint: { findUnique: mockFindUnique },
  },
}));

import { processWebhookDeliveryJob } from '../jobs/webhook.processor.js';

function makeJob(data: object) {
  return { data, attemptsMade: 0 } as any;
}

describe('processWebhookDeliveryJob', () => {
  const jobData = {
    endpointId: 'ep-1',
    url: 'https://example.com/webhook',
    event: 'payment.failed',
    body: JSON.stringify({ event: 'payment.failed', data: {}, timestamp: '2026-01-01T00:00:00.000Z' }),
  };

  beforeEach(() => {
    mockFetch.mockClear();
    mockCreate.mockClear();
    mockFindUnique.mockClear();
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: mock(async () => 'ok')
    }));
    mockCreate.mockImplementation(async () => ({}));
    mockFindUnique.mockImplementation(async () => ({ secret: 'test-secret', active: true }));
  });

  test('calls fetch with correct headers and HMAC signature', async () => {
    await processWebhookDeliveryJob(makeJob(jobData));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe(jobData.url);
    expect(opts.headers['x-InvoiceFlow-signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  test('logs success delivery to DB', async () => {
    await processWebhookDeliveryJob(makeJob(jobData));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'success', endpointId: 'ep-1' }) })
    );
  });

  test('throws on non-2xx response so BullMQ retries', async () => {
    mockFetch.mockImplementation(async () => ({ 
      ok: false, 
      status: 503,
      text: mock(async () => 'error')
    }));
    await expect(processWebhookDeliveryJob(makeJob(jobData))).rejects.toThrow('Non-2xx response: 503');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed', responseCode: 503 }) })
    );
  });
});
