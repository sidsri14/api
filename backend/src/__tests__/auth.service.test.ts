import { mock, describe, test, expect, beforeEach, beforeAll } from 'bun:test';

// ─── Module mocks (hoisted by Bun before imports) ───────────────────────────
const mockUserFindUnique = mock(async (_args?: any): Promise<any> => null);
const mockUserCreate = mock(async (_args?: any): Promise<any> => ({
  id: 'user-uuid-1',
  email: 'test@example.com',
  password: 'hashed-password',
  createdAt: new Date(),
}));
const mockAuditCreate = mock(async (): Promise<any> => null);

mock.module('../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mock(async () => ({})),
    },
    auditLog: {
      create: mockAuditCreate,
      createMany: mock(async () => ({})),
    },
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────
import { registerUser, loginUser, setUserPassword } from '../services/auth.service.js';

// ─── registerUser ────────────────────────────────────────────────────────────

describe('registerUser', () => {
  beforeEach(() => {
    mockUserFindUnique.mockImplementation(async () => null);
    mockUserCreate.mockImplementation(async (args: any) => ({
      id: 'user-uuid-1',
      email: args?.data?.email ?? 'test@example.com',
      password: args?.data?.password ?? 'hashed',
      createdAt: new Date(),
    }));
    mockAuditCreate.mockImplementation(async () => null);
  });

  test('returns user and token on successful registration', async () => {
    const result = await registerUser({
      email: 'new@example.com',
      password: 'Secure1@pass',
    });

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');
  });

  test('returned user contains id and email', async () => {
    const result = await registerUser({ email: 'new@example.com', password: 'Secure1@pass' });
    expect(result.user).toHaveProperty('id');
    expect(result.user).toHaveProperty('email');
  });

  test('throws when email is already taken', async () => {
    mockUserFindUnique.mockImplementation(async () => ({
      id: 'existing-user',
      email: 'test@example.com',
      password: 'hash',
      createdAt: new Date(),
    }));

    await expect(
      registerUser({ email: 'test@example.com', password: 'Secure1@pass' })
    ).rejects.toThrow('User already exists');
  });

  test('stores a bcrypt hash, not the plain-text password', async () => {
    let storedPassword = '';
    mockUserCreate.mockImplementation(async (args: any) => {
      storedPassword = args.data.password;
      return { id: 'user-uuid-1', email: args.data.email, password: storedPassword, createdAt: new Date() };
    });

    await registerUser({ email: 'new@example.com', password: 'Secure1@pass' });

    expect(storedPassword).not.toBe('Secure1@pass');
    expect(storedPassword.startsWith('$2')).toBe(true); // bcrypt identifier
  });
});

// ─── loginUser ────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  let hashedPassword: string;

  beforeAll(async () => {
    const bcrypt = await import('bcryptjs');
    hashedPassword = await bcrypt.default.hash('Secure1@pass', 10);
  });

  beforeEach(() => {
    mockUserFindUnique.mockImplementation(async () => ({
      id: 'user-uuid-1',
      email: 'test@example.com',
      password: hashedPassword,
      createdAt: new Date(),
    }));
    mockAuditCreate.mockImplementation(async () => null);
  });

  test('returns user and token with correct credentials', async () => {
    const result = await loginUser({
      email: 'test@example.com',
      password: 'Secure1@pass',
    });

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
  });

  test('returned user has id and email', async () => {
    const result = await loginUser({ email: 'test@example.com', password: 'Secure1@pass' });
    expect(result.user.id).toBe('user-uuid-1');
    expect(result.user.email).toBe('test@example.com');
  });

  test('throws Invalid credentials when user does not exist', async () => {
    mockUserFindUnique.mockImplementation(async () => null);

    await expect(
      loginUser({ email: 'ghost@example.com', password: 'any' })
    ).rejects.toThrow('Invalid credentials');
  });

  test('throws Invalid credentials when password is wrong', async () => {
    await expect(
      loginUser({ email: 'test@example.com', password: 'WrongPassword1@' })
    ).rejects.toThrow('Invalid credentials');
  });
});

// ─── setUserPassword ──────────────────────────────────────────────────────────

describe('setUserPassword', () => {
  test('throws if user not found', async () => {
    mockUserFindUnique.mockImplementation(async () => null);

    await expect(
      setUserPassword('nonexistent-id', 'NewPass1@')
    ).rejects.toThrow('User not found');
  });

  test('throws 400 if user already has a password', async () => {
    mockUserFindUnique.mockImplementation(async () => ({
      id: 'user-uuid-1',
      email: 'test@example.com',
      password: '$2b$12$existinghash',
      googleId: 'google-123',
      createdAt: new Date(),
    }));

    const err = await setUserPassword('user-uuid-1', 'NewPass1@').catch(e => e);
    expect(err.message).toBe('Password already set. Use Change Password instead.');
    expect(err.status).toBe(400);
  });

  test('hashes and saves password for Google-only user', async () => {
    mockUserFindUnique.mockImplementation(async () => ({
      id: 'user-uuid-1',
      email: 'test@example.com',
      password: null,
      googleId: 'google-123',
      createdAt: new Date(),
    }));

    let savedPassword = '';
    const { prisma } = await import('../utils/prisma.js');
    (prisma.user.update as any).mockImplementation(async (args: any) => {
      savedPassword = args.data.password;
      return {};
    });

    const result = await setUserPassword('user-uuid-1', 'NewPass1@');

    expect(result).toEqual({ message: 'Password set successfully' });
    expect(savedPassword).not.toBe('NewPass1@');
    expect(savedPassword.startsWith('$2')).toBe(true);
  });
});
