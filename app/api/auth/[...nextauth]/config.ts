import GithubProvider from "next-auth/providers/github";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

interface ExtendedSession extends Session {
  accessToken?: string;
}

interface ExtendedToken extends JWT {
  accessToken?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.AUTH_GITHUB_ID as string,
      clientSecret: process.env.AUTH_GITHUB_SECRET as string,
      authorization: {
        params: {
          scope: "read:user repo",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }): Promise<ExtendedToken> {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: ExtendedToken;
    }): Promise<ExtendedSession> {
      const extendedSession = session as ExtendedSession;
      extendedSession.accessToken = token.accessToken;
      return extendedSession;
    },
  },
  pages: {
    signIn: "/login",
  },
};
