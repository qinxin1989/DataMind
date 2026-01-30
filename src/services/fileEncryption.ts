import * as crypto from 'crypto';
import * as fs from 'fs';

// 文件加密服务
// 使用 AES-256-GCM 加密算法

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export class FileEncryptionService {
  private secretKey: string;

  constructor(secretKey?: string) {
    // 使用环境变量或默认密钥
    this.secretKey = secretKey || process.env.FILE_ENCRYPTION_KEY || 'default-file-encryption-key-change-me';
  }

  // 从密钥派生加密密钥
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.secretKey, salt, 100000, 32, 'sha256');
  }

  // 加密文件
  async encryptFile(inputPath: string, outputPath?: string): Promise<string> {
    const outPath = outputPath || inputPath + '.enc';
    
    // 读取原始文件
    const plaintext = fs.readFileSync(inputPath);
    
    // 生成随机盐和IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 派生密钥
    const key = this.deriveKey(salt);
    
    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // 加密数据
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // 写入加密文件: salt + iv + authTag + encrypted
    const output = Buffer.concat([salt, iv, authTag, encrypted]);
    fs.writeFileSync(outPath, output);
    
    // 删除原始文件
    if (outputPath !== inputPath) {
      fs.unlinkSync(inputPath);
    }
    
    return outPath;
  }

  // 解密文件到内存
  decryptFileToBuffer(encryptedPath: string): Buffer {
    try {
      // 读取加密文件
      const data = fs.readFileSync(encryptedPath);

      // 验证文件最小长度：salt + iv + authTag = 32 + 16 + 16 = 64字节
      const minFileSize = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
      if (data.length < minFileSize) {
        throw new Error(`加密文件格式不正确：文件大小 (${data.length}字节) 小于最小要求 (${minFileSize}字节)，文件可能被截断或损坏`);
      }

      // 提取各部分
      const salt = data.subarray(0, SALT_LENGTH);
      const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

      // 验证是否有加密数据
      if (encrypted.length === 0) {
        throw new Error('加密文件格式不正确：未找到加密数据');
      }

      // 派生密钥
      const key = this.deriveKey(salt);

      // 创建解密器
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // 解密数据
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted;
    } catch (error: any) {
      // 提供更详细的错误信息
      if (error.message.includes('Unsupported state') || error.message.includes('unable to authenticate')) {
        throw new Error(`解密失败：文件认证失败。可能原因：1) 加密密钥已变更 2) 文件已损坏 3) 加密过程被中断。文件路径: ${encryptedPath}`);
      }
      throw error;
    }
  }

  // 解密文件到临时文件（用于需要文件路径的场景）
  decryptFileToTemp(encryptedPath: string): string {
    const decrypted = this.decryptFileToBuffer(encryptedPath);
    
    // 创建临时文件
    const tempPath = encryptedPath.replace('.enc', '.tmp');
    fs.writeFileSync(tempPath, decrypted);
    
    return tempPath;
  }

  // 清理临时文件
  cleanupTempFile(tempPath: string): void {
    if (fs.existsSync(tempPath) && tempPath.endsWith('.tmp')) {
      fs.unlinkSync(tempPath);
    }
  }

  // 检查文件是否已加密
  isEncrypted(filePath: string): boolean {
    return filePath.endsWith('.enc');
  }

  // 验证加密文件是否有效（不实际解密，只检查格式）
  validateEncryptedFile(encryptedPath: string): { valid: boolean; error?: string } {
    try {
      const data = fs.readFileSync(encryptedPath);
      const minFileSize = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;

      if (data.length < minFileSize) {
        return { valid: false, error: `文件过小 (${data.length}字节 < ${minFileSize}字节)，可能被截断` };
      }

      // 检查文件末尾是否有数据
      const encryptedSize = data.length - minFileSize;
      if (encryptedSize === 0) {
        return { valid: false, error: '文件不包含加密数据' };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

// 导出单例
export const fileEncryption = new FileEncryptionService();
