// ─────────────────────────────────────────────────────────────────────────────
// API: GET /api/signed-url — validation and path security tests
// ─────────────────────────────────────────────────────────────────────────────

const mockCreateSignedUrl = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({ createSignedUrl: mockCreateSignedUrl }),
    },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';

import { GET } from '../../app/api/signed-url/route';
import { NextRequest } from 'next/server';

function makeGet(path?: string): NextRequest {
  const url = path
    ? `http://localhost/api/signed-url?path=${encodeURIComponent(path)}`
    : 'http://localhost/api/signed-url';
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  mockCreateSignedUrl.mockReset();
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.test/signed?token=abc' },
    error: null,
  });
});

describe('GET /api/signed-url — parameter validation', () => {
  it('returns 400 when path param is missing', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });
});

describe('GET /api/signed-url — path traversal prevention', () => {
  it('rejects path with ".."', async () => {
    const res = await GET(makeGet('../../etc/passwd'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid path/i);
  });

  it('rejects absolute path starting with "/"', async () => {
    const res = await GET(makeGet('/etc/shadow'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid path/i);
  });

  it('rejects path with embedded ".." traversal', async () => {
    const res = await GET(makeGet('units/abc/../../../etc/passwd'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/signed-url — success path', () => {
  it('returns 200 with signedUrl for a valid path', async () => {
    const res = await GET(makeGet('units/abc-123/passport.pdf'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe('https://storage.test/signed?token=abc');
  });

  it('calls createSignedUrl with 3600-second expiry', async () => {
    await GET(makeGet('units/abc-123/passport.pdf'));
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('units/abc-123/passport.pdf', 3600);
  });
});

describe('GET /api/signed-url — Supabase error handling', () => {
  it('returns 500 when Supabase returns an error', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    const res = await GET(makeGet('units/abc-123/missing.pdf'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Object not found');
  });
});
