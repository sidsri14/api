import crypto from 'crypto';
import bcrypt from 'bcrypt';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { logAuditAction } from './audit.service.js';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from './email.service.js';

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });
const VERIFY_EXPIRY_HOURS = 24;
const RESET_EXPIRY_MINUTES = 60;

export const registerUser = async (data: any) => {
  const { email, password } = data;
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('User already exists');

  const hashed = await bcrypt.hash(password, 12);
  const vToken = crypto.randomBytes(32).toString('hex');
  const user = await prisma.user.create({
    data: { 
      email, password: hashed, plan: 'free', 
      emailVerifyToken: vToken, 
      emailVerifyExpiry: new Date(Date.now() + VERIFY_EXPIRY_HOURS * 3600000) 
    },
  });

  const token = generateToken(user.id);
  sendEmailVerificationEmail(email, {
    verifyLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${vToken}`,
  }).catch(e => logger.error(e));

  await logAuditAction(user.id, 'USER_REGISTER', 'User', user.id, { email });
  return { user: { id: user.id, email }, token };
};

// Sentinel hash: used when the user doesn't exist so bcrypt.compare always runs,
// preventing timing-based username enumeration.
const DUMMY_HASH = '$2b$12$invalidhashthatisneverusedXXXXXXXXXXXXXXXXXXXXXXXXXXX';

export const loginUser = async (data: any) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const hashToCheck = user?.password ?? DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(data.password, hashToCheck);
  if (!user || !passwordMatch) throw new Error('Invalid credentials');

  const token = generateToken(user.id);
  await logAuditAction(user.id, 'USER_LOGIN', 'User', user.id);
  return { user: { id: user.id, email: user.email }, token };
};

export const verifyUserEmail = async (token: string) => {
  const u = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
  if (!u || (u.emailVerifyExpiry && u.emailVerifyExpiry < new Date())) throw { status: 400, message: 'Expired or invalid token' };

  await prisma.user.update({ where: { id: u.id }, data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null } });
  await logAuditAction(u.id, 'EMAIL_VERIFIED', 'User', u.id);
  return { message: 'Verified!' };
};

export const requestPassReset = async (email: string) => {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return { message: 'Check your email' };

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
  return { message: 'Check your email' };
};

export const completePassReset = async (token: string, pass: string) => {
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

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, email },
    select: { id: true, email: true, name: true, plan: true, createdAt: true }
  });

  await logAuditAction(userId, 'USER_PROFILE_UPDATED', 'User', userId, { name, email });
  return user;
};

export const changeUserPassword = async (userId: string, oldPass: string, newPass: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

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
