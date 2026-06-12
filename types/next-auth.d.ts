import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    orgId?: string | null;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    orgId?: string | null;
    role?: string;
  }
}
