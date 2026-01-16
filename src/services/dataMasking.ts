/**
 * 数据脱敏服务
 * 自动识别和脱敏敏感数据（身份证、手机号、姓名、地址等）
 */

// 敏感字段类型
type SensitiveType = 'idCard' | 'phone' | 'name' | 'address' | 'email' | 'bankCard' | 'password';

// 敏感字段识别规则
const SENSITIVE_FIELD_PATTERNS: Record<SensitiveType, RegExp[]> = {
  idCard: [/身份证/i, /idcard/i, /id_card/i, /证件号/i, /身份号/i],
  phone: [/手机/i, /电话/i, /phone/i, /mobile/i, /tel/i, /联系方式/i],
  // 姓名：只匹配明确的个人姓名字段，排除国家名、城市名等
  name: [/^姓名$/i, /^name$/i, /用户名/i, /username/i, /逝者姓名/i, /患者姓名/i, /客户姓名/i, /联系人/i, /收件人/i, /发件人/i, /亲属姓名/i],
  address: [/地址/i, /address/i, /住址/i, /户籍/i, /居住/i],
  email: [/邮箱/i, /email/i, /mail/i],
  bankCard: [/银行卡/i, /卡号/i, /bankcard/i, /bank_card/i, /账号/i],
  password: [/密码/i, /password/i, /pwd/i, /secret/i]
};

// 非敏感字段（排除列表）- 这些字段即使匹配到也不脱敏
const NON_SENSITIVE_PATTERNS: RegExp[] = [
  /country/i, /nation/i, /国家/i, /城市/i, /city/i, /province/i, /省份/i,
  /region/i, /区域/i, /continent/i, /洲/i, /capital/i, /首都/i,
  /product/i, /产品/i, /商品/i, /brand/i, /品牌/i, /company/i, /公司/i,
  /table/i, /column/i, /field/i, /表名/i, /字段/i
];

// 敏感数据值的正则匹配
const SENSITIVE_VALUE_PATTERNS: Record<SensitiveType, RegExp> = {
  idCard: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
  phone: /^1[3-9]\d{9}$/,
  name: /^[\u4e00-\u9fa5]{2,4}$/, // 2-4个中文字符
  address: /[\u4e00-\u9fa5]{5,}(省|市|区|县|镇|村|路|街|号|座|栋|单元|室)/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  bankCard: /^\d{16,19}$/,
  password: /.+/ // 密码字段全部脱敏
};

export class DataMaskingService {
  private enabledTypes: Set<SensitiveType>;
  
  constructor(enabledTypes?: SensitiveType[]) {
    // 默认启用所有类型
    this.enabledTypes = new Set(enabledTypes || ['idCard', 'phone', 'name', 'address', 'email', 'bankCard', 'password']);
  }

  /**
   * 判断字段名是否为敏感字段
   */
  isSensitiveField(fieldName: string): SensitiveType | null {
    const lowerName = fieldName.toLowerCase();
    
    // 先检查是否在非敏感字段排除列表中
    for (const pattern of NON_SENSITIVE_PATTERNS) {
      if (pattern.test(lowerName)) {
        return null; // 匹配到非敏感模式，直接返回null
      }
    }
    
    // 再检查是否匹配敏感字段模式
    for (const [type, patterns] of Object.entries(SENSITIVE_FIELD_PATTERNS)) {
      if (this.enabledTypes.has(type as SensitiveType)) {
        for (const pattern of patterns) {
          if (pattern.test(lowerName)) {
            return type as SensitiveType;
          }
        }
      }
    }
    return null;
  }

  /**
   * 判断值是否为敏感数据
   */
  isSensitiveValue(value: string): SensitiveType | null {
    if (!value || typeof value !== 'string') return null;
    
    const trimmedValue = value.trim();
    
    // 对于name类型，需要额外检查是否可能是国家名、城市名等非个人信息
    // 常见国家名列表（中英文）
    const nonPersonalNames = [
      // 英文国家名
      /^(china|russia|usa|japan|korea|india|brazil|germany|france|uk|canada|australia|mexico|italy|spain|netherlands|switzerland|sweden|norway|finland|denmark|poland|ukraine|turkey|egypt|south africa|nigeria|kenya|argentina|chile|peru|colombia|venezuela|thailand|vietnam|indonesia|malaysia|singapore|philippines|pakistan|bangladesh|iran|iraq|saudi arabia|israel|united states|united kingdom|new zealand)$/i,
      // 中文国家名
      /^(中国|俄罗斯|美国|日本|韩国|印度|巴西|德国|法国|英国|加拿大|澳大利亚|墨西哥|意大利|西班牙|荷兰|瑞士|瑞典|挪威|芬兰|丹麦|波兰|乌克兰|土耳其|埃及|南非|尼日利亚|肯尼亚|阿根廷|智利|秘鲁|哥伦比亚|委内瑞拉|泰国|越南|印度尼西亚|马来西亚|新加坡|菲律宾|巴基斯坦|孟加拉国|伊朗|伊拉克|沙特阿拉伯|以色列|朝鲜|蒙古|缅甸|老挝|柬埔寨|尼泊尔|斯里兰卡|阿富汗|哈萨克斯坦|乌兹别克斯坦|土库曼斯坦|塔吉克斯坦|吉尔吉斯斯坦|阿塞拜疆|格鲁吉亚|亚美尼亚|白俄罗斯|摩尔多瓦|立陶宛|拉脱维亚|爱沙尼亚|捷克|斯洛伐克|匈牙利|罗马尼亚|保加利亚|塞尔维亚|克罗地亚|斯洛文尼亚|波黑|黑山|北马其顿|阿尔巴尼亚|希腊|葡萄牙|比利时|卢森堡|奥地利|爱尔兰|冰岛)$/
    ];
    
    for (const [type, pattern] of Object.entries(SENSITIVE_VALUE_PATTERNS)) {
      if (this.enabledTypes.has(type as SensitiveType) && type !== 'password') {
        if (pattern.test(trimmedValue)) {
          // 对于name类型，检查是否是非个人名称
          if (type === 'name') {
            for (const nonPersonalPattern of nonPersonalNames) {
              if (nonPersonalPattern.test(trimmedValue)) {
                return null; // 是国家名等非个人信息，不脱敏
              }
            }
          }
          return type as SensitiveType;
        }
      }
    }
    return null;
  }

