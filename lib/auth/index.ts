import NextAuth, { type NextAuthConfig } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import GitHub from 'next-auth/providers/github';
import Nodemailer from 'next-auth/providers/nodemailer';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { ensureOrgForUser, ensureUserWithOrg } from './bootstrap';

const e = env();

// Providers are wired conditionally so the app runs with zero keys.
const providers: NextAuthConfig['providers'] = [];

if (e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({ clientId: e.AUTH_GITHUB_ID, clientSecret: e.AUTH_GITHUB_SECRET }),
  );
}

if (e.SMTP_URL) {
  providers.push(
    Nodemailer({ server: e.SMTP_URL, from: e.EMAIL_FROM }),
  );
}

// Dev-only password-less sign-in so a fresh clone is usable without any provider keys.
// Disabled in production.
const DEV_LOGIN_ENABLED = e.NODE_ENV !== 'production';
if (DEV_LOGIN_ENABLED) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Developer sign-in',
      credentials: { email: { label: 'Email', type: 'email' }, name: { label: 'Name', type: 'text' } },
      async authorize(creds) {
        const email = typeof creds?.email === 'string' ? creds.email : '';
        if (!email || !email.includes('@')) return null;
        const name = typeof creds?.name === 'string' ? creds.name : null;
        const u = await ensureUserWithOrg(email, name);
        return { id: u.id, email: u.email, name: u.name, orgId: u.orgId } as {
          id: string;
          email: string;
          name: string | null;
          orgId: string | null;
        };
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT strategy: required by the dev Credentials provider and compatible with
  // GitHub OAuth + Nodemailer magic links (the adapter still persists user/account rows).
  session: { strategy: 'jwt' },
  trustHost: true,
  secret: e.AUTH_SECRET,
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      const uid = token.uid as string | undefined;
      if (uid && !token.orgId) {
        await ensureOrgForUser(uid);
        const [row] = await db
          .select({ orgId: users.orgId, role: users.role })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);
        token.orgId = row?.orgId ?? null;
        token.role = row?.role ?? 'member';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.orgId = (token.orgId as string | null) ?? null;
        session.user.role = (token.role as string) ?? 'member';
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { DEV_LOGIN_ENABLED };
