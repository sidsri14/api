import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { logAuditAction } from './audit.service.js';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from './email.service.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });
const VERIFY_EXPIRY_HOURS = 24;
const RESET_EXPIRY_MINUTES = 60;

export const registerUser = async (data: any) => {
  const { email, password, name } = data;
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('User already exists');

  const hashed = await bcrypt.hash(password, 12);
  const vToken = crypto.randomBytes(32).toString('hex');
  const user = await prisma.user.create({
    data: { 
      email, password: hashed, name, plan: 'free', 
      emailVerifyToken: vToken, 
      emailVerifyExpiry: new Date(Date.now() + VERIFY_EXPIRY_HOURS * 3600000) 
    },
  });

  const token = generateToken(user.id);
  sendEmailVerificationEmail(email, {
    verifyLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${vToken}`,
  }).catch(e => logger.error(e));

  await logAuditAction(user.id, 'USER_REGISTER', 'User', user.id, { email, name });
  return { user: { id: user.id, email, name: user.name }, token };
};

// Sentinel hash: used when the user doesn't exist so bcrypt.compare always runs,
// preventing timing-based username enumeration.
const DUMMY_HASH = '$2b$12$invalidhashthatisneverusedXXXXXXXXXXXXXXXXXXXXXXXXXXX';

export const loginUser = async (data: any) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const hashToCheck = user?.password ?? DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(data.password, hashToCheck);
  if (!user || !passwordMatch) {
    // Log failed attempts against the user if they exist (enables brute-force detection).
    if (user) {
      await logAuditAction(user.id, 'LOGIN_FAILED', 'User', user.id, { email: data.email }).catch(() => {});
    }
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id);
  await logAuditAction(user.id, 'LOGIN_SUCCESS', 'User', user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, token };
};

export const verifyUserEmail = async (token: string) => {
  if (!token) throw { status: 400, message: 'Token required' };
  const u = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
  if (!u || (u.emailVerifyExpiry && u.emailVerifyExpiry < new Date())) throw { status: 400, message: 'Expired or invalid token' };

  await prisma.user.update({ where: { id: u.id }, data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null } });
  await logAuditAction(u.id, 'EMAIL_VERIFIED', 'User', u.id);
  return { message: 'Verified!' };
};

// Minimum wall-clock ms for requestPassReset regardless of branch taken.
// Prevents email enumeration via response-time differences.
const RESET_MIN_MS = 500;

export const requestPassReset = async (email: string) => {
  const startMs = Date.now();

  const u = await prisma.user.findUnique({ where: { email } });

  if (u) {
    const rToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordResetToken: rToken, passwordResetExpiry: new Date(Date.now() + RESET_EXPIRY_MINUTES * 60000) }
    });

    sendPasswordResetEmail(email, {
      resetLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rToken}`,
      expiresInMinutes: RESET_EXPIRY_MINUTES,
    }).catch(e => logger.error(e));

    await logAuditAction(u.id, 'PASSWORD_RESET_REQUESTED', 'User', u.id);
  }

  // Constant-time pad: both branches always take at least RESET_MIN_MS so an
  // attacker cannot enumerate registered emails by wall-clock difference.
  const elapsed = Date.now() - startMs;
  if (elapsed < RESET_MIN_MS) {
    await new Promise(resolve => setTimeout(resolve, RESET_MIN_MS - elapsed));
  }

  return { message: 'Check your email' };
};

export const completePassReset = async (token: string, pass: string) => {
  if (!token) throw { status: 400, message: 'Token required' };
  const u = await prisma.user.findUnique({ where: { passwordResetToken: token } });
  if (!u || (u.passwordResetExpiry && u.passwordResetExpiry < new Date())) throw { status: 400, message: 'Expired or invalid token' };

  const hashed = await bcrypt.hash(pass, 12);
  await prisma.user.update({ where: { id: u.id }, data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null } });
  await logAuditAction(u.id, 'PASSWORD_RESET_COMPLETED', 'User', u.id);
  return { message: 'Reset successful' };
};

export const updateUserProfile = async (userId: string, data: { name?: string; email?: string }) => {
  const { name, email } = data;

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) throw new Error('Email already in use');
  }

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const emailChanged = email && email !== current?.email;

  // If the email address changes, the new address must be re-verified.
  // Generate a fresh token so the old verification link can no longer be used.
  const emailUpdateFields = emailChanged
    ? {
        email,
        emailVerified: false,
        emailVerifyToken: crypto.randomBytes(32).toString('hex'),
        emailVerifyExpiry: new Date(Date.now() + VERIFY_EXPIRY_HOURS * 3600000),
      }
    : (email ? { email } : {});

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, ...emailUpdateFields },
    select: { id: true, email: true, name: true, plan: true, createdAt: true, emailVerifyToken: true }
  });

  if (emailChanged && user.emailVerifyToken) {
    sendEmailVerificationEmail(email!, {
      verifyLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${user.emailVerifyToken}`,
    }).catch(e => logger.error(e));
  }

  await logAuditAction(userId, 'USER_PROFILE_UPDATED', 'User', userId, { name, email });
  const { emailVerifyToken: _tok, ...rest } = user;
  return rest;
};

export const changeUserPassword = async (userId: string, oldPass: string, newPass: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  if (!user.password) throw new Error('Incorrect current password');
  const match = await bcrypt.compare(oldPass, user.password);
  if (!match) throw new Error('Incorrect current password');

  const hashed = await bcrypt.hash(newPass, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed }
  });

  await logAuditAction(userId, 'USER_PASSWORD_CHANGED', 'User', userId);
  return { message: 'Password updated successfully' };
};

export const setUserPassword = async (userId: string, newPass: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.password) throw Object.assign(new Error('Password already set. Use Change Password instead.'), { status: 400 });

  const hashed = await bcrypt.hash(newPass, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  await logAuditAction(userId, 'USER_PASSWORD_SET', 'User', userId);
  return { message: 'Password set successfully' };
};
