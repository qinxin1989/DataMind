
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function fix() {
    console.log('Connecting to DB to fix bad JSON...');

    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
        port: Number(process.env.CONFIG_DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        // Fix 1: knowledge_documents metadata
        console.log('Checking knowledge_documents...');
        const [docs] = await pool.execute(
            `SELECT id, metadata FROM knowledge_documents WHERE metadata LIKE '%[object Object]%'`
        );
        const docCount = (docs as any[]).length;
        console.log(`Found ${docCount} documents with bad metadata.`);

        if (docCount > 0) {
            console.log('Sample bad metadata:', (docs as any[])[0].metadata);
            await pool.execute(
                `UPDATE knowledge_documents SET metadata = '{}' WHERE metadata LIKE '%[object Object]%'`
            );
            console.log('Fixed documents.');
        }

        // Fix 2: knowledge_chunks embedding
        console.log('Checking knowledge_chunks embeddings...');
        const [chunksEmb] = await pool.execute(
            `SELECT id FROM knowledge_chunks WHERE embedding LIKE '%[object Object]%' OR embedding = ''`
        );
        const chunkEmbCount = (chunksEmb as any[]).length;
        console.log(`Found ${chunkEmbCount} chunks with bad embedding.`);

        if (chunkEmbCount > 0) {
            await pool.execute(
                `UPDATE knowledge_chunks SET embedding = '[]' WHERE embedding LIKE '%[object Object]%' OR embedding = ''`
            );
            console.log('Fixed chunk embeddings.');
        }

        // Fix 3: knowledge_chunks metadata
        console.log('Checking knowledge_chunks metadata...');
        const [chunksMeta] = await pool.execute(
            `SELECT id FROM knowledge_chunks WHERE metadata LIKE '%[object Object]%'`
        );
        const chunkMetaCount = (chunksMeta as any[]).length;
        console.log(`Found ${chunkMetaCount} chunks with bad metadata.`);

        if (chunkMetaCount > 0) {
            await pool.execute(
                `UPDATE knowledge_chunks SET metadata = '{}' WHERE metadata LIKE '%[object Object]%'`
            );
            console.log('Fixed chunk metadata.');
        }

        console.log('Done!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

fix();
