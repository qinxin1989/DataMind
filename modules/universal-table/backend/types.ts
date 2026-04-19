import type { RowDataPacket } from 'mysql2/promise';

export type UniversalTableDb = {
  execute: (sql: string, params?: any[]) => Promise<[RowDataPacket[], any]>;
  query?: (sql: string, params?: any[]) => Promise<[RowDataPacket[], any]>;
  getConnection?: () => Promise<any>;
};

export type StandardColumn = {
  key: string;
  title: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  required?: boolean;
  aliases?: string[];
};

export type StandardTableRecord = {
  id: string;
  userId: string;
  name: string;
  category: string;
  columns: StandardColumn[];
  headerExamples: string[];
  source: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardCategoryRecord = {
  id: string;
  userId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectFileRecord = {
  id: string;
  projectId: string;
  userId: string;
  originalName: string;
  fileExt: string;
  mimeType?: string;
  fileSize: number;
  originalPath: string;
  maskedPath?: string | null;
  testPath?: string | null;
  sampleText?: string | null;
  headers: string[];
  previewRows: Array<Record<string, any>>;
  totalRows: number;
  standardTableId?: string | null;
  standardTableName?: string | null;
  classificationConfidence: number;
  classificationStatus: string;
  maskStatus: string;
  testStatus: string;
  collectionStatus: string;
  latestMapping?: Record<string, string> | null;
  latestScriptId?: string | null;
  latestResultId?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CollectionScriptRecord = {
  id: string;
  projectId: string;
  userId: string;
  standardTableId?: string | null;
  sampleFileId?: string | null;
  name: string;
  sampleSource: 'masked' | 'test' | 'original';
  sourceFormat?: string | null;
  scriptBody: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
};

export type CollectionResultRecord = {
  id: string;
  projectId: string;
  userId: string;
  fileId: string;
  scriptId: string;
  status: string;
  detectedHeaders: string[];
  outputHeaders: string[];
  previewRows: Array<Record<string, any>>;
  outputPath?: string | null;
  mapping?: Record<string, string> | null;
  mappingStatus: 'auto' | 'needs_confirm' | 'confirmed' | 'failed';
  manualConfirmationRequired: boolean;
  datasourceId?: string | null;
  analysisTableName?: string | null;
  ingestedRowCount?: number;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AnalysisDatasetRecord = {
  id: string;
  projectId: string;
  userId: string;
  standardTableId: string;
  standardTableName: string;
  analysisTableName: string;
  datasourceId: string;
  datasourceName: string;
  lastResultId?: string | null;
  rowCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FileProfile = {
  originalName: string;
  fileExt: string;
  headers: string[];
  previewRows: Array<Record<string, any>>;
  totalRows: number;
  sampleText: string;
  sourceFormat: string;
};

export type FieldMappingSuggestion = {
  sourceHeader: string;
  standardField: string;
  confidence: number;
  reason: string;
  exact: boolean;
};

export type TableMatchResult = {
  standardTableId: string | null;
  standardTableName: string | null;
  confidence: number;
  coverage: number;
  mapping: FieldMappingSuggestion[];
  needsConfirm: boolean;
};
