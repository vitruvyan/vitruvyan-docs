import NextAuth, { type NextAuthOptions } from 'next-auth'
import KeycloakProvider from 'next-auth/providers/keycloak'

/**
 * Keycloak (realm `frontier`) OIDC login that gates the whole Knowledge Base.
 * All env vars are configured in the Vercel project:
 *   KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_ISSUER,
 *   NEXTAUTH_URL, NEXTAUTH_SECRET
 */
export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID as string,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET as string,
      issuer: process.env.KEYCLOAK_ISSUER as string,
    }),
  ],
  session: { strategy: 'jwt' },
}

export default NextAuth(authOptions)
