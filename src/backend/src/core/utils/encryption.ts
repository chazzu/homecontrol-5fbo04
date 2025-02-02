import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { SECURITY } from '../config/constants';

// Version comments for external dependencies
// bcryptjs: ^2.4.3
// jsonwebtoken: ^9.0.0

// Constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_ROUNDS = 10;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Interface for encrypted data structure
 */
interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
}

/**
 * Generates a cryptographically secure encryption key
 * @param length - Length of the key to generate in bytes
 * @returns Promise<Buffer> - Generated cryptographic key
 * @throws Error if key generation fails
 */
export const generateKey = async (length: number = KEY_LENGTH): Promise<Buffer> => {
  try {
    if (length <= 0) {
      throw new Error('Key length must be positive');
    }
    const salt = randomBytes(16);
    // Use scrypt for key derivation
    const key = await promisify(scrypt)(randomBytes(32), salt, length);
    return key as Buffer;
  } catch (error) {
    throw new Error(`Key generation failed: ${error.message}`);
  }
};

/**
 * Encrypts data using AES-256-GCM with authenticated encryption
 * @param data - Data to encrypt
 * @param key - Encryption key
 * @returns EncryptedData object containing IV, encrypted data, and authentication tag
 * @throws Error if encryption fails
 */
export const encrypt = (data: string, key: Buffer): EncryptedData => {
  try {
    if (!data || !key) {
      throw new Error('Data and key are required');
    }

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    // Encrypt data
    const encryptedData = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      encryptedData: encryptedData.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypts data encrypted with AES-256-GCM
 * @param encryptedData - Object containing IV, encrypted data, and authentication tag
 * @param key - Decryption key
 * @returns string - Decrypted data
 * @throws Error if decryption fails
 */
export const decrypt = (encryptedData: EncryptedData, key: Buffer): string => {
  try {
    const { iv, encryptedData: data, authTag } = encryptedData;

    if (!iv || !data || !authTag || !key) {
      throw new Error('Invalid encrypted data or key');
    }

    // Create decipher
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, 'hex')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Hashes a password using bcrypt
 * @param password - Password to hash
 * @returns Promise<string> - Hashed password
 * @throws Error if hashing fails
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    if (!password) {
      throw new Error('Password is required');
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
};

/**
 * Compares a password with its hash
 * @param password - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns Promise<boolean> - True if passwords match
 * @throws Error if comparison fails
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  try {
    if (!password || !hashedPassword) {
      throw new Error('Password and hash are required');
    }
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
};

/**
 * Generates a JWT token
 * @param payload - Data to encode in the token
 * @returns string - Signed JWT token
 * @throws Error if token generation fails
 */
export const generateToken = (payload: object): string => {
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Valid payload object is required');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    return jwt.sign(payload, secret, {
      expiresIn: SECURITY.JWT_EXPIRY,
      algorithm: 'HS256'
    });
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
};

/**
 * Verifies a JWT token
 * @param token - Token to verify
 * @returns Promise<object> - Decoded token payload
 * @throws Error if token is invalid or verification fails
 */
export const verifyToken = async (token: string): Promise<object> => {
  try {
    if (!token) {
      throw new Error('Token is required');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    return await new Promise((resolve, reject) => {
      jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
          reject(new Error(`Token verification failed: ${err.message}`));
        } else {
          resolve(decoded as object);
        }
      });
    });
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};