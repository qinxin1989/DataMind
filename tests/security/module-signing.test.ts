import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModuleSigner } from '../../src/module-system/security/ModuleSigner';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ModuleSigner', () => {
  let signer: ModuleSigner;
  let testDir: string;
  let moduleDir: string;

  beforeEach(async () => {
    signer = new ModuleSigner();
    
    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'module-signing-test-'));
    moduleDir = path.join(testDir, 'test-module');
    await fs.mkdir(moduleDir, { recursive: true });
    
    // 创建测试模块文件
    await fs.writeFile(
      path.join(moduleDir, 'module.json'),
      JSON.stringify({
        name: 'test-module',
        version: '1.0.0',
        dependencies: {}
      }, null, 2)
    );
    
    await fs.writeFile(
      path.join(moduleDir, 'index.ts'),
      'export default function() { return "test"; }'
    );
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // 忽略清理错误
    }
  });

  describe('密钥生成', () => {
    it('应该成功生成 RSA 密钥对', async () => {
      const { privateKey, publicKey } = await signer.generateKeyPair();
      
      expect(privateKey).toBeDefined();
      expect(publicKey).toBeDefined();
      expect(privateKey).toContain('BEGIN PRIVATE KEY');
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
    });

    it('应该能保存密钥对到文件', async () => {
      await signer.generateKeyPair();
      
      const privateKeyPath = path.join(testDir, 'private.key');
      const publicKeyPath = path.join(testDir, 'public.key');
      
      await signer.saveKeyPair(privateKeyPath, publicKeyPath);
      
      const privateKeyContent = await fs.readFile(privateKeyPath, 'utf-8');
      const publicKeyContent = await fs.readFile(publicKeyPath, 'utf-8');
      
      expect(privateKeyContent).toContain('BEGIN PRIVATE KEY');
      expect(publicKeyContent).toContain('BEGIN PUBLIC KEY');
    });

    it('应该能从文件加载密钥', async () => {
      await signer.generateKeyPair();
      
      const privateKeyPath = path.join(testDir, 'private.key');
      const publicKeyPath = path.join(testDir, 'public.key');
      
      await signer.saveKeyPair(privateKeyPath, publicKeyPath);
      
      const newSigner = new ModuleSigner();
      await newSigner.loadPrivateKey(privateKeyPath);
      await newSigner.loadPublicKey(publicKeyPath);
      
      // 验证可以使用加载的密钥进行签名
      const signature = await newSigner.signModule(moduleDir);
      expect(signature).toBeDefined();
    });
  });

  describe('模块签名', () => {
    beforeEach(async () => {
      await signer.generateKeyPair();
    });

    it('应该成功对模块进行签名', async () => {
      const signature = await signer.signModule(moduleDir);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('应该创建签名文件', async () => {
      await signer.signModule(moduleDir);
      
      const signaturePath = path.join(moduleDir, 'module.signature');
      const signatureContent = await fs.readFile(signaturePath, 'utf-8');
      const signatureData = JSON.parse(signatureContent);
      
      expect(signatureData.signature).toBeDefined();
      expect(signatureData.data).toBeDefined();
      expect(signatureData.data.name).toBe('test-module');
      expect(signatureData.data.version).toBe('1.0.0');
    });

    it('应该包含所有文件的哈希', async () => {
      await signer.signModule(moduleDir);
      
      const signaturePath = path.join(moduleDir, 'module.signature');
      const signatureContent = await fs.readFile(signaturePath, 'utf-8');
      const signatureData = JSON.parse(signatureContent);
      
      expect(signatureData.data.fileHashes).toBeDefined();
      expect(signatureData.data.fileHashes['module.json']).toBeDefined();
      expect(signatureData.data.fileHashes['index.ts']).toBeDefined();
    });

    it('应该排除签名文件和密钥文件', async () => {
      await signer.signModule(moduleDir);
      
      const signaturePath = path.join(moduleDir, 'module.signature');
      const signatureContent = await fs.readFile(signaturePath, 'utf-8');
      const signatureData = JSON.parse(signatureContent);
      
      expect(signatureData.data.fileHashes['module.signature']).toBeUndefined();
      expect(signatureData.data.fileHashes['module.public.key']).toBeUndefined();
    });

    it('应该包含时间戳', async () => {
      await signer.signModule(moduleDir);
      
      const signaturePath = path.join(moduleDir, 'module.signature');
      const signatureContent = await fs.readFile(signaturePath, 'utf-8');
      const signatureData = JSON.parse(signatureContent);
      
      expect(signatureData.data.timestamp).toBeDefined();
      expect(new Date(signatureData.data.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('签名验证', () => {
    beforeEach(async () => {
      await signer.generateKeyPair();
      await signer.signModule(moduleDir);
    });

    it('应该验证有效的签名', async () => {
      const isValid = await signer.verifyModule(moduleDir);
      expect(isValid).toBe(true);
    });

    it('应该检测文件内容被篡改', async () => {
      // 修改文件内容
      await fs.writeFile(
        path.join(moduleDir, 'index.ts'),
        'export default function() { return "tampered"; }'
      );
      
      const isValid = await signer.verifyModule(moduleDir);
      expect(isValid).toBe(false);
    });

    it('应该检测新增文件', async () => {
      // 添加新文件
      await fs.writeFile(
        path.join(moduleDir, 'new-file.ts'),
        'export const test = "new";'
      );
      
      const isValid = await signer.verifyModule(moduleDir);
      expect(isValid).toBe(false);
    });

    it('应该检测文件被删除', async () => {
      // 删除文件
      await fs.unlink(path.join(moduleDir, 'index.ts'));
      
      const isValid = await signer.verifyModule(moduleDir);
      expect(isValid).toBe(false);
    });

    it('应该使用模块自带的公钥验证', async () => {
      // 创建新的签名器来验证
      const verifier = new ModuleSigner();
      const isValid = await verifier.verifyModule(moduleDir);
      
      expect(isValid).toBe(true);
    });

    it('应该能获取签名信息', async () => {
      const info = await signer.getSignatureInfo(moduleDir);
      
      expect(info).toBeDefined();
      expect(info!.name).toBe('test-module');
      expect(info!.version).toBe('1.0.0');
      expect(info!.fileCount).toBeGreaterThan(0);
      expect(info!.timestamp).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该在没有私钥时抛出错误', async () => {
      const newSigner = new ModuleSigner();
      
      await expect(newSigner.signModule(moduleDir)).rejects.toThrow('Private key not loaded');
    });

    it('应该在模块不存在时返回 false', async () => {
      await signer.generateKeyPair();
      
      const nonExistentPath = path.join(testDir, 'non-existent');
      const isValid = await signer.verifyModule(nonExistentPath);
      
      expect(isValid).toBe(false);
    });

    it('应该在签名文件不存在时返回 null', async () => {
      const info = await signer.getSignatureInfo(moduleDir);
      expect(info).toBeNull();
    });
  });

  describe('多文件模块', () => {
    beforeEach(async () => {
      // 创建更复杂的模块结构
      await fs.mkdir(path.join(moduleDir, 'backend'), { recursive: true });
      await fs.mkdir(path.join(moduleDir, 'frontend'), { recursive: true });
      
      await fs.writeFile(
        path.join(moduleDir, 'backend', 'service.ts'),
        'export class Service {}'
      );
      
      await fs.writeFile(
        path.join(moduleDir, 'frontend', 'component.vue'),
        '<template><div>Test</div></template>'
      );
      
      await signer.generateKeyPair();
    });

    it('应该签名所有子目录中的文件', async () => {
      await signer.signModule(moduleDir);
      
      const signaturePath = path.join(moduleDir, 'module.signature');
      const signatureContent = await fs.readFile(signaturePath, 'utf-8');
      const signatureData = JSON.parse(signatureContent);
      
      // 使用平台无关的路径检查
      const hasBackendService = Object.keys(signatureData.data.fileHashes).some(
        key => key.includes('backend') && key.includes('service.ts')
      );
      const hasFrontendComponent = Object.keys(signatureData.data.fileHashes).some(
        key => key.includes('frontend') && key.includes('component.vue')
      );
      
      expect(hasBackendService).toBe(true);
      expect(hasFrontendComponent).toBe(true);
    });

    it('应该验证所有子目录中的文件', async () => {
      await signer.signModule(moduleDir);
      
      const isValid = await signer.verifyModule(moduleDir);
      expect(isValid).toBe(true);
    });
  });
});
