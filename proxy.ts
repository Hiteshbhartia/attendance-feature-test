import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = [
  '/login',
  '/signup',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/request-password-change',
  '/api/zones',
  '/api/test',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply auth checks to API routes
  if (pathname.startsWith('/api/')) {
    const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
    const token = request.cookies.get('gp_att_token')?.value;

    if (!isPublic && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // For page routes, redirect to login if no token
  const isPublicPage = PUBLIC.some((p) => pathname.startsWith(p));
  const token = request.cookies.get('gp_att_token')?.value;

  if (!isPublicPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg).*)'],
};
