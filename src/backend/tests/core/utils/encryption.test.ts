import { describe, test, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { randomBytes } from 'crypto';
import {
  generateKey,
  encrypt,
  decrypt,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken
} from '../../../src/core/utils/encryption';
import { SECURITY } from '../../../src/config/constants';

// Test data setup
const TEST_PAYLOAD = { username: 'testuser', id: '123', role: 'user' };
const TEST_PASSWORD = 'P@ssw0rd123!';
const TEST_KEYS = {
  key16: Buffer.alloc(16),
  key24: Buffer.alloc(24),
  key32: Buffer.alloc(32)
};
const TEST_DATA = {
  string: 'test-data',
  buffer: Buffer.from('test-data'),
  object: { key: 'value' }
};

// Mock environment setup
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
});

// Clear mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

describe('Key Generation', () => {
  test('should generate 256-bit key by default', async () => {
    const key = await generateKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32); // 256 bits = 32 bytes
  });

  test('should generate keys of specified lengths', async () => {
    const key16 = await generateKey(16);
    const key24 = await generateKey(24);
    const key32 = await generateKey(32);

    expect(key16.length).toBe(16);
    expect(key24.length).toBe(24);
    expect(key32.length).toBe(32);
  });

  test('should generate unique keys', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    expect(key1).not.toEqual(key2);
  });

  test('should throw error for invalid key length', async () => {
    await expect(generateKey(0)).rejects.toThrow('Key length must be positive');
    await expect(generateKey(-1)).rejects.toThrow('Key length must be positive');
  });
});

describe('Encryption/Decryption', () => {
  let encryptionKey: Buffer;

  beforeAll(async () => {
    encryptionKey = await generateKey();
  });

  test('should encrypt and decrypt string data', () => {
    const encrypted = encrypt(TEST_DATA.string, encryptionKey);
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('encryptedData');
    expect(encrypted).toHaveProperty('authTag');

    const decrypted = decrypt(encrypted, encryptionKey);
    expect(decrypted).toBe(TEST_DATA.string);
  });

  test('should encrypt and decrypt object data', () => {
    const encrypted = encrypt(JSON.stringify(TEST_DATA.object), encryptionKey);
    const decrypted = decrypt(encrypted, encryptionKey);
    expect(JSON.parse(decrypted)).toEqual(TEST_DATA.object);
  });

  test('should generate unique IVs for each encryption', () => {
    const encrypted1 = encrypt(TEST_DATA.string, encryptionKey);
    const encrypted2 = encrypt(TEST_DATA.string, encryptionKey);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  test('should fail decryption with wrong key', async () => {
    const wrongKey = await generateKey();
    const encrypted = encrypt(TEST_DATA.string, encryptionKey);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  test('should fail decryption with tampered auth tag', () => {
    const encrypted = encrypt(TEST_DATA.string, encryptionKey);
    const tamperedData = {
      ...encrypted,
      authTag: randomBytes(16).toString('hex')
    };
    expect(() => decrypt(tamperedData, encryptionKey)).toThrow();
  });

  test('should throw error for invalid input data', () => {
    expect(() => encrypt('', encryptionKey)).toThrow();
    expect(() => encrypt(TEST_DATA.string, Buffer.alloc(0))).toThrow();
  });
});

describe('Password Hashing', () => {
  test('should generate password hash', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(TEST_PASSWORD);
    expect(hash.startsWith('$2a$')).toBe(true);
  });

  test('should verify correct password', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    const isValid = await comparePassword(TEST_PASSWORD, hash);
    expect(isValid).toBe(true);
  });

  test('should reject incorrect password', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    const isValid = await comparePassword('wrong-password', hash);
    expect(isValid).toBe(false);
  });

  test('should generate unique salts', async () => {
    const hash1 = await hashPassword(TEST_PASSWORD);
    const hash2 = await hashPassword(TEST_PASSWORD);
    expect(hash1).not.toBe(hash2);
  });

  test('should throw error for empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });

  test('should handle passwords of various lengths', async () => {
    const shortPass = 'abc';
    const longPass = 'a'.repeat(72); // bcrypt max length
    
    await expect(hashPassword(shortPass)).resolves.toBeDefined();
    await expect(hashPassword(longPass)).resolves.toBeDefined();
  });
});

describe('JWT Token Management', () => {
  test('should generate valid JWT token', () => {
    const token = generateToken(TEST_PAYLOAD);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('should verify valid token', async () => {
    const token = generateToken(TEST_PAYLOAD);
    const decoded = await verifyToken(token);
    expect(decoded).toMatchObject(TEST_PAYLOAD);
  });

  test('should include expiration claim', async () => {
    const token = generateToken(TEST_PAYLOAD);
    const decoded = await verifyToken(token) as any;
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp - decoded.iat).toBe(SECURITY.JWT_EXPIRY / 1000);
  });

  test('should reject expired token', async () => {
    // Mock Date.now to simulate token expiration
    const realDateNow = Date.now.bind(global.Date);
    const dateNowStub = jest.fn(() => realDateNow() + SECURITY.JWT_EXPIRY + 1000);
    global.Date.now = dateNowStub;
    
    const token = generateToken(TEST_PAYLOAD);
    await expect(verifyToken(token)).rejects.toThrow();
    
    // Restore Date.now
    global.Date.now = realDateNow;
  });

  test('should reject tampered token', async () => {
    const token = generateToken(TEST_PAYLOAD);
    const [header, payload, signature] = token.split('.');
    const tamperedToken = `${header}.${payload}.invalid-signature`;
    await expect(verifyToken(tamperedToken)).rejects.toThrow();
  });

  test('should throw error for invalid payload', () => {
    expect(() => generateToken(null as any)).toThrow();
    expect(() => generateToken('invalid' as any)).toThrow();
  });

  test('should throw error for missing JWT secret', async () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    
    expect(() => generateToken(TEST_PAYLOAD)).toThrow('JWT secret is not configured');
    await expect(verifyToken('some-token')).rejects.toThrow('JWT secret is not configured');
    
    process.env.JWT_SECRET = originalSecret;
  });
});