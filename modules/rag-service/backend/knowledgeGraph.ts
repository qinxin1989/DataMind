/**
 * 知识图谱
 * 管理实体和关系，支持图谱查询
 */

import { v4 as uuidv4 } from 'uuid';

// 实体类型
export type EntityType = 
  | 'table'      // 数据表
  | 'column'     // 字段
  | 'concept'    // 概念
  | 'person'     // 人物
  | 'org'        // 组织
  | 'location'   // 地点
  | 'time'       // 时间
  | 'event'      // 事件
  | 'metric'     // 指标
  | 'custom';    // 自定义

// 关系类型
export type RelationType =
  | 'has_column'      // 表-字段
  | 'references'      // 外键引用
  | 'belongs_to'      // 属于
  | 'related_to'      // 相关
  | 'part_of'         // 部分
  | 'instance_of'     // 实例
  | 'synonym'         // 同义词
  | 'antonym'         // 反义词
  | 'causes'          // 导致
  | 'follows'         // 跟随
  | 'custom';         // 自定义

// 实体
export interface Entity {
  id: string;
  knowledgeBaseId: string;
  type: EntityType;
  name: string;
  nameCn?: string;           // 中文名
  description?: string;
  properties: Record<string, any>;
  sourceDocumentId?: string; // 来源文档
  createdAt: number;
}

// 关系
export interface Relation {
  id: string;
  knowledgeBaseId: string;
  type: RelationType;
  sourceId: string;          // 源实体ID
  targetId: string;          // 目标实体ID
  properties: Record<string, any>;
  weight: number;            // 关系权重 0-1
  sourceDocumentId?: string;
  createdAt: number;
}

// 图谱查询结果
export interface GraphQueryResult {
  entities: Entity[];
  relations: Relation[];
  paths?: Entity[][];        // 路径（如果查询路径）
}

