// ─────────────────────────────────────────────────────────────────────────────
// API: POST /api/upload — validation logic tests
// The Supabase admin client is mocked so no real credentials are needed.
// ─────────────────────────────────────────────────────────────────────────────

const mockStorageUpload = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload: mockStorageUpload }),
    },
  }),
}));

// Provide dummy env vars before module load
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';

import { POST } from '../../app/api/upload/route';
import { NextRequest } from 'next/server';

function makeRequest(file?: File, path?: string): NextRequest {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (path) formData.append('path', path);
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });
}

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

beforeEach(() => {
  mockStorageUpload.mockReset();
  mockStorageUpload.mockResolvedValue({ data: { path: 'units/test/doc.pdf' }, error: null });
});

describe('POST /api/upload — parameter validation', () => {
  it('returns 400 when both file and path are missing', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when file is missing but path is present', async () => {
    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: (() => { const f = new FormData(); f.append('path', 'units/test/doc.pdf'); return f; })(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when path is missing but file is present', async () => {
    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: (() => { const f = new FormData(); f.append('file', makeFile('test.pdf', 'application/pdf')); return f; })(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/upload — file type validation', () => {
  const ALLOWED = [
    ['application/pdf',  'document.pdf'],
    ['image/jpeg',       'photo.jpg'],
    ['image/png',        'screenshot.png'],
    ['image/webp',       'image.webp'],
  ] as const;

  ALLOWED.forEach(([type, name]) => {
    it(`accepts ${type}`, async () => {
      const res = await POST(makeRequest(makeFile(name, type), `units/test/${name}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.path).toBeDefined();
    });
  });

  const BLOCKED = [
    ['application/exe',       'malware.exe'],
    ['text/plain',            'script.txt'],
    ['application/zip',       'archive.zip'],
    ['application/javascript','script.js'],
  ] as const;

  BLOCKED.forEach(([type, name]) => {
    it(`rejects ${type}`, async () => {
      const res = await POST(makeRequest(makeFile(name, type), `units/test/${name}`));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/not allowed/i);
    });
  });
});

describe('POST /api/upload — file size validation', () => {
  it('accepts a file exactly at 50 MB', async () => {
    const file = makeFile('large.pdf', 'application/pdf', 50 * 1024 * 1024);
    const res = await POST(makeRequest(file, 'units/test/large.pdf'));
    expect(res.status).toBe(200);
  });

  it('rejects a file over 50 MB', async () => {
    const file = makeFile('toobig.pdf', 'application/pdf', 50 * 1024 * 1024 + 1);
    const res = await POST(makeRequest(file, 'units/test/toobig.pdf'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/50 MB/i);
  });
});

describe('POST /api/upload — Supabase error handling', () => {
  it('returns 500 when Supabase storage returns an error', async () => {
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'Storage unavailable' } });
    const res = await POST(makeRequest(makeFile('doc.pdf', 'application/pdf'), 'units/test/doc.pdf'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Storage unavailable');
  });
});
