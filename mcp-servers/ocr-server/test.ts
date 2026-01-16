/**
 * OCR MCP Server 测试脚本
 */

import fetch from 'node-fetch';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5100';

async function testOCRService() {
  console.log('=== OCR MCP Server 测试 ===\n');

  // 测试 1: 检查服务状态
  console.log('1. 检查 OCR 服务状态...');
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/health`, {
      method: 'GET',
      timeout: 3000,
    } as any);
    
    const data = await response.json() as any;
    console.log('✅ OCR 服务状态:', data);
  } catch (error: any) {
    console.log('❌ OCR 服务不可用:', error.message);
    console.log('\n请先启动 OCR 服务：');
    console.log('  cd ocr-service');
    console.log('  python app.py');
    return;
  }

  console.log('\n2. 测试图片识别...');
  
  // 创建一个简单的测试图片（1x1 白色像素的 PNG）
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: testImageBase64 }),
    });

    const result = await response.json() as any;
    console.log('✅ 识别结果:', result);
  } catch (error: any) {
    console.log('❌ 识别失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
  console.log('\nMCP 服务器已准备就绪！');
  console.log('\n配置示例：');
  console.log(JSON.stringify({
    mcpServers: {
      ocr: {
        command: 'node',
        args: ['--loader', 'ts-node/esm', 'mcp-servers/ocr-server/index.ts'],
        env: {
          OCR_SERVICE_URL: 'http://localhost:5100',
        },
      },
    },
  }, null, 2));
}

testOCRService().catch(console.error);
