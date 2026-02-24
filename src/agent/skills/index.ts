/**
 * Agent Skills - 技能系统入口
 * 统一导出所有技能和注册中心
 */

import { skillsRegistry, SkillsRegistry, SkillDefinition, SkillContext, SkillResult, SkillParameter, SkillCategory } from './registry';
import { dataSkills } from './data';
import { documentSkills } from './document';
import { mediaSkills } from './media';
import { reportSkills } from './report';
import { crawlerSkills } from './crawler';
import { qaSkills } from './qa';

// 从 ai-agent-plus 迁移的新技能
import { fileSkills } from './file';
import { shellSkills } from './shell';
import { webSkills } from './web';
import { imageOcrSkills } from './image_ocr';
import { architectureDiagramSkills } from './architecture_diagram';
import { pdfSkills } from './pdf';
import { docxSkills } from './docx';
import { pptxSkills } from './pptx';
import { canvasDesignSkills } from './canvas_design';
import { docCoauthoringSkills } from './doc_coauthoring';
import { dataAnalysisSkills } from './data_analysis';

// 注册所有技能
export function registerAllSkills() {
  console.log('[Skills] Registering all skills...');

  // 注册数据技能
  skillsRegistry.registerAll(dataSkills);
  console.log(`[Skills] Registered ${dataSkills.length} data skills`);

  // 注册文档技能
  skillsRegistry.registerAll(documentSkills);
  console.log(`[Skills] Registered ${documentSkills.length} document skills`);

  // 注册媒体技能
  skillsRegistry.registerAll(mediaSkills);
  console.log(`[Skills] Registered ${mediaSkills.length} media skills`);

  // 注册报告技能
  skillsRegistry.registerAll(reportSkills);
  console.log(`[Skills] Registered ${reportSkills.length} report skills`);

  // 注册问答技能
  skillsRegistry.registerAll(qaSkills);
  console.log(`[Skills] Registered ${qaSkills.length} qa skills`);

  // 注册爬虫技能 (使用已更新的本地实现)
  skillsRegistry.registerAll(crawlerSkills);
  console.log(`[Skills] Registered ${crawlerSkills.length} crawler skills`);

  // ========== 从 ai-agent-plus 迁移的新技能 ==========

  // 注册文件操作技能
  skillsRegistry.registerAll(fileSkills);
  console.log(`[Skills] Registered ${fileSkills.length} file skills`);

  // 注册 Shell 命令技能
  skillsRegistry.registerAll(shellSkills);
  console.log(`[Skills] Registered ${shellSkills.length} shell skills`);

  // 注册 Web/HTTP 技能
  skillsRegistry.registerAll(webSkills);
  console.log(`[Skills] Registered ${webSkills.length} web skills`);

  // 注册图片 OCR 技能
  skillsRegistry.registerAll(imageOcrSkills);
  console.log(`[Skills] Registered ${imageOcrSkills.length} image_ocr skills`);

  // 注册架构图生成技能
  skillsRegistry.registerAll(architectureDiagramSkills);
  console.log(`[Skills] Registered ${architectureDiagramSkills.length} architecture_diagram skills`);

  // 注册 PDF 操作技能
  skillsRegistry.registerAll(pdfSkills);
  console.log(`[Skills] Registered ${pdfSkills.length} pdf skills`);

  // 注册 Word 文档技能
  skillsRegistry.registerAll(docxSkills);
  console.log(`[Skills] Registered ${docxSkills.length} docx skills`);

  // 注册 PPTX 操作技能
  skillsRegistry.registerAll(pptxSkills);
  console.log(`[Skills] Registered ${pptxSkills.length} pptx skills`);

  // 注册 Canvas 设计技能
  skillsRegistry.registerAll(canvasDesignSkills);
  console.log(`[Skills] Registered ${canvasDesignSkills.length} canvas_design skills`);

  // 注册文档协作技能
  skillsRegistry.registerAll(docCoauthoringSkills);
  console.log(`[Skills] Registered ${docCoauthoringSkills.length} doc_coauthoring skills`);

  // 注册数据分析技能（Python 执行 + 可视化 + 统计）
  skillsRegistry.registerAll(dataAnalysisSkills);
  console.log(`[Skills] Registered ${dataAnalysisSkills.length} data_analysis skills`);

  console.log(`[Skills] Total skills registered: ${skillsRegistry.getAll().length}`);
}

// 初始化时注册所有技能
registerAllSkills();

// 导出
export {
  skillsRegistry,
  SkillsRegistry,
  SkillDefinition,
  SkillContext,
  SkillResult,
  SkillParameter,
  SkillCategory,
  dataSkills,
  documentSkills,
  mediaSkills,
  reportSkills,
  qaSkills,
  crawlerSkills,
  fileSkills,
  shellSkills,
  webSkills,
  imageOcrSkills,
  architectureDiagramSkills,
  pdfSkills,
  docxSkills,
  pptxSkills,
  canvasDesignSkills,
  docCoauthoringSkills,
  dataAnalysisSkills,
};

// 默认导出注册中心
export default skillsRegistry;
