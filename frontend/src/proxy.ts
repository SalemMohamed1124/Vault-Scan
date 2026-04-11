import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register'];
const AUTH_PATHS = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Use 'access_token' to match the cookie name found in Services/auth.ts
  const token = request.cookies.get('access_token')?.value;

  // If logged in and trying to access auth pages → redirect to dashboard
  if (token && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  // If not logged in and trying to access protected pages → redirect to login
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p);
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
