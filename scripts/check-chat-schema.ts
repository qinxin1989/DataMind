
import { pool } from '../src/admin/core/database';

async function check() {
    console.log('Using app pool...');

    try {
        console.log('\n--- Chat History Columns ---');
        const [chatTable] = await pool.execute("SHOW TABLES LIKE 'chat_history'");
        if ((chatTable as any[]).length > 0) {
            const [chatColumns] = await pool.execute("SHOW COLUMNS FROM chat_history");
            (chatColumns as any[]).forEach(c => console.log(` - ${c.Field} (${c.Type})`));
        } else {
            console.log('chat_history table missing!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

check();
