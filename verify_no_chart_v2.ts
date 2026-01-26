
import { AIAgent } from './src/agent';
import { BaseDataSource } from './src/datasource';
import { TableSchema } from './src/types';

// Mock DataSource
class MockDataSource extends BaseDataSource {
    async connect(): Promise<void> { }
    async disconnect(): Promise<void> { }
    async executeQuery(sql: string): Promise<any> {
        console.log('Executing SQL:', sql);
        // 模拟返回数据
        return {
            success: true,
            data: [
                { code: 'A', value: 100 },
                { code: 'B', value: 200 },
                { code: 'C', value: 300 }
            ],
            rowCount: 3
        };
    }
    async testConnection(): Promise<boolean> {
        return true;
    }
    async getSchema(): Promise<TableSchema[]> {
        return [{
            tableName: 'mock_table',
            columns: [
                { name: 'code', type: 'VARCHAR', nullable: true }, // Added nullable
                { name: 'value', type: 'INT', nullable: true } // Added nullable
            ]
        }];
    }
}

async function runTest() {
    const agent = new AIAgent('fake-key', 'https://api.openai.com/v1');

    // Mock AutoAnalyst to rely on internal logic or just return empty chart
    // But here we want to test AIAgent's filtering logic.
    // Actually, we can just test AIAgent.answer

    const ds = new MockDataSource({ type: 'mysql', name: 'test' } as any); // Added cast for config

    console.log('--- Test 1: Normal Query with noChart=true ---');
    // Hack: mock generateSQL to prevent OpenAI call if possible, or just let it fail/mock.
    // Since we don't have real OpenAI key here, we might need to mock AIAgent methods.
    // But AIAgent is hard to mock without extending.

    // Let's modify AIAgent prototype slightly for testing if needed, 
    // or just rely on the fact that if it tries to call OpenAI without key it fails?
    // User environment likely has key in env vars?
    // The system prompt says "The user has 1 active workspaces...". code is in f:\...
    // I will assume I can run it if I use existing env.

    // Wait, I can just inspect the code logic path. 
    // But running it gives definitive proof.

    // Let's try to mock the internal methods that call AI.
    (agent as any)['generateSQLWithContext'] = async () => ({ sql: 'SELECT * FROM mock_table', chartType: 'bar' });
    (agent as any)['planAction'] = async () => ({ type: 'sql', name: 'query', params: {}, needChart: true, chartType: 'bar' });
    (agent as any)['explainResultWithContext'] = async () => 'Explanation';

    const res1 = await agent.answer('query data', ds, 'mysql', [], true);
    console.log('Result 1 chart:', res1.chart);

    if (res1.chart) {
        console.error('FAIL: Chart generated despite noChart=true');
    } else {
        console.log('PASS: No chart generated');
    }

    console.log('--- Test 2: Normal Query with noChart=false ---');
    const res2 = await agent.answer('query data', ds, 'mysql', [], false);
    console.log('Result 2 chart:', res2.chart ? 'Present' : 'Missing');

    if (!res2.chart) {
        console.error('FAIL: Chart NOT generated when noChart=false');
    } else {
        console.log('PASS: Chart generated');
    }

}

runTest().catch(console.error);
