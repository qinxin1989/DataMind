import { describe, expect, it } from 'vitest';
import { buildCollectionScript } from '../../../modules/universal-table/backend/scriptTemplate';
import { buildFieldMapping, findBestStandardTableMatch } from '../../../modules/universal-table/backend/matching';

describe('universal-table matching', () => {
  it('should map exact headers to standard fields', () => {
    const mapping = buildFieldMapping(
      ['姓名', '手机号', '身份证号'],
      [
        { key: 'name', title: '姓名' },
        { key: 'phone', title: '手机号' },
        { key: 'id_card', title: '身份证号' },
      ],
    );

    expect(mapping).toHaveLength(3);
    expect(mapping.every((item) => item.exact)).toBe(true);
  });

  it('should find the best matching standard table', () => {
    const result = findBestStandardTableMatch(
      ['客户姓名', '联系电话', '开户地址'],
      [
        {
          id: 'table-1',
          userId: 'u1',
          name: '客户台账',
          category: '综合资料',
          columns: [
            { key: 'name', title: '姓名', aliases: ['客户姓名'] },
            { key: 'phone', title: '联系电话', aliases: ['手机号'] },
            { key: 'address', title: '地址', aliases: ['开户地址'] },
          ],
          headerExamples: [],
          source: 'manual',
        },
        {
          id: 'table-2',
          userId: 'u1',
          name: '交易流水',
          category: '金融数据',
          columns: [
            { key: 'amount', title: '金额' },
            { key: 'date', title: '交易日期' },
          ],
          headerExamples: [],
          source: 'manual',
        },
      ],
      '客户基础信息',
    );

    expect(result.standardTableId).toBe('table-1');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should generate a python collection template', () => {
    const script = buildCollectionScript({
      projectName: '项目A',
      standardTableName: '客户台账',
      sampleFileName: 'sample.xlsx',
      sourceFormat: 'xlsx',
      standardFields: [
        { key: 'name', title: '姓名' },
        { key: 'phone', title: '手机号' },
      ],
      mapping: [
        {
          sourceHeader: '客户姓名',
          standardField: '姓名',
          confidence: 1,
          reason: 'exact',
          exact: true,
        },
      ],
      extractionHints: ['姓名', '手机号'],
    });

    expect(script).toContain('STANDARD_TABLE_NAME');
    expect(script).toContain('--input');
    expect(script).toContain('FIELD_MAPPING');
  });
});
