import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';

interface GoogleProfile {
  id: string;
  emails?: Array<{ value: string }>;
  displayName?: string;
}

export const findOrCreateGoogleUser = async (profile: GoogleProfile) => {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('No email returned from Google');

  // Try to find by googleId first (returning user)
  let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

  if (!user) {
    // Try to find by email (existing password-based account → link it)
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Link the Google account to the existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id, emailVerified: true },
      });
    } else {
      // New user — create account (no password)
      user = await prisma.user.create({
        data: {
          email,
          name: profile.displayName ?? null,
          googleId: profile.id,
          plan: 'free',
          emailVerified: true,
        },
      });
    }
  }

  const token = generateToken(user.id);
  return { user, token };
};
