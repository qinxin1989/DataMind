import request, { del, get, post, put } from '../../../../admin-ui/src/api/request';

const BASE_URL = '/modules/universal-table';

export interface StandardColumn {
  key: string;
  title: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  required?: boolean;
}

export interface StandardTable {
  id: string;
  name: string;
  category: string;
  columns: StandardColumn[];
  headerExamples: string[];
  source: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export interface ProjectFileRecord {
  id: string;
  projectId: string;
  originalName: string;
  fileExt: string;
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
  maskedPath?: string | null;
  testPath?: string | null;
  latestResultId?: string | null;
}

export interface CollectionScriptRecord {
  id: string;
  projectId: string;
  name: string;
  sampleSource: 'masked' | 'test' | 'original';
  sourceFormat?: string | null;
  scriptBody: string;
}

export interface CollectionResultRecord {
  id: string;
  fileId: string;
  scriptId: string;
  status: string;
  outputHeaders: string[];
  previewRows: Array<Record<string, any>>;
  mapping?: Record<string, string> | null;
  mappingStatus: string;
  manualConfirmationRequired: boolean;
  datasourceId?: string | null;
  analysisTableName?: string | null;
  ingestedRowCount?: number;
  errorMessage?: string | null;
}

export interface AnalysisDatasetRecord {
  id: string;
  projectId: string;
  standardTableId: string;
  standardTableName: string;
  analysisTableName: string;
  datasourceId: string;
  datasourceName: string;
  rowCount: number;
  updatedAt?: string;
}

export async function getCategories() {
  return get<string[]>(`${BASE_URL}/categories`);
}

export async function createCategory(name: string) {
  return post(`${BASE_URL}/categories`, { name });
}

export async function deleteCategory(name: string) {
  return del(`${BASE_URL}/categories/${encodeURIComponent(name)}`);
}

export async function getStandardTables() {
  return get<StandardTable[]>(`${BASE_URL}/standard-tables`);
}

export async function saveStandardTable(payload: Partial<StandardTable> & { name: string; columns: StandardColumn[] }) {
  return post<StandardTable>(`${BASE_URL}/standard-tables`, payload);
}

export async function deleteStandardTable(id: string) {
  return del(`${BASE_URL}/standard-tables/${id}`);
}

export async function importStandardTableDrafts(files: File[], mode: 'rule' | 'ai') {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('mode', mode);
  return request.post(`${BASE_URL}/standard-tables/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function getProjects() {
  return get<ProjectRecord[]>(`${BASE_URL}/projects`);
}

export async function createProject(payload: { name: string; description?: string }) {
  return post<ProjectRecord>(`${BASE_URL}/projects`, payload);
}

export async function updateProject(id: string, payload: Partial<ProjectRecord>) {
  return put<ProjectRecord>(`${BASE_URL}/projects/${id}`, payload);
}

export async function deleteProject(id: string) {
  return del(`${BASE_URL}/projects/${id}`);
}

export async function getProjectFiles(projectId: string) {
  return get<ProjectFileRecord[]>(`${BASE_URL}/projects/${projectId}/files`);
}

export async function uploadProjectFiles(projectId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return request.post(`${BASE_URL}/projects/${projectId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function classifyProjectFiles(projectId: string, mode: 'rule' | 'ai') {
  return post<ProjectFileRecord[]>(`${BASE_URL}/projects/${projectId}/classify`, { mode });
}

export async function prepareGroupSamples(projectId: string) {
  return post(`${BASE_URL}/projects/${projectId}/group-samples`);
}

export async function assignProjectFile(fileId: string, standardTableId: string | null) {
  return put<ProjectFileRecord>(`${BASE_URL}/files/${fileId}/assignment`, { standardTableId });
}

export async function maskFile(fileId: string, mode: 'rule' | 'ai') {
  return post<ProjectFileRecord>(`${BASE_URL}/files/${fileId}/mask`, { mode });
}

export async function generateTestData(fileId: string, mode: 'rule' | 'ai', count?: number) {
  return post<ProjectFileRecord>(`${BASE_URL}/files/${fileId}/test-data`, { mode, count });
}

export function getArtifactDownloadUrl(fileId: string, kind: 'masked' | 'test') {
  return `/api${BASE_URL}/files/${fileId}/download/${kind}`;
}

export async function downloadArtifact(fileId: string, kind: 'masked' | 'test') {
  return request.get(`${BASE_URL}/files/${fileId}/download/${kind}`, {
    responseType: 'blob',
  });
}

export async function getScripts(projectId: string) {
  return get<CollectionScriptRecord[]>(`${BASE_URL}/projects/${projectId}/scripts`);
}

export async function getScript(scriptId: string) {
  return get<CollectionScriptRecord>(`${BASE_URL}/scripts/${scriptId}`);
}

export async function generateScript(payload: {
  projectId: string;
  standardTableId?: string;
  sampleFileId: string;
  sampleSource: 'masked' | 'test' | 'original';
  useAi?: boolean;
  name?: string;
}) {
  return post<CollectionScriptRecord>(`${BASE_URL}/scripts/generate`, payload);
}

export async function runScript(scriptId: string, fileIds?: string[]) {
  return post<CollectionResultRecord[]>(`${BASE_URL}/scripts/${scriptId}/run`, { fileIds });
}

export async function getResults(projectId: string) {
  return get<CollectionResultRecord[]>(`${BASE_URL}/projects/${projectId}/results`);
}

export async function getDatasets(projectId: string) {
  return get<AnalysisDatasetRecord[]>(`${BASE_URL}/projects/${projectId}/datasets`);
}

export async function confirmMapping(resultId: string, mapping: Record<string, string>) {
  return post<CollectionResultRecord>(`${BASE_URL}/results/${resultId}/confirm-mapping`, { mapping });
}
