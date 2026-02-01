#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ModuleSigner } from '../security/ModuleSigner';

const program = new Command();

program
  .name('module-sign')
  .description('Module signing tool')
  .version('1.0.0');

// 生成密钥对
program
  .command('keygen')
  .description('Generate RSA key pair')
  .option('-o, --output <dir>', 'Output directory', '.')
  .action(async (options) => {
    try {
      const signer = new ModuleSigner();
      console.log('Generating RSA key pair...');
      
      await signer.generateKeyPair();
      
      const privateKeyPath = path.join(options.output, 'module.private.key');
      const publicKeyPath = path.join(options.output, 'module.public.key');
      
      await signer.saveKeyPair(privateKeyPath, publicKeyPath);
      
      console.log('✓ Key pair generated successfully');
      console.log(`  Private key: ${privateKeyPath}`);
      console.log(`  Public key: ${publicKeyPath}`);
      console.log('\n⚠️  Keep your private key secure!');
    } catch (err) {
      console.error('✗ Failed to generate key pair:', err);
      process.exit(1);
    }
  });

// 签名模块
program
  .command('sign <module-path>')
  .description('Sign a module')
  .option('-k, --key <path>', 'Private key path', 'module.private.key')
  .action(async (modulePath, options) => {
    try {
      const signer = new ModuleSigner();
      
      console.log(`Signing module: ${modulePath}`);
      console.log(`Using private key: ${options.key}`);
      
      // 加载私钥
      await signer.loadPrivateKey(options.key);
      
      // 签名模块
      const signature = await signer.signModule(modulePath);
      
      console.log('✓ Module signed successfully');
      console.log(`  Signature: ${signature.substring(0, 64)}...`);
      console.log(`  Signature file: ${path.join(modulePath, 'module.signature')}`);
    } catch (err) {
      console.error('✗ Failed to sign module:', err);
      process.exit(1);
    }
  });

// 验证模块签名
program
  .command('verify <module-path>')
  .description('Verify module signature')
  .option('-k, --key <path>', 'Public key path (optional)')
  .action(async (modulePath, options) => {
    try {
      const signer = new ModuleSigner();
      
      console.log(`Verifying module: ${modulePath}`);
      
      // 如果提供了公钥路径,加载它
      if (options.key) {
        console.log(`Using public key: ${options.key}`);
        await signer.loadPublicKey(options.key);
      }
      
      // 获取签名信息
      const info = await signer.getSignatureInfo(modulePath);
      if (info) {
        console.log('\nSignature Info:');
        console.log(`  Module: ${info.name} v${info.version}`);
        console.log(`  Signed at: ${info.timestamp}`);
        console.log(`  Files: ${info.fileCount}`);
      }
      
      // 验证签名
      console.log('\nVerifying signature...');
      const isValid = await signer.verifyModule(modulePath);
      
      if (isValid) {
        console.log('✓ Signature is valid');
        console.log('✓ All files are intact');
        process.exit(0);
      } else {
        console.log('✗ Signature verification failed');
        console.log('✗ Module may have been tampered with');
        process.exit(1);
      }
    } catch (err) {
      console.error('✗ Verification error:', err);
      process.exit(1);
    }
  });

// 批量签名
program
  .command('sign-all <modules-dir>')
  .description('Sign all modules in a directory')
  .option('-k, --key <path>', 'Private key path', 'module.private.key')
  .action(async (modulesDir, options) => {
    try {
      const signer = new ModuleSigner();
      
      console.log(`Signing all modules in: ${modulesDir}`);
      console.log(`Using private key: ${options.key}`);
      
      // 加载私钥
      await signer.loadPrivateKey(options.key);
      
      // 读取所有模块目录
      const entries = await fs.readdir(modulesDir, { withFileTypes: true });
      const modules = entries.filter(e => e.isDirectory()).map(e => e.name);
      
      console.log(`Found ${modules.length} modules\n`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const moduleName of modules) {
        const modulePath = path.join(modulesDir, moduleName);
        
        try {
          // 检查是否有 module.json
          const manifestPath = path.join(modulePath, 'module.json');
          await fs.access(manifestPath);
          
          console.log(`Signing ${moduleName}...`);
          await signer.signModule(modulePath);
          console.log(`  ✓ ${moduleName} signed`);
          successCount++;
        } catch (err) {
          console.log(`  ✗ ${moduleName} failed: ${err}`);
          failCount++;
        }
      }
      
      console.log(`\nSummary:`);
      console.log(`  Success: ${successCount}`);
      console.log(`  Failed: ${failCount}`);
      
      if (failCount > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error('✗ Batch signing failed:', err);
      process.exit(1);
    }
  });

program.parse();