  /**
   * 脱敏单个值
   */
  maskValue(value: any, type: SensitiveType): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    
    switch (type) {
      case 'idCard':
        // 身份证：保留前3后4，中间用*
        if (str.length >= 15) {
          return str.slice(0, 3) + '*'.repeat(str.length - 7) + str.slice(-4);
        }
        return '***';
        
      case 'phone':
        // 手机号：保留前3后4
        if (str.length >= 11) {
          return str.slice(0, 3) + '****' + str.slice(-4);
        }
        return '***';
        
      case 'name':
        // 姓名：保留姓，名用*
        if (str.length >= 2) {
          return str[0] + '*'.repeat(str.length - 1);
        }
        return '*';
        
      case 'address':
        // 地址：保留省市，详细地址用*
        const match = str.match(/([\u4e00-\u9fa5]+省)?([\u4e00-\u9fa5]+市)?([\u4e00-\u9fa5]+区|[\u4e00-\u9fa5]+县)?/);
        if (match) {
          const prefix = (match[1] || '') + (match[2] || '') + (match[3] || '');
          if (prefix) {
            return prefix + '****';
          }
        }
        return str.slice(0, 4) + '****';
        
      case 'email':
        // 邮箱：保留前2和@后域名
        const atIndex = str.indexOf('@');
        if (atIndex > 2) {
          return str.slice(0, 2) + '***' + str.slice(atIndex);
        }
        return '***@***';
        
      case 'bankCard':
        // 银行卡：保留前4后4
        if (str.length >= 12) {
          return str.slice(0, 4) + '*'.repeat(str.length - 8) + str.slice(-4);
        }
        return '****';
        
      case 'password':
        return '******';
        
      default:
        return str;
    }
  }

  /**
   * 脱敏单条记录
   */
  maskRecord(record: Record<string, any>, fieldTypes?: Map<string, SensitiveType>): Record<string, any> {
    const masked: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(record)) {
      // 先检查字段名
      let sensitiveType = fieldTypes?.get(key) || this.isSensitiveField(key);
      
      // 对于name类型，需要进一步检查值是否真的是个人姓名
      if (sensitiveType === 'name' && typeof value === 'string') {
        // 检查值是否是非个人名称（国家名、城市名等）
        const valueSensitiveType = this.isSensitiveValue(value);
        if (valueSensitiveType !== 'name') {
          // 值不是个人姓名格式，不脱敏
          sensitiveType = null;
        }
      }
      
      // 如果字段名不敏感，检查值
      if (!sensitiveType && typeof value === 'string') {
        sensitiveType = this.isSensitiveValue(value);
      }
      
      if (sensitiveType) {
        masked[key] = this.maskValue(value, sensitiveType);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }

  /**
   * 脱敏数据数组
   */
  maskData(data: any[]): any[] {
    if (!data || data.length === 0) return data;
    
    // 预先分析字段类型（只分析一次）
    const fieldTypes = new Map<string, SensitiveType>();
    const firstRecord = data[0];
    
    for (const key of Object.keys(firstRecord)) {
      const type = this.isSensitiveField(key);
      if (type) {
        fieldTypes.set(key, type);
      }
    }
    
    // 脱敏所有记录
    return data.map(record => this.maskRecord(record, fieldTypes));
  }

  /**
   * 脱敏文本内容（用于 AI 回答）
   */
  maskText(text: string): string {
    let masked = text;
    
    // 脱敏身份证号
    masked = masked.replace(/[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, 
      (match) => match.slice(0, 3) + '*'.repeat(match.length - 7) + match.slice(-4));
    
    // 脱敏手机号
    masked = masked.replace(/1[3-9]\d{9}/g, 
      (match) => match.slice(0, 3) + '****' + match.slice(-4));
    
    // 脱敏邮箱
    masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      (match) => {
        const atIndex = match.indexOf('@');
        return match.slice(0, 2) + '***' + match.slice(atIndex);
      });
    
    return masked;
  }
}

// 导出单例
export const dataMasking = new DataMaskingService();
