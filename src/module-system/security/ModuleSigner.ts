import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 模块签名器
 * 负责模块的签名生成和验证
 */
export class ModuleSigner {
  private privateKey: string | null = null;
  private publicKey: string | null = null;

  /**
   * 生成 RSA 密钥对
   */
  async generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err);
          } else {
            this.publicKey = publicKey;
            this.privateKey = privateKey;
            resolve({ privateKey, publicKey });
          }
        }
      );
    });
  }

  /**
   * 加载私钥
   */
  async loadPrivateKey(keyPath: string): Promise<void> {
    this.privateKey = await fs.readFile(keyPath, 'utf-8');
  }

  /**
   * 加载公钥
   */
  async loadPublicKey(keyPath: string): Promise<void> {
    this.publicKey = await fs.readFile(keyPath, 'utf-8');
  }

  /**
   * 保存密钥对到文件
   */
  async saveKeyPair(
    privateKeyPath: string,
    publicKeyPath: string
  ): Promise<void> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('No key pair generated');
    }

    await fs.writeFile(privateKeyPath, this.privateKey, 'utf-8');
    await fs.writeFile(publicKeyPath, this.publicKey, 'utf-8');
  }

  /**
   * 计算文件的 SHA-256 哈希
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 计算目录下所有文件的哈希
   */
  private async calculateDirectoryHash(
    dirPath: string,
    excludePatterns: string[] = []
  ): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    
    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dirPath, fullPath);
        
        // 跳过排除的文件
        if (excludePatterns.some(pattern => relativePath.includes(pattern))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          hashes[relativePath] = await this.calculateFileHash(fullPath);
        }
      }
    };
    
    await processDirectory(dirPath);
    return hashes;
  }

  /**
   * 对模块进行签名
   */
  async signModule(modulePath: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not loaded');
    }

    // 读取 module.json
    const manifestPath = path.join(modulePath, 'module.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

    // 计算所有文件的哈希 (排除签名文件和密钥文件)
    const fileHashes = await this.calculateDirectoryHash(modulePath, [
      'module.signature',
      'module.public.key',
      'module.private.key',
      'node_modules',
      '.git'
    ]);

    // 构建签名数据
    const signatureData = {
      name: manifest.name,
      version: manifest.version,
      dependencies: manifest.dependencies || {},
      fileHashes,
      timestamp: new Date().toISOString()
    };

    // 生成签名
    const dataToSign = JSON.stringify(signatureData, null, 2);
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(dataToSign);
    const signature = sign.sign(this.privateKey, 'base64');

    // 保存签名数据
    const signatureFile = {
      signature,
      data: signatureData
    };

    const signaturePath = path.join(modulePath, 'module.signature');
    await fs.writeFile(
      signaturePath,
      JSON.stringify(signatureFile, null, 2),
      'utf-8'
    );

    // 如果公钥存在,也保存一份
    if (this.publicKey) {
      const publicKeyPath = path.join(modulePath, 'module.public.key');
      await fs.writeFile(publicKeyPath, this.publicKey, 'utf-8');
    }

    return signature;
  }

  /**
   * 验证模块签名
   */
  async verifyModule(modulePath: string): Promise<boolean> {
    try {
      // 读取签名文件
      const signaturePath = path.join(modulePath, 'module.signature');
      const signatureFile = JSON.parse(
        await fs.readFile(signaturePath, 'utf-8')
      );

      const { signature, data } = signatureFile;

      // 加载公钥 (优先使用模块自带的公钥)
      const publicKeyPath = path.join(modulePath, 'module.public.key');
      try {
        await this.loadPublicKey(publicKeyPath);
      } catch (err) {
        // 如果模块没有公钥,使用已加载的公钥
        if (!this.publicKey) {
          throw new Error('No public key available for verification');
        }
      }

      // 验证签名
      const dataToVerify = JSON.stringify(data, null, 2);
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(dataToVerify);
      const isValid = verify.verify(this.publicKey!, signature, 'base64');

      if (!isValid) {
        return false;
      }

      // 验证文件哈希
      const currentHashes = await this.calculateDirectoryHash(modulePath, [
        'module.signature',
        'module.public.key',
        'module.private.key',
        'node_modules',
        '.git'
      ]);

      // 检查所有文件的哈希是否匹配
      for (const [file, hash] of Object.entries(data.fileHashes)) {
        if (currentHashes[file] !== hash) {
          console.error(`File hash mismatch: ${file}`);
          return false;
        }
      }

      // 检查是否有新增文件
      for (const file of Object.keys(currentHashes)) {
        if (!data.fileHashes[file]) {
          console.error(`Unexpected file found: ${file}`);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('Signature verification failed:', err);
      return false;
    }
  }

  /**
   * 获取签名信息
   */
  async getSignatureInfo(
    modulePath: string
  ): Promise<{
    name: string;
    version: string;
    timestamp: string;
    fileCount: number;
  } | null> {
    try {
      const signaturePath = path.join(modulePath, 'module.signature');
      const signatureFile = JSON.parse(
        await fs.readFile(signaturePath, 'utf-8')
      );

      const { data } = signatureFile;

      return {
        name: data.name,
        version: data.version,
        timestamp: data.timestamp,
        fileCount: Object.keys(data.fileHashes).length
      };
    } catch (err) {
      return null;
    }
  }
}
