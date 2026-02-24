/**
 * Declarative Skill Registry
 * 扫描 skills/ 目录下的 SKILL.md 文件，解析 frontmatter 并注册为 SkillIndex
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter } from './frontmatter';
import { SkillIndex, ActionSpec } from './specs';

export class DeclarativeSkillRegistry {
  public readonly skillsRoot: string;
  private _skills: Map<string, SkillIndex> = new Map();

  constructor(skillsRoot: string) {
    this.skillsRoot = path.resolve(skillsRoot);
    this.reload();
  }

  /** 重新扫描并加载所有 SKILL.md */
  reload(): void {
    this._skills.clear();

    if (!fs.existsSync(this.skillsRoot) || !fs.statSync(this.skillsRoot).isDirectory()) {
      return;
    }

    for (const entry of fs.readdirSync(this.skillsRoot)) {
      const skillDir = path.join(this.skillsRoot, entry);
      if (!fs.statSync(skillDir).isDirectory()) continue;

      const mdPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(mdPath)) continue;

      let raw: string;
      try {
        raw = fs.readFileSync(mdPath, 'utf-8');
      } catch {
        continue;
      }

      const { meta, body } = parseFrontmatter(raw);
      const name = String(meta.name || entry).trim();
      if (!name) continue;

      const description = String(meta.description || '').trim();
      const version = String(meta.version || '1.0.0').trim() || '1.0.0';
      const adapter = String(meta.adapter || 'auto_legacy').trim() || 'auto_legacy';

      const actions: ActionSpec[] = [];
      const actionsMeta = meta.actions;
      if (Array.isArray(actionsMeta)) {
        for (const a of actionsMeta) {
          if (typeof a === 'object' && a !== null) {
            const aName = String(a.name || '').trim();
            if (!aName) continue;
            const aDesc = String(a.description || '').trim();
            actions.push({ name: aName, description: aDesc });
          } else if (typeof a === 'string') {
            const aName = a.trim();
            if (aName) actions.push({ name: aName });
          }
        }
      }

      this._skills.set(name, {
        name,
        description,
        version,
        adapter,
        actions,
        body,
      });
    }
  }

  /** 获取所有已注册技能 */
  listSkills(): SkillIndex[] {
    return Array.from(this._skills.values());
  }

  /** 按名称获取技能 */
  getSkill(name: string): SkillIndex | undefined {
    return this._skills.get(name);
  }

  /** 读取技能的原始 SKILL.md 内容 */
  getSkillMarkdown(name: string): string | undefined {
    // 先尝试直接目录名
    const directPath = path.join(this.skillsRoot, name, 'SKILL.md');
    if (fs.existsSync(directPath)) {
      try { return fs.readFileSync(directPath, 'utf-8'); } catch { /* fallthrough */ }
    }

    // 遍历所有目录查找匹配 name
    for (const entry of fs.readdirSync(this.skillsRoot)) {
      const skillDir = path.join(this.skillsRoot, entry);
      if (!fs.statSync(skillDir).isDirectory()) continue;
      const mdPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(mdPath)) continue;

      try {
        const raw = fs.readFileSync(mdPath, 'utf-8');
        const { meta } = parseFrontmatter(raw);
        if (String(meta.name || '').trim() === name) return raw;
      } catch {
        continue;
      }
    }

    return undefined;
  }
}
