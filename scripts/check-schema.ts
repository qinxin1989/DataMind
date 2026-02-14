
import { pool } from '../src/admin/core/database';
import { v4 as uuidv4 } from 'uuid';

async function check() {
    console.log('Using app pool...');

    try {
        console.log('--- Tables ---');
        const [tables] = await pool.execute("SHOW TABLES");
        console.log(tables);

        console.log('\n--- Datasources Columns ---');
        const [dsColumns] = await pool.execute("SHOW COLUMNS FROM datasources");
        (dsColumns as any[]).forEach(c => console.log(` - ${c.Field} (${c.Type})`));

        console.log('\n--- Datasource Stats ---');
        const [statsTable] = await pool.execute("SHOW TABLES LIKE 'datasource_stats'");
        console.log('Table exists:', (statsTable as any[]).length > 0);

        if ((statsTable as any[]).length > 0) {
            const [statsColumns] = await pool.execute("SHOW COLUMNS FROM datasource_stats");
            (statsColumns as any[]).forEach(c => console.log(` - ${c.Field} (${c.Type})`));
        } else {
            console.log('CRITICAL: datasource_stats table missing!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

check();
