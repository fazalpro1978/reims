import { NextRequest, NextResponse } from 'next/server';

// Simple in-process rate limiter (per-instance — good for brute-force protection,
// not a distributed counter). Keyed by "ip:route-group".
const hits = new Map<string, { count: number; resetAt: number }>();

const LIMITS: { pattern: RegExp; max: number; windowMs: number }[] = [
  { pattern: /^\/api\/auth/,          max: 10,  windowMs: 60_000 },  // login
  { pattern: /^\/api\/ai-extract/,    max: 10,  windowMs: 60_000 },  // AI extract
  { pattern: /^\/api\/upload/,        max: 20,  windowMs: 60_000 },  // upload
  { pattern: /^\/api\//,              max: 120, windowMs: 60_000 },  // all other API
];

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const limit = LIMITS.find(l => l.pattern.test(pathname));
  if (!limit) return NextResponse.next();

  const ip  = getIp(req);
  const key = `${ip}:${limit.pattern.source}`;
  const now = Date.now();

  const slot = hits.get(key);
  if (!slot || now > slot.resetAt) {
    hits.set(key, { count: 1, resetAt: now + limit.windowMs });
    return NextResponse.next();
  }

  slot.count += 1;
  if (slot.count > limit.max) {
    const retryAfter = Math.ceil((slot.resetAt - now) / 1000);
    return new NextResponse('Too many requests', {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit':     String(limit.max),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
