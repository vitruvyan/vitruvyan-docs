export { default } from 'next-auth/middleware'

/**
 * Require a valid Keycloak session for every page and API route, except the
 * NextAuth endpoints themselves, Next internals and the favicon. Unauthenticated
 * visitors are redirected to the sign-in flow (Keycloak, realm `frontier`).
 */
export const config = {
  matcher: ['/((?!api/auth|_next|favicon.ico).*)'],
}
