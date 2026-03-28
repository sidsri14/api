import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { AuditService } from './audit.service.js';

export class AuthService {
  static async register(data: any) {
    const { email, password } = data;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const token = generateToken(user.id);
    
    // Audit Logging for Security
    await AuditService.log(user.id, 'USER_REGISTER', 'User', user.id, { email: user.email });
    
    return { user: { id: user.id, email: user.email }, token };
  }

  static async login(data: any) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Potentially log failed login attempt for brute force detection later
      throw new Error('Invalid credentials');
    }

    const token = generateToken(user.id);

    // Audit Logging for Security
    await AuditService.log(user.id, 'USER_LOGIN', 'User', user.id);

    return { user: { id: user.id, email: user.email }, token };
  }
}
