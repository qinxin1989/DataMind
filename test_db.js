
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { sm4 } = require('sm-crypto');
require('dotenv').config();

const SM4_PREFIX = 'SM4:';

function getEncryptionKey() {
    const key = process.env.FILE_ENCRYPTION_KEY || 'default-key-change';
    return crypto.createHash('md5').update(key).digest('hex').substring(0, 32);
}

function decrypt(encryptedText) {
    if (!encryptedText) return '[EMPTY]';
    if (encryptedText.startsWith(SM4_PREFIX)) {
        try {
            const key = getEncryptionKey();
            const cipherText = encryptedText.substring(SM4_PREFIX.length);
            console.log(`Trying to decrypt: ${cipherText.substring(0, 10)}... with key: ${key.substring(0, 5)}...`);
            const decrypted = sm4.decrypt(cipherText, key);
            return decrypted || '[DECRYPT_RETURNED_EMPTY]';
        } catch (error) {
            return `[DECRYPT_FAILED: ${error.message}]`;
        }
    }
    return encryptedText;
}

async function run() {
    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
    });

    try {
        const [rows] = await pool.execute('SELECT id, name, api_key FROM sys_ai_configs');
        console.log('--- AI Configs ---');
        for (const row of rows) {
            console.log(`ID: ${row.id}`);
            console.log(`Name: ${row.name}`);
            console.log(`Encrypted Key: ${row.api_key}`);
            console.log(`Decrypted Result: ${decrypt(row.api_key)}`);
            console.log('-------------------');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
