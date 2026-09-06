import { describe, it, expect } from 'vitest';
import { parseApiError } from '../apiError';

describe('parseApiError', () => {
  it('marks network error as retryable with Indonesian message', () => {
    const result = parseApiError(new Error('Network Error'));
    expect(result.retryable).toBe(true);
    expect(result.message).toContain('koneksi');
    expect(result.status).toBeUndefined();
  });

  it('401 is NOT retryable — sesi expired', () => {
    const result = parseApiError({ response: { status: 401, data: {} } });
    expect(result.retryable).toBe(false);
    expect(result.message).toContain('Sesi');
    expect(result.status).toBe(401);
  });

  it('500 IS retryable — server error sementara', () => {
    const result = parseApiError({ response: { status: 500, data: {} } });
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(500);
  });

  it('menggunakan API error message jika tersedia', () => {
    const result = parseApiError({ response: { status: 422, data: { error: 'Field required' } } });
    expect(result.message).toBe('Field required');
  });

  it('unknown error returns safe fallback', () => {
    const result = parseApiError('something weird');
    expect(result.message).toBeTruthy();
    expect(result.retryable).toBe(false);
  });
});
