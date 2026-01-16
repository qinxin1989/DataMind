/**
 * 数据质量检测官 - 专业数据质量监测智能体
 * 
 * 覆盖6大核心维度：准确性、完整性、一致性、时效性、唯一性、有效性
 * 支持字段级、记录级、表级指标监测
 * 兼容文件数据源（CSV/Excel）和数据库数据源
 */
import OpenAI from 'openai';
import { BaseDataSource } from '../datasource';
import { TableSchema } from '../types';

export type QualityDimension = 'accuracy' | 'completeness' | 'consistency' | 'timeliness' | 'uniqueness' | 'validity';

export interface QualityCheckResult {
  field: string;
  fieldCn: string;
  dimension: QualityDimension;
  checkType: string;
  status: 'pass' | 'warning' | 'fail';
  score: number;
  message: string;
  details?: any;
  suggestion?: string;
}

export interface DimensionSummary {
  dimension: QualityDimension;
  dimensionCn: string;
  score: number;
  status: 'pass' | 'warning' | 'fail';
  checkCount: number;
  passCount: number;
  issues: string[];
}

export interface QualityReport {
  tableName: string;
  tableNameCn: string;
  totalRecords: number;
  overallScore: number;
  overallStatus: 'excellent' | 'good' | 'warning' | 'poor';
  overallGrade: string;
  summary: string;
  dimensions: DimensionSummary[];
  checks: QualityCheckResult[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  generatedAt: string;
}

const DIMENSION_CN: Record<QualityDimension, string> = {
  accuracy: '准确性',
  completeness: '完整性',
  consistency: '一致性',
  timeliness: '时效性',
  uniqueness: '唯一性',
  validity: '有效性'
};

export class QualityInspector {
  private openai: OpenAI;
  private model: string;

  constructor(openai: OpenAI, model: string) {
    this.openai = openai;
    this.model = model;
  }

  // 获取表的所有数据（兼容文件和数据库）
  private async getAllData(dataSource: BaseDataSource, tableName: string): Promise<any[]> {
    const result = await dataSource.executeQuery(`SELECT * FROM ${tableName}`);
    return result.data || [];
  }

  async inspect(dataSource: BaseDataSource, dbType: string, tableNameCn?: string): Promise<QualityReport[]> {
    const schemas = await dataSource.getSchema();
    const reports: QualityReport[] = [];
    for (const schema of schemas) {
      const report = await this.inspectTable(dataSource, schema, dbType, tableNameCn);
      reports.push(report);
    }
    return reports;
  }


  private async inspectTable(dataSource: BaseDataSource, schema: TableSchema, dbType: string, tableNameCn?: string): Promise<QualityReport> {
    const checks: QualityCheckResult[] = [];
    
    // 获取全部数据（直接操作内存数据，兼容文件数据源）
    const allData = await this.getAllData(dataSource, schema.tableName);
    const totalRecords = allData.length;
    
    // 获取实际数据中的字段名（从第一行数据）
    const actualFields = allData.length > 0 ? Object.keys(allData[0]) : [];
    
    console.log(`Quality inspection for ${schema.tableName}: ${totalRecords} records`);
    console.log(`Schema fields: ${schema.columns.map(c => c.name).join(', ')}`);
    console.log(`Actual data fields: ${actualFields.join(', ')}`);
    if (allData.length > 0) {
      console.log(`Sample row:`, JSON.stringify(allData[0]).substring(0, 500));
    }

    // 使用实际数据中的字段名进行检测
    const fieldsToCheck = actualFields.length > 0 ? actualFields : schema.columns.map(c => c.name);

    // 对每个字段进行检测
    for (const fieldName of fieldsToCheck) {
      const col = schema.columns.find(c => c.name === fieldName) || { name: fieldName, type: 'string', isPrimaryKey: false };
      
      // 完整性检测
      checks.push(this.checkCompleteness(allData, fieldName, totalRecords));
      
      // 唯一性检测（ID类字段）
      if (this.isLikelyIdField(fieldName) || (col as any).isPrimaryKey) {
        checks.push(this.checkUniqueness(allData, fieldName, totalRecords));
      }

      // 有效性检测
      const validityChecks = this.checkValidity(allData, col);
      checks.push(...validityChecks);

      // 准确性检测
      const accuracyCheck = this.checkAccuracy(allData, col);
      if (accuracyCheck) checks.push(accuracyCheck);
    }

    // 表级检测
    checks.push({
      field: '_table_', fieldCn: '表级', dimension: 'completeness',
      checkType: '数据量检测', 
      status: totalRecords > 0 ? 'pass' : 'fail',
      score: totalRecords > 0 ? 100 : 0,
      message: `共 ${totalRecords.toLocaleString()} 条记录`,
      details: { totalRecords },
      suggestion: totalRecords === 0 ? '表中无数据，请检查数据加载是否正常' : ''
    });

    // 计算各维度得分
    const dimensions = this.calculateDimensionScores(checks);
    const { score, status, grade, riskLevel } = this.calculateOverallScore(dimensions);
    const { summary, recommendations } = await this.generateSummary(schema.tableName, tableNameCn || schema.tableName, totalRecords, dimensions, checks, score);

    return {
      tableName: schema.tableName,
      tableNameCn: tableNameCn || schema.tableName,
      totalRecords,
      overallScore: score,
      overallStatus: status,
      overallGrade: grade,
      summary,
      dimensions,
      checks,
      recommendations,
      riskLevel,
      generatedAt: new Date().toISOString()
    };
  }

