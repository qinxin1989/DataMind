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
    // 读取加密文件
    const data = fs.readFileSync(encryptedPath);
    
    // 提取各部分
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // 派生密钥
    const key = this.deriveKey(salt);
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // 解密数据
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return decrypted;
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
}

// 导出单例
export const fileEncryption = new FileEncryptionService();
