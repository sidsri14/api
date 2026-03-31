import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { AuditService } from './audit.service.js';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from './email.service.js';

interface AuthData { email: string; password: string; }

const VERIFY_EXPIRY_HOURS = 24;
const RESET_EXPIRY_MINUTES = 60;

export class AuthService {
  static async register(data: AuthData) {
    const { email, password } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpiry = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        emailVerifyToken,
        emailVerifyExpiry,
      },
    });

    const token = generateToken(user.id);

    // Fire-and-forget: don't block registration if email fails
    void sendEmailVerificationEmail(email, {
      verifyLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${emailVerifyToken}`,
    }).catch(err => console.error('Failed to send verification email:', err));

    await AuditService.log(user.id, 'USER_REGISTER', 'User', user.id, { email: user.email });

    return { user: { id: user.id, email: user.email }, token };
  }

  static async verifyEmail(token: string) {
    const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
    if (!user) {
      const err = new Error('Invalid or expired verification token') as any;
      err.status = 400;
      throw err;
    }
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      const err = new Error('Verification token has expired — please request a new one') as any;
      err.status = 400;
      throw err;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null },
    });

    await AuditService.log(user.id, 'EMAIL_VERIFIED', 'User', user.id);
    return { message: 'Email verified successfully' };
  }

  static async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same message — don't leak whether email exists
    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpiry: resetExpiry },
    });

    void sendPasswordResetEmail(email, {
      resetLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`,
      expiresInMinutes: RESET_EXPIRY_MINUTES,
    }).catch(err => console.error('Failed to send reset email:', err));

    await AuditService.log(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);
    return { message: 'If that email exists, a reset link has been sent' };
  }

  static async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user) {
      const err = new Error('Invalid or expired reset token') as any;
      err.status = 400;
      throw err;
    }
    if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
      const err = new Error('Reset token has expired — please request a new one') as any;
      err.status = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordResetToken: null, passwordResetExpiry: null },
    });

    await AuditService.log(user.id, 'PASSWORD_RESET_COMPLETED', 'User', user.id);
    return { message: 'Password reset successfully' };
  }

  static async login(data: AuthData) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken(user.id);

    await AuditService.log(user.id, 'USER_LOGIN', 'User', user.id);

    return { user: { id: user.id, email: user.email }, token };
  }
}