  // ==================== 完整性检测（直接操作数据）====================
  private checkCompleteness(data: any[], fieldName: string, totalRecords: number): QualityCheckResult {
    let nullCount = 0;
    for (const row of data) {
      const val = row[fieldName];
      if (val === null || val === undefined || val === '' || (typeof val === 'string' && val.trim() === '')) {
        nullCount++;
      }
    }
    
    const fillRate = totalRecords > 0 ? ((totalRecords - nullCount) / totalRecords * 100) : 0;
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let message = `填充率 ${fillRate.toFixed(1)}%`;
    let suggestion = '';

    if (fillRate < 50) {
      status = 'fail';
      message = `空值率过高 ${(100 - fillRate).toFixed(1)}%，共${nullCount}条空值`;
      suggestion = `建议补充缺失数据或确认该字段是否为必填项`;
    } else if (fillRate < 95) {
      status = 'warning';
      message = `存在${nullCount}条空值 (空值率${(100 - fillRate).toFixed(1)}%)`;
      suggestion = `建议检查空值原因，确保关键字段完整`;
    }

    return {
      field: fieldName, fieldCn: fieldName, dimension: 'completeness',
      checkType: '字段填充率', status, score: Math.round(fillRate), message,
      details: { nullCount, fillRate: fillRate.toFixed(2), totalRecords },
      suggestion
    };
  }

  // ==================== 唯一性检测 ====================
  private checkUniqueness(data: any[], fieldName: string, totalRecords: number): QualityCheckResult {
    const valueSet = new Set<string>();
    const duplicates = new Map<string, number>();
    
    for (const row of data) {
      const val = row[fieldName];
      if (val === null || val === undefined || val === '') continue;
      const strVal = String(val);
      if (valueSet.has(strVal)) {
        duplicates.set(strVal, (duplicates.get(strVal) || 1) + 1);
      } else {
        valueSet.add(strVal);
      }
    }
    
    const distinctCount = valueSet.size;
    const duplicateCount = data.length - distinctCount;
    const uniqueRate = totalRecords > 0 ? (distinctCount / totalRecords * 100) : 0;

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let message = `唯一率 ${uniqueRate.toFixed(1)}%，${distinctCount}个唯一值`;
    let suggestion = '';

    if (uniqueRate < 90 && duplicateCount > 0) {
      status = 'fail';
      message = `存在${duplicateCount}条重复值，${duplicates.size}组重复`;
      suggestion = `建议检查数据去重逻辑，确保主键/唯一键无重复`;
    } else if (duplicateCount > 0) {
      status = 'warning';
      message = `存在少量重复 (${duplicateCount}条)`;
      suggestion = `建议确认重复数据是否符合业务预期`;
    }

    return {
      field: fieldName, fieldCn: fieldName, dimension: 'uniqueness',
      checkType: '唯一性检测', status, score: Math.round(uniqueRate), message,
      details: { distinctCount, duplicateCount, duplicateGroups: duplicates.size },
      suggestion
    };
  }