export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private knowledgeBaseId: string;

  // 索引：按名称、类型快速查找
  private entityByName: Map<string, Set<string>> = new Map();
  private entityByType: Map<EntityType, Set<string>> = new Map();
  private relationsBySource: Map<string, Set<string>> = new Map();
  private relationsByTarget: Map<string, Set<string>> = new Map();

  constructor(knowledgeBaseId: string) {
    this.knowledgeBaseId = knowledgeBaseId;
  }

  // 添加实体
  addEntity(entity: Omit<Entity, 'id' | 'knowledgeBaseId' | 'createdAt'>): Entity {
    const newEntity: Entity = {
      ...entity,
      id: uuidv4(),
      knowledgeBaseId: this.knowledgeBaseId,
      createdAt: Date.now(),
    };

    this.entities.set(newEntity.id, newEntity);
    this.indexEntity(newEntity);
    return newEntity;
  }

  // 索引实体
  private indexEntity(entity: Entity): void {
    // 按名称索引
    const nameLower = entity.name.toLowerCase();
    if (!this.entityByName.has(nameLower)) {
      this.entityByName.set(nameLower, new Set());
    }
    this.entityByName.get(nameLower)!.add(entity.id);

    // 中文名索引
    if (entity.nameCn) {
      if (!this.entityByName.has(entity.nameCn)) {
        this.entityByName.set(entity.nameCn, new Set());
      }
      this.entityByName.get(entity.nameCn)!.add(entity.id);
    }

    // 按类型索引
    if (!this.entityByType.has(entity.type)) {
      this.entityByType.set(entity.type, new Set());
    }
    this.entityByType.get(entity.type)!.add(entity.id);
  }

  // 添加关系
  addRelation(relation: Omit<Relation, 'id' | 'knowledgeBaseId' | 'createdAt'>): Relation {
    // 验证实体存在
    if (!this.entities.has(relation.sourceId) || !this.entities.has(relation.targetId)) {
      throw new Error('源实体或目标实体不存在');
    }

    const newRelation: Relation = {
      ...relation,
      id: uuidv4(),
      knowledgeBaseId: this.knowledgeBaseId,
      createdAt: Date.now(),
    };

    this.relations.set(newRelation.id, newRelation);
    this.indexRelation(newRelation);
    return newRelation;
  }

  // 索引关系
  private indexRelation(relation: Relation): void {
    if (!this.relationsBySource.has(relation.sourceId)) {
      this.relationsBySource.set(relation.sourceId, new Set());
    }
    this.relationsBySource.get(relation.sourceId)!.add(relation.id);

    if (!this.relationsByTarget.has(relation.targetId)) {
      this.relationsByTarget.set(relation.targetId, new Set());
    }
    this.relationsByTarget.get(relation.targetId)!.add(relation.id);
  }

  // 获取实体
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  // 按名称查找实体
  findEntitiesByName(name: string): Entity[] {
    const ids = this.entityByName.get(name.toLowerCase()) || new Set();
    return Array.from(ids).map(id => this.entities.get(id)!).filter(Boolean);
  }

  // 按类型查找实体
  findEntitiesByType(type: EntityType): Entity[] {
    const ids = this.entityByType.get(type) || new Set();
    return Array.from(ids).map(id => this.entities.get(id)!).filter(Boolean);
  }

  // 获取实体的所有关系
  getEntityRelations(entityId: string): Relation[] {
    const outgoing = this.relationsBySource.get(entityId) || new Set();
    const incoming = this.relationsByTarget.get(entityId) || new Set();
    
    const relationIds = new Set([...outgoing, ...incoming]);
    return Array.from(relationIds).map(id => this.relations.get(id)!).filter(Boolean);
  }

  // 获取相邻实体
  getNeighbors(entityId: string, depth: number = 1): Entity[] {
    const visited = new Set<string>([entityId]);
    let currentLevel = [entityId];

    for (let d = 0; d < depth; d++) {
      const nextLevel: string[] = [];
      
      for (const id of currentLevel) {
        const relations = this.getEntityRelations(id);
        for (const rel of relations) {
          const neighborId = rel.sourceId === id ? rel.targetId : rel.sourceId;
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextLevel.push(neighborId);
          }
        }
      }
      
      currentLevel = nextLevel;
    }

    visited.delete(entityId);
    return Array.from(visited).map(id => this.entities.get(id)!).filter(Boolean);
  }

  // 查找两个实体之间的路径
  findPath(sourceId: string, targetId: string, maxDepth: number = 5): Entity[][] {
    if (!this.entities.has(sourceId) || !this.entities.has(targetId)) {
      return [];
    }

    const paths: Entity[][] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[]): void => {
      if (path.length > maxDepth) return;
      if (currentId === targetId) {
        paths.push(path.map(id => this.entities.get(id)!));
        return;
      }

      visited.add(currentId);
      const relations = this.getEntityRelations(currentId);

      for (const rel of relations) {
        const nextId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
        if (!visited.has(nextId)) {
          dfs(nextId, [...path, nextId]);
        }
      }

      visited.delete(currentId);
    };

    dfs(sourceId, [sourceId]);
    return paths;
  }

  // 子图查询：获取与关键词相关的子图
  querySubgraph(keywords: string[], maxEntities: number = 20): GraphQueryResult {
    const matchedEntities = new Set<string>();

    // 查找匹配的实体
    for (const keyword of keywords) {
      const entities = this.findEntitiesByName(keyword);
      for (const entity of entities) {
        matchedEntities.add(entity.id);
      }
    }

    // 扩展到相邻实体
    const expandedEntities = new Set<string>(matchedEntities);
    for (const entityId of matchedEntities) {
      if (expandedEntities.size >= maxEntities) break;
      
      const neighbors = this.getNeighbors(entityId, 1);
      for (const neighbor of neighbors) {
        if (expandedEntities.size >= maxEntities) break;
        expandedEntities.add(neighbor.id);
      }
    }

    // 收集相关关系
    const relatedRelations = new Set<string>();
    for (const entityId of expandedEntities) {
      const relations = this.getEntityRelations(entityId);
      for (const rel of relations) {
        if (expandedEntities.has(rel.sourceId) && expandedEntities.has(rel.targetId)) {
          relatedRelations.add(rel.id);
        }
      }
    }

    return {
      entities: Array.from(expandedEntities).map(id => this.entities.get(id)!),
      relations: Array.from(relatedRelations).map(id => this.relations.get(id)!),
    };
  }

  // 从数据源Schema构建图谱
  buildFromSchema(schema: any[], datasourceId: string): void {
    for (const table of schema) {
      // 添加表实体
      const tableEntity = this.addEntity({
        type: 'table',
        name: table.tableName,
        nameCn: table.tableNameCn,
        description: table.description,
        properties: { datasourceId },
        sourceDocumentId: datasourceId,
      });

      // 添加字段实体和关系
      for (const column of table.columns || []) {
        const columnEntity = this.addEntity({
          type: 'column',
          name: column.name,
          nameCn: column.nameCn,
          description: column.description,
          properties: {
            dataType: column.type,
            isPrimaryKey: column.isPrimaryKey,
            isForeignKey: column.isForeignKey,
          },
          sourceDocumentId: datasourceId,
        });

        // 表-字段关系
        this.addRelation({
          type: 'has_column',
          sourceId: tableEntity.id,
          targetId: columnEntity.id,
          properties: {},
          weight: 1.0,
          sourceDocumentId: datasourceId,
        });
      }
    }
  }

  // 获取统计信息
  getStats(): { entities: number; relations: number; entityTypes: Record<string, number> } {
    const entityTypes: Record<string, number> = {};
    for (const [type, ids] of this.entityByType) {
      entityTypes[type] = ids.size;
    }

    return {
      entities: this.entities.size,
      relations: this.relations.size,
      entityTypes,
    };
  }

  // 导出图谱数据
  export(): { entities: Entity[]; relations: Relation[] } {
    return {
      entities: Array.from(this.entities.values()),
      relations: Array.from(this.relations.values()),
    };
  }

  // 导入图谱数据
  import(data: { entities: Entity[]; relations: Relation[] }): void {
    this.entities.clear();
    this.relations.clear();
    this.entityByName.clear();
    this.entityByType.clear();
    this.relationsBySource.clear();
    this.relationsByTarget.clear();

    for (const entity of data.entities) {
      this.entities.set(entity.id, entity);
      this.indexEntity(entity);
    }

    for (const relation of data.relations) {
      this.relations.set(relation.id, relation);
      this.indexRelation(relation);
    }
  }
}
