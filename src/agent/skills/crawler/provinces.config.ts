/**
 * 全国各省份爬虫配置
 * 统一管理国家和各省市自治区的政府网站爬虫配置
 */

export interface ProvinceConfig {
  /** 省份名称 */
  name: string;
  /** 省份代码 */
  code: string;
  /** 数据来源网址 */
  url: string;
  /** 部门/网站名称 */
  department: string;
  /** CSS选择器配置 */
  selectors: {
    /** 列表容器选择器 */
    container: string;
    /** 字段选择器映射 */
    fields: Record<string, string>;
  };
  /** 是否需要动态渲染 */
  needDynamic?: boolean;
  /** 等待选择器（可选） */
  waitSelector?: string;
  /** 是否需要设置 Cookies (可选) */
  cookies?: any[];
  /** 额外的 HTTP 标头 (可选) */
  headers?: Record<string, string>;
  /** 备注 */
  note?: string;
}

/** 全国省份爬虫配置 */
export const PROVINCE_CONFIGS: ProvinceConfig[] = [
  // ===== 国家级 =====
  {
    name: '国家数据局',
    code: 'nda',
    url: 'https://www.nda.gov.cn/sjj/zwgk/zcfb/list/index_pc_1.html',
    department: '国家数据局',
    selectors: {
      container: '.list ul li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': ''  // 留空，使用Python引擎的启发式日期提取
      }
    },
    note: '静态页面，日期使用启发式搜索'
  },

  // ===== 直辖市 =====
  {
    name: '北京',
    code: 'beijing',
    url: 'https://zwfwj.beijing.gov.cn/zwgk/2024zcwj/',
    department: '北京市人民政府',
    selectors: {
      container: '.public_list_team ul li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '天津',
    code: 'tianjin',
    url: 'https://data.tj.gov.cn/zwgk/zcwj/',
    department: '天津市数据局',
    selectors: {
      container: '.news-list-item',
      fields: {
        '标题': '.news-list-item--title',
        '链接': 'a::attr(href)',
        '发布日期': '.news-list-item--time'
      }
    }
  },
  {
    name: '上海',
    code: 'shanghai',
    url: 'https://sdb.sh.gov.cn/gzdt/index.html',
    department: '上海市大数据中心',
    selectors: {
      container: '.news-item',
      fields: {
        '标题': 'h3.news-title',
        '链接': 'a.news-content::attr(href)',
        '日期-日': '.date-day',
        '日期-月': '.date-month'
      }
    },
    needDynamic: true
  },
  {
    name: '重庆',
    code: 'chongqing',
    url: 'https://dsjj.cq.gov.cn/zwgk_533/zcwj/zcqtwj/',
    department: '重庆市大数据局',
    selectors: {
      container: '.tab-item li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },

  // ===== 省份 =====
  {
    name: '河北',
    code: 'hebei',
    url: 'https://szj.hebei.gov.cn/zwgk/002004/policyInter.html',
    department: '河北省数据局',
    selectors: {
      container: '#resultlist tr',
      fields: {
        '标题': 'td a',
        '链接': 'td a::attr(href)',
        '发布日期': 'td:nth-child(3) p'
      }
    },
    needDynamic: true
  },
  {
    name: '山西',
    code: 'shanxi',
    url: 'https://src.shanxi.gov.cn/zcwj/',
    department: '山西省数据局',
    selectors: {
      container: 'ul.zwgk-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.date'
      }
    }
  },
  {
    name: '内蒙古',
    code: 'neimenggu',
    url: 'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/',
    department: '内蒙古自治区政务服务与数据管理局',
    selectors: {
      container: '#table1 tbody tr',
      fields: {
        '标题': 'td:nth-child(2) a',
        '链接': 'td:nth-child(2) a::attr(href)',
        '发布日期': 'td:nth-child(5)'
      }
    }
  },
  {
    name: '辽宁',
    code: 'liaoning',
    url: 'https://dsj.ln.gov.cn/dsj/zwgk/zdgk/zcwj/index.shtml',
    department: '辽宁省数据局',
    selectors: {
      container: '.list ul li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '吉林',
    code: 'jilin',
    url: 'https://xxgk.jl.gov.cn/zsjg/fgw_136504/gkml/',
    department: '吉林省政务公开',
    selectors: {
      container: '#result-body table',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发文字号': '.zly_xxmu_20170104ulli3',
        '发布日期': '.zly_xxmu_20170104ulli4'
      }
    }
  },
  {
    name: '黑龙江',
    code: 'heilongjiang',
    url: 'https://www.hlj.gov.cn/hlj/c104373/common_list.shtml',
    department: '黑龙江省人民政府',
    selectors: {
      container: '.list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '江苏',
    code: 'jiangsu',
    url: 'https://jszwb.jiangsu.gov.cn/col/col81698/index.html?number=A00003',
    department: '江苏省数据局',
    selectors: {
      container: '.default_pgContainer li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '浙江',
    code: 'zhejiang',
    url: 'https://data.zj.gov.cn/art/2024/12/art_1229495857_58927188.html',
    department: '浙江省数据局',
    selectors: {
      container: '.article-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.time'
      }
    }
  },
  {
    name: '安徽',
    code: 'anhui',
    url: 'https://sjzyj.ah.gov.cn/xwdt/sjdt/index.html',
    department: '安徽省数据局',
    selectors: {
      container: 'ul.doc_list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.right.date'
      }
    }
  },
  {
    name: '福建',
    code: 'fujian',
    url: 'https://fgw.fujian.gov.cn/ztzl/szfjzt/zcwj/',
    department: '福建省发改委',
    selectors: {
      container: '.list_base li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '江西',
    code: 'jiangxi',
    url: 'https://drc.jiangxi.gov.cn/zwgk/zcwj/',
    department: '江西省数据局',
    selectors: {
      container: '.news-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.date'
      }
    }
  },
  {
    name: '山东',
    code: 'shandong',
    url: 'https://www.shandong.gov.cn/col/col99805/index.html',
    department: '山东省人民政府',
    selectors: {
      container: '.info-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '河南',
    code: 'henan',
    url: 'https://data.henan.gov.cn/zwgk/zcwj/',
    department: '河南省数据局',
    selectors: {
      container: '.policy-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.time'
      }
    }
  },
  {
    name: '湖北',
    code: 'hubei',
    url: 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/',
    department: '湖北省数据局',
    selectors: {
      container: 'ul li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    },
    needDynamic: true,
    cookies: [
      { name: 'enable_924omrTVcFch', value: 'true', domain: 'sjj.hubei.gov.cn', path: '/' },
      { name: '_trs_uv', value: 'ml0g10b1_6338_868a', domain: 'sjj.hubei.gov.cn', path: '/' },
      { name: 'dataHide2', value: '58b641eb-a7fb-4b2e-a151-42172a83b45c', domain: 'sjj.hubei.gov.cn', path: '/' },
      { name: '924omrTVcFchP', value: '0pnICUbXV01bF6Em7uWO1824SIfe1JqG6NFuTGjqDy5uke3b7AKWzBdFuqOFFBoBHSL3X0MCp8nyzAJgVP8mu72SMGIo2Efkzi.dFwRF0yNZYbALgeIxtyveIybVs32nq4_p.1N6e_wx1CzSAZ9fWEE1ZMexPryZuTs63J2Ebx77jejKsYvLtLroHrM1Wr6hGNGA1UJRY5hxsK4DAyawAmnywd_ZoQo4pTRkZJ8yBICSZ7t4aqDoyQnmuAGKvZtivp.fpZpgpshcCSQD5KkaIM0K5o3NX4pJ8tT9IFdlUz89nFKA3RDDYD4Nf4XbxX2VhE5aSUxtP.LKYOLEf5nEdPO9yCHeHOZqVl36DekGlSRL', domain: 'sjj.hubei.gov.cn', path: '/' }
    ],
    headers: {
      'Referer': 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/'
    },
    note: '需要Cookies支持，已集成验证Cookie'
  },
  {
    name: '湖南',
    code: 'hunan',
    url: 'https://www.hunan.gov.cn/topic/hnsz/szzcwj/szsjzc/index.html',
    department: '湖南省人民政府',
    selectors: {
      container: '.fg_cont_box li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': '.date span'
      }
    }
  },
  {
    name: '广东',
    code: 'guangdong',
    url: 'https://www.gd.gov.cn/zwgk/zcwj/',
    department: '广东省人民政府',
    selectors: {
      container: '.list-group li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '广西',
    code: 'guangxi',
    url: 'https://data.gxzf.gov.cn/zwgk/zcwj/',
    department: '广西壮族自治区大数据局',
    selectors: {
      container: '.doc-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.date'
      }
    }
  },
  {
    name: '海南',
    code: 'hainan',
    url: 'https://data.hainan.gov.cn/zwgk/zcwj/',
    department: '海南省大数据管理局',
    selectors: {
      container: '.news-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '四川',
    code: 'sichuan',
    url: 'https://www.scdsjzx.cn/scdsjzx/shengshiwenjian/2601shuzifagui.shtml',
    department: '四川省大数据中心',
    selectors: {
      container: '.list li',
      fields: {
        '标题': '.title',
        '链接': 'a::attr(href)',
        '发布日期': '.date'
      }
    },
    needDynamic: true,
    note: '仅主要抓取数字法规'
  },
  {
    name: '贵州',
    code: 'guizhou',
    url: 'https://dsj.guizhou.gov.cn/zwgk/zcwj/bmwj/',
    department: '贵州省大数据发展管理局',
    selectors: {
      container: '.NewsList li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '云南',
    code: 'yunnan',
    url: 'https://data.yn.gov.cn/zwgk/zcwj/',
    department: '云南省数据局',
    selectors: {
      container: '.doc-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.date'
      }
    }
  },
  {
    name: '西藏',
    code: 'xizang',
    url: 'https://data.xizang.gov.cn/zwgk/zcwj/',
    department: '西藏自治区大数据局',
    selectors: {
      container: '.list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '陕西',
    code: 'shaanxi',
    url: 'https://www.shaanxi.gov.cn/zcwj/',
    department: '陕西省人民政府',
    selectors: {
      container: '.list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.time'
      }
    }
  },
  {
    name: '甘肃',
    code: 'gansu',
    url: 'https://data.gansu.gov.cn/zwgk/zcwj/',
    department: '甘肃省大数据局',
    selectors: {
      container: '.policy-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '青海',
    code: 'qinghai',
    url: 'https://data.qinghai.gov.cn/zwgk/zcwj/',
    department: '青海省大数据局',
    selectors: {
      container: '.doc-list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span.date'
      }
    }
  },
  {
    name: '宁夏',
    code: 'ningxia',
    url: 'https://data.nx.gov.cn/zwgk/zcwj/',
    department: '宁夏回族自治区大数据局',
    selectors: {
      container: '.list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    }
  },
  {
    name: '新疆',
    code: 'xinjiang',
    url: 'https://sfj.xinjiang.gov.cn/xjszfzj/zcwjfb/zfxxgk_cwxx.shtml',
    department: '新疆维吾尔自治区司法厅',
    selectors: {
      container: '.list li',
      fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
      }
    },
    needDynamic: true
  }
];

/** 根据省份代码获取配置 */
export function getProvinceConfig(code: string): ProvinceConfig | undefined {
  return PROVINCE_CONFIGS.find(p => p.code === code);
}

/** 根据省份名称获取配置 */
export function getProvinceConfigByName(name: string): ProvinceConfig | undefined {
  return PROVINCE_CONFIGS.find(p => p.name === name);
}

/** 根据URL匹配省份配置 */
export function getProvinceConfigByUrl(url: string): ProvinceConfig | undefined {
  if (!url) return undefined;
  return PROVINCE_CONFIGS.find(p => url.includes(p.url.split('?')[0]));
}

/** 获取所有需要动态渲染的省份配置 */
export function getDynamicProvinces(): ProvinceConfig[] {
  return PROVINCE_CONFIGS.filter(p => p.needDynamic);
}