  // ==================== 有效性检测 ====================
  private checkValidity(data: any[], col: { name: string; type: string }): QualityCheckResult[] {
    const checks: QualityCheckResult[] = [];
    const fieldName = col.name;
    const fieldType = col.type.toLowerCase();
    const lowerName = fieldName.toLowerCase();

    // 年龄字段
    if (lowerName.includes('age') || lowerName.includes('年龄')) {
      checks.push(this.checkAgeValidity(data, fieldName));
    }

    // 日期字段
    if (fieldType.includes('date') || fieldType.includes('time') || lowerName.includes('date') || lowerName.includes('日期')) {
      checks.push(this.checkDateValidity(data, fieldName));
    }

    // 性别字段
    if (lowerName.includes('sex') || lowerName.includes('gender') || lowerName.includes('性别')) {
      checks.push(this.checkEnumValidity(data, fieldName, ['男', '女', 'M', 'F', 'male', 'female', '1', '2', '0', '未知'], '性别'));
    }

    // 手机号
    if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('手机') || lowerName.includes('电话')) {
      checks.push(this.checkPhoneValidity(data, fieldName));
    }

    // 邮箱
    if (lowerName.includes('email') || lowerName.includes('邮箱')) {
      checks.push(this.checkEmailValidity(data, fieldName));
    }

    // 身份证号
    if (lowerName.includes('idcard') || lowerName.includes('身份证') || lowerName.includes('证件号')) {
      checks.push(this.checkIdCardValidity(data, fieldName));
    }

    // 金额字段
    if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('金额') || lowerName.includes('价格')) {
      checks.push(this.checkAmountValidity(data, fieldName));
    }

