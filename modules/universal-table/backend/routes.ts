import express from 'express';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { UniversalTableService } from './service';

export function createUniversalTableRoutes(service: UniversalTableService): express.Router {
  const router = express.Router();
  const uploadDir = path.join(process.cwd(), 'uploads', 'universal-table', 'temp');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  const handle = (fn: (req: any, res: express.Response) => Promise<void>) => async (req: any, res: express.Response) => {
    try {
      await fn(req, res);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  router.get('/categories', handle(async (req, res) => {
    res.json({ success: true, data: await service.listCategories(req.user.id) });
  }));

  router.post('/categories', handle(async (req, res) => {
    await service.createCategory(req.user.id, req.body.name || '');
    res.json({ success: true, message: '分类已保存' });
  }));

  router.delete('/categories/:name', handle(async (req, res) => {
    await service.deleteCategory(req.user.id, decodeURIComponent(req.params.name));
    res.json({ success: true, message: '分类已删除' });
  }));

  router.get('/standard-tables', handle(async (req, res) => {
    res.json({ success: true, data: await service.listStandardTables(req.user.id) });
  }));

  router.post('/standard-tables', handle(async (req, res) => {
    res.json({ success: true, data: await service.saveStandardTable(req.user.id, req.body) });
  }));

  router.delete('/standard-tables/:id', handle(async (req, res) => {
    await service.deleteStandardTable(req.user.id, req.params.id);
    res.json({ success: true, message: '标准表已删除' });
  }));

  router.post('/standard-tables/import', upload.array('files', 50), handle(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const mode = req.body.mode === 'ai' ? 'ai' : 'rule';
    res.json({ success: true, data: await service.importStandardTableDrafts(req.user.id, files, mode) });
  }));

  router.get('/projects', handle(async (req, res) => {
    res.json({ success: true, data: await service.listProjects(req.user.id) });
  }));

  router.post('/projects', handle(async (req, res) => {
    res.json({ success: true, data: await service.createProject(req.user.id, req.body) });
  }));

  router.put('/projects/:id', handle(async (req, res) => {
    res.json({ success: true, data: await service.updateProject(req.user.id, req.params.id, req.body) });
  }));

  router.delete('/projects/:id', handle(async (req, res) => {
    await service.deleteProject(req.user.id, req.params.id);
    res.json({ success: true, message: '项目已删除' });
  }));

  router.get('/projects/:id/files', handle(async (req, res) => {
    res.json({ success: true, data: await service.listProjectFiles(req.user.id, req.params.id) });
  }));

  router.post('/projects/:id/files', upload.array('files', 100), handle(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    res.json({ success: true, data: await service.uploadProjectFiles(req.user.id, req.params.id, files) });
  }));

  router.post('/projects/:id/classify', handle(async (req, res) => {
    const mode = req.body.mode === 'ai' ? 'ai' : 'rule';
    res.json({ success: true, data: await service.classifyProjectFiles(req.user.id, req.params.id, mode) });
  }));

  router.post('/projects/:id/group-samples', handle(async (req, res) => {
    res.json({ success: true, data: await service.prepareGroupSamples(req.user.id, req.params.id) });
  }));

  router.put('/files/:id/assignment', handle(async (req, res) => {
    res.json({ success: true, data: await service.assignProjectFile(req.user.id, req.params.id, req.body.standardTableId || null) });
  }));

  router.post('/files/:id/mask', handle(async (req, res) => {
    const mode = req.body.mode === 'ai' ? 'ai' : 'rule';
    res.json({ success: true, data: await service.generateMaskedFile(req.user.id, req.params.id, mode) });
  }));

  router.post('/files/:id/test-data', handle(async (req, res) => {
    res.json({
      success: true,
      data: await service.generateTestData(req.user.id, req.params.id, {
        count: req.body.count ? Number(req.body.count) : undefined,
        mode: req.body.mode === 'ai' ? 'ai' : 'rule',
      }),
    });
  }));

  router.get('/files/:id/download/:kind', handle(async (req, res) => {
    const target = await service.getArtifactDownload(req.user.id, req.params.id, req.params.kind === 'test' ? 'test' : 'masked');
    res.download(target.filePath, target.fileName);
  }));

  router.get('/projects/:id/scripts', handle(async (req, res) => {
    res.json({ success: true, data: await service.listScripts(req.user.id, req.params.id) });
  }));

  router.get('/scripts/:id', handle(async (req, res) => {
    res.json({ success: true, data: await service.getScript(req.user.id, req.params.id) });
  }));

  router.post('/scripts/generate', handle(async (req, res) => {
    res.json({ success: true, data: await service.generateCollectionScript(req.user.id, req.body) });
  }));

  router.post('/scripts/:id/run', handle(async (req, res) => {
    res.json({ success: true, data: await service.runCollectionScript(req.user.id, req.params.id, req.body.fileIds) });
  }));

  router.get('/projects/:id/results', handle(async (req, res) => {
    res.json({ success: true, data: await service.listResults(req.user.id, req.params.id) });
  }));

  router.get('/projects/:id/datasets', handle(async (req, res) => {
    res.json({ success: true, data: await service.listAnalysisDatasets(req.user.id, req.params.id) });
  }));

  router.post('/results/:id/confirm-mapping', handle(async (req, res) => {
    res.json({ success: true, data: await service.confirmResultMapping(req.user.id, req.params.id, req.body.mapping || {}) });
  }));

  return router;
}
