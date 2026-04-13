import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../utils/prisma.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const CALLBACK_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.yourdomain.com/api/auth/google/callback'
  : 'http://localhost:3000/api/auth/google/callback';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error('No email found in Google profile'), undefined);
        }

        // 1. Check if user already exists with this googleId
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id }
        });

        if (user) {
          return done(null, user);
        }

        // 2. Check if user exists with this email (Account Linking)
        user = await prisma.user.findUnique({
          where: { email }
        });

        if (user) {
          // Link googleId
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id }
          });
          return done(null, user);
        }

        // 3. Create new user
        user = await prisma.user.create({
          data: {
            email,
            name: profile.displayName || email.split('@')[0],
            googleId: profile.id,
            emailVerified: true // Google emails are already verified
          }
        });

        return done(null, user);

      } catch (error) {
        return done(error, undefined);
      }
    }
  ));
} else {
  console.warn('⚠️ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing. Google OAuth disabled.');
}

export default passport;