    return checks;
  }

  private checkAgeValidity(data: any[], fieldName: string): QualityCheckResult {
    const values = data.map(r => parseFloat(r[fieldName])).filter(v => !isNaN(v));
    if (values.length === 0) {
      return { field: fieldName, fieldCn: '年龄', dimension: 'validity', checkType: '值域范围检测', status: 'warning', score: 0, message: '无有效数值' };
    }
    
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
    const invalidCount = values.filter(v => v < 0 || v > 150).length;
    const validRate = ((values.length - invalidCount) / values.length * 100);

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let message = `范围 ${minVal}-${maxVal}岁，平均 ${avgVal.toFixed(1)}岁`;
    let suggestion = '';

    if (minVal < 0 || maxVal > 150) {
      status = invalidCount > values.length * 0.01 ? 'fail' : 'warning';
      message = `存在${invalidCount}条异常值 (${minVal < 0 ? `负数${minVal}` : ''}${maxVal > 150 ? `超大值${maxVal}` : ''})`;
      suggestion = `建议修正年龄字段的异常值，有效范围应为0-150`;
    }

    return {
      field: fieldName, fieldCn: '年龄', dimension: 'validity',
      checkType: '值域范围检测', status, score: Math.round(validRate), message,
      details: { min: minVal, max: maxVal, avg: avgVal.toFixed(1), invalidCount },
      suggestion
    };
  }

  private checkDateValidity(data: any[], fieldName: string): QualityCheckResult {
    const dates: Date[] = [];
    for (const row of data) {
      const val = row[fieldName];
      if (val) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) dates.push(d);
      }
    }
    
    if (dates.length === 0) {
      return { field: fieldName, fieldCn: '日期', dimension: 'validity', checkType: '日期有效性检测', status: 'warning', score: 0, message: '无有效日期' };
    }

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const now = new Date();
    
    console.log(`Date check for ${fieldName}: min=${minDate.toISOString()}, max=${maxDate.toISOString()}, now=${now.toISOString()}`);
    
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let score = 100;
    const minDateStr = minDate.toLocaleDateString('zh-CN');
    const maxDateStr = maxDate.toLocaleDateString('zh-CN');
    const nowStr = now.toLocaleDateString('zh-CN');
    let message = `日期范围 ${minDateStr} 至 ${maxDateStr}`;
    let suggestion = '';
    const issues: string[] = [];

    // 超过当前时间算未来日期
    if (maxDate.getTime() > now.getTime()) { 
      issues.push(`存在未来日期(${maxDateStr}，当前${nowStr})`); 
      score -= 20; 
    }
    // 1900年之前算异常早期日期
    if (minDate.getFullYear() < 1900) { 
      issues.push(`存在异常早期日期(${minDateStr})`); 
      score -= 10; 
    }
    
    if (issues.length > 0) {
      status = score < 80 ? 'fail' : 'warning';
      message = `${minDateStr} 至 ${maxDateStr}，${issues.join('，')}`;
      suggestion = `建议检查日期字段的有效性`;
    }

    return {
      field: fieldName, fieldCn: '日期', dimension: 'validity',
      checkType: '日期有效性检测', status, score: Math.max(0, score), message,
      details: { minDate: minDateStr, maxDate: maxDateStr, currentDate: nowStr },
      suggestion
    };
  }

  private checkEnumValidity(data: any[], fieldName: string, validValues: string[], fieldCn: string): QualityCheckResult {
    const valueCounts = new Map<string, number>();
    for (const row of data) {
      const val = row[fieldName];
      if (val !== null && val !== undefined && val !== '') {
        const strVal = String(val);
        valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);
      }
    }
    
    const values = Array.from(valueCounts.keys());
    const invalidValues = values.filter(v => !validValues.some(g => v.toLowerCase() === g.toLowerCase() || v.includes(g)));
    const validRate = values.length > 0 ? ((values.length - invalidValues.length) / values.length * 100) : 100;

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let message = `共${values.length}种取值，均为有效值`;
    let suggestion = '';

    if (invalidValues.length > 0) {
      status = invalidValues.length > values.length * 0.1 ? 'fail' : 'warning';
      message = `存在${invalidValues.length}种非标准值: ${invalidValues.slice(0, 3).join(', ')}`;
      suggestion = `建议统一${fieldCn}字段的枚举值`;
    }

    return {
      field: fieldName, fieldCn, dimension: 'validity',
      checkType: '枚举值检测', status, score: Math.round(validRate), message,
      details: { values: values.length, invalidValues: invalidValues.slice(0, 5) },
      suggestion
    };
  }


  private checkPhoneValidity(data: any[], fieldName: string): QualityCheckResult {
    const phoneRegex = /^1[3-9]\d{9}$/;
    let validCount = 0;
    let total = 0;

    for (const row of data) {
      const val = row[fieldName];
      if (val !== null && val !== undefined && val !== '') {
        total++;
        const cleaned = String(val).replace(/[-\s]/g, '');
        if (phoneRegex.test(cleaned)) validCount++;
      }
    }

    const validRate = total > 0 ? (validCount / total * 100) : 100;
    let status: 'pass' | 'warning' | 'fail' = validRate >= 95 ? 'pass' : validRate >= 80 ? 'warning' : 'fail';

    return {
      field: fieldName, fieldCn: '手机号', dimension: 'validity',
      checkType: '格式规范检测', status, score: Math.round(validRate),
      message: `格式正确率 ${validRate.toFixed(1)}%`,
      details: { validCount, total },
      suggestion: validRate < 95 ? '建议检查手机号格式，确保为11位有效号码' : ''
    };
  }

  private checkEmailValidity(data: any[], fieldName: string): QualityCheckResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let validCount = 0;
    let total = 0;

    for (const row of data) {
      const val = row[fieldName];
      if (val !== null && val !== undefined && val !== '') {
        total++;
        if (emailRegex.test(String(val))) validCount++;
      }
    }

    const validRate = total > 0 ? (validCount / total * 100) : 100;
    let status: 'pass' | 'warning' | 'fail' = validRate >= 95 ? 'pass' : validRate >= 80 ? 'warning' : 'fail';

    return {
      field: fieldName, fieldCn: '邮箱', dimension: 'validity',
      checkType: '格式规范检测', status, score: Math.round(validRate),
      message: `格式正确率 ${validRate.toFixed(1)}%`,
      details: { validCount, total },
      suggestion: validRate < 95 ? '建议检查邮箱格式的有效性' : ''
    };
  }

  private checkIdCardValidity(data: any[], fieldName: string): QualityCheckResult {
    let validCount = 0;
    let total = 0;

    for (const row of data) {
      const val = row[fieldName];
      if (val !== null && val !== undefined && val !== '') {
        total++;
        if (this.isValidIdCard(String(val))) validCount++;
      }
    }

    const validRate = total > 0 ? (validCount / total * 100) : 100;
    let status: 'pass' | 'warning' | 'fail' = validRate >= 95 ? 'pass' : validRate >= 80 ? 'warning' : 'fail';

    return {
      field: fieldName, fieldCn: '身份证号', dimension: 'validity',
      checkType: '格式规范检测', status, score: Math.round(validRate),
      message: `格式正确率 ${validRate.toFixed(1)}%`,
      details: { validCount, total },
      suggestion: validRate < 95 ? '建议检查身份证号格式，确保18位且校验码正确' : ''
    };
  }

  private checkAmountValidity(data: any[], fieldName: string): QualityCheckResult {
    const values = data.map(r => parseFloat(r[fieldName])).filter(v => !isNaN(v));
    if (values.length === 0) {
      return { field: fieldName, fieldCn: '金额', dimension: 'validity', checkType: '数值有效性检测', status: 'warning', score: 0, message: '无有效数值' };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
    const negativeCount = values.filter(v => v < 0).length;

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let score = 100;
    let message = `范围 ${minVal.toFixed(2)}-${maxVal.toFixed(2)}，平均 ${avgVal.toFixed(2)}`;
    let suggestion = '';

    if (negativeCount > 0) {
      status = 'warning';
      score = 80;
      message = `存在${negativeCount}条负数金额`;
      suggestion = '建议检查负数金额是否为退款等合理业务场景';
    }

    return {
      field: fieldName, fieldCn: '金额', dimension: 'validity',
      checkType: '数值有效性检测', status, score,
      message, details: { min: minVal, max: maxVal, avg: avgVal, negativeCount },
      suggestion
    };
  }

  private isValidIdCard(id: string): boolean {
    if (!id || !/^[1-9]\d{14}(\d{2}[0-9Xx])?$/.test(id)) return false;
    if (id.length === 18) {
      const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
      const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
      let sum = 0;
      for (let i = 0; i < 17; i++) sum += parseInt(id[i]) * weights[i];
      return id[17].toUpperCase() === checkCodes[sum % 11];
    }
    return true;
  }


  // ==================== 准确性检测 ====================
  private checkAccuracy(data: any[], col: { name: string; type: string }): QualityCheckResult | null {
    const fieldName = col.name;
    const lowerName = fieldName.toLowerCase();

    if (lowerName.includes('address') || lowerName.includes('地址')) {
      return this.checkAddressAccuracy(data, fieldName);
    }
    return null;
  }

  private checkAddressAccuracy(data: any[], fieldName: string): QualityCheckResult {
    const validProvinces = ['北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门'];
    
    let validCount = 0;
    let total = 0;
    
    for (const row of data.slice(0, 100)) {
      const addr = row[fieldName];
      if (addr && String(addr).trim()) {
        total++;
        if (validProvinces.some(p => String(addr).includes(p))) validCount++;
      }
    }
    
    const validRate = total > 0 ? (validCount / total * 100) : 100;
    let status: 'pass' | 'warning' | 'fail' = validRate >= 80 ? 'pass' : validRate >= 50 ? 'warning' : 'fail';

    return {
      field: fieldName, fieldCn: '地址', dimension: 'accuracy',
      checkType: '省市匹配检测', status, score: Math.round(validRate),
      message: `${validRate.toFixed(0)}%地址包含有效省市信息`,
      details: { validRate: validRate.toFixed(1), checked: total },
      suggestion: validRate < 80 ? '建议规范地址格式，确保包含省/市信息' : ''
    };
  }

  private isLikelyIdField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return lower.includes('id') || lower.includes('编号') || lower.includes('号码') || lower === 'no' || lower.endsWith('_no') || lower.endsWith('_id') || lower === 'pk';
  }

  // ==================== 评分计算 ====================
  private calculateDimensionScores(checks: QualityCheckResult[]): DimensionSummary[] {
    const dimensions: QualityDimension[] = ['accuracy', 'completeness', 'consistency', 'timeliness', 'uniqueness', 'validity'];
    const summaries: DimensionSummary[] = [];

    for (const dim of dimensions) {
      const dimChecks = checks.filter(c => c.dimension === dim);
      if (dimChecks.length === 0) continue;

      const totalScore = dimChecks.reduce((sum, c) => sum + c.score, 0);
      const avgScore = Math.round(totalScore / dimChecks.length);
      const passCount = dimChecks.filter(c => c.status === 'pass').length;
      const issues = dimChecks.filter(c => c.status !== 'pass').map(c => c.message);

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      if (avgScore < 60) status = 'fail';
      else if (avgScore < 80) status = 'warning';

      summaries.push({
        dimension: dim, dimensionCn: DIMENSION_CN[dim],
        score: avgScore, status, checkCount: dimChecks.length, passCount, issues
      });
    }
    return summaries;
  }

  private calculateOverallScore(dimensions: DimensionSummary[]): { score: number; status: 'excellent' | 'good' | 'warning' | 'poor'; grade: string; riskLevel: 'low' | 'medium' | 'high' | 'critical' } {
    if (dimensions.length === 0) return { score: 0, status: 'poor', grade: 'E', riskLevel: 'critical' };

    const weights: Record<QualityDimension, number> = {
      accuracy: 1.0, completeness: 1.2, consistency: 1.0, timeliness: 0.8, uniqueness: 1.1, validity: 1.2
    };

    let totalWeight = 0, weightedScore = 0;
    for (const dim of dimensions) {
      const w = weights[dim.dimension] || 1.0;
      weightedScore += dim.score * w;
      totalWeight += w;
    }

    const score = Math.round(weightedScore / totalWeight);
    let status: 'excellent' | 'good' | 'warning' | 'poor';
    let grade: string;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';

    if (score >= 90) { status = 'excellent'; grade = 'A'; riskLevel = 'low'; }
    else if (score >= 80) { status = 'good'; grade = 'B'; riskLevel = 'low'; }
    else if (score >= 70) { status = 'good'; grade = 'C'; riskLevel = 'medium'; }
    else if (score >= 60) { status = 'warning'; grade = 'D'; riskLevel = 'high'; }
    else { status = 'poor'; grade = 'E'; riskLevel = 'critical'; }

    return { score, status, grade, riskLevel };
  }


  // ==================== AI总结生成 ====================
  private async generateSummary(tableName: string, tableNameCn: string, totalRecords: number, dimensions: DimensionSummary[], checks: QualityCheckResult[], score: number): Promise<{ summary: string; recommendations: string[] }> {
    const failChecks = checks.filter(c => c.status === 'fail');
    const warnChecks = checks.filter(c => c.status === 'warning');
    
    const dimContext = dimensions.map(d => `${d.dimensionCn}: ${d.score}分`).join(', ');
    const issueContext = [...failChecks, ...warnChecks].slice(0, 8).map(c => `- ${c.fieldCn}: ${c.message}`).join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: `你是数据质量分析师。根据检测结果生成专业总结和建议。返回JSON：{"summary": "2-3句总结", "recommendations": ["建议1", "建议2", "建议3"]}` },
          { role: 'user', content: `表: ${tableNameCn}, 记录数: ${totalRecords}, 得分: ${score}/100\n维度: ${dimContext}\n问题:\n${issueContext || '无'}` }
        ],
        temperature: 0.3,
      });
      
      const content = response.choices[0].message.content || '{}';
      const result = JSON.parse(content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim());
      return { summary: result.summary || this.getDefaultSummary(score, failChecks.length, warnChecks.length), recommendations: result.recommendations || this.getDefaultRecommendations(failChecks, warnChecks) };
    } catch {
      return { summary: this.getDefaultSummary(score, failChecks.length, warnChecks.length), recommendations: this.getDefaultRecommendations(failChecks, warnChecks) };
    }
  }

  private getDefaultSummary(score: number, failCount: number, warnCount: number): string {
    if (score >= 90) return `数据质量优秀(${score}分)，各维度指标均达标，可放心用于业务分析。`;
    if (score >= 80) return `数据质量良好(${score}分)，存在${warnCount}个需关注的问题，建议优化后使用。`;
    if (score >= 60) return `数据质量一般(${score}分)，存在${failCount}个严重问题和${warnCount}个警告，需要进行数据治理。`;
    return `数据质量较差(${score}分)，存在${failCount}个严重问题，建议暂停使用并进行全面数据清洗。`;
  }

  private getDefaultRecommendations(failChecks: QualityCheckResult[], warnChecks: QualityCheckResult[]): string[] {
    const recs: string[] = [];
    for (const check of [...failChecks, ...warnChecks].slice(0, 3)) {
      if (check.suggestion) recs.push(check.suggestion);
      else recs.push(`检查并修复 ${check.fieldCn} 字段的${DIMENSION_CN[check.dimension]}问题`);
    }
    if (recs.length === 0) recs.push('继续保持当前的数据质量标准');
    return recs;
  }

  // ==================== 报告格式化 ====================
  formatReportAsMarkdown(reports: QualityReport[]): string {
    let md = '# 📊 数据质量检测报告\n\n';
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    for (const report of reports) {
      const statusEmoji = { excellent: '🟢', good: '🔵', warning: '🟡', poor: '🔴' }[report.overallStatus];
      const statusText = { excellent: '优秀', good: '良好', warning: '需关注', poor: '较差' }[report.overallStatus];
      const riskEmoji = { low: '✅', medium: '⚠️', high: '🔶', critical: '🔴' }[report.riskLevel];
      const riskText = { low: '低风险', medium: '中风险', high: '高风险', critical: '严重风险' }[report.riskLevel];

      md += `## ${report.tableNameCn}\n\n`;
      md += `| 指标 | 值 |\n|------|------|\n`;
      md += `| 总体评分 | ${statusEmoji} **${report.overallScore}分** (${report.overallGrade}级/${statusText}) |\n`;
      md += `| 风险等级 | ${riskEmoji} ${riskText} |\n`;
      md += `| 记录总数 | ${report.totalRecords.toLocaleString()}条 |\n`;
      md += `| 检测项数 | ${report.checks.length}项 |\n\n`;

      md += `### 📝 质量评估\n\n${report.summary}\n\n`;

      if (report.dimensions.length > 0) {
        md += '### 📈 各维度得分\n\n| 维度 | 得分 | 状态 | 检测项 | 通过数 |\n|------|------|------|--------|--------|\n';
        for (const dim of report.dimensions) {
          const icon = dim.status === 'pass' ? '✅' : dim.status === 'warning' ? '⚠️' : '❌';
          md += `| ${dim.dimensionCn} | ${dim.score}分 | ${icon} | ${dim.checkCount} | ${dim.passCount} |\n`;
        }
        md += '\n';
      }

      md += '### 🔍 检测详情\n\n| 字段 | 维度 | 检测项 | 状态 | 得分 | 说明 |\n|------|------|--------|------|------|------|\n';
      for (const check of report.checks) {
        const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
        md += `| ${check.fieldCn} | ${DIMENSION_CN[check.dimension]} | ${check.checkType} | ${icon} | ${check.score} | ${check.message} |\n`;
      }

      if (report.recommendations.length > 0) {
        md += '\n### 💡 改进建议\n\n';
        for (let i = 0; i < report.recommendations.length; i++) {
          md += `${i + 1}. ${report.recommendations[i]}\n`;
        }
      }

      const failChecks = report.checks.filter(c => c.status === 'fail');
      const warnChecks = report.checks.filter(c => c.status === 'warning');
      
      if (failChecks.length > 0 || warnChecks.length > 0) {
        md += '\n### ⚠️ 问题汇总\n\n';
        if (failChecks.length > 0) {
          md += `**严重问题 (${failChecks.length}项)**\n`;
          for (const c of failChecks.slice(0, 5)) md += `- ❌ ${c.fieldCn}: ${c.message}\n`;
        }
        if (warnChecks.length > 0) {
          md += `\n**警告 (${warnChecks.length}项)**\n`;
          for (const c of warnChecks.slice(0, 5)) md += `- ⚠️ ${c.fieldCn}: ${c.message}\n`;
        }
      }
      md += '\n---\n\n';
    }
    return md;
  }
}
