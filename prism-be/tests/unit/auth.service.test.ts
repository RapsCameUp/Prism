import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser, getUserById } from '../../src/modules/auth/auth.service.js';

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
  },
}));

import { prisma } from '../../src/utils/prisma.js';
import bcrypt from 'bcrypt';

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginUser', () => {
    it('should return user data on valid credentials', async () => {
      const mockUser = {
        id: '123',
        name: 'Admin',
        email: 'admin@prism.ai',
        passwordHash: 'hashed',
        role: 'admin',
        createdAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await loginUser({ email: 'admin@prism.ai', password: 'password123' });

      expect(result).toEqual({
        id: '123',
        name: 'Admin',
        email: 'admin@prism.ai',
        role: 'admin',
      });
    });

    it('should throw on invalid email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        loginUser({ email: 'wrong@email.com', password: 'password123' })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw on invalid password', async () => {
      const mockUser = {
        id: '123',
        name: 'Admin',
        email: 'admin@prism.ai',
        passwordHash: 'hashed',
        role: 'admin',
        createdAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        loginUser({ email: 'admin@prism.ai', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getUserById', () => {
    it('should return user without password hash', async () => {
      const mockUser = {
        id: '123',
        name: 'Admin',
        email: 'admin@prism.ai',
        role: 'admin',
        createdAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await getUserById('123');

      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(getUserById('nonexistent')).rejects.toThrow('User not found');
    });
  });
});
