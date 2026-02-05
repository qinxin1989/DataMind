"use strict";
/**
 * 文件工具路由
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileToolsRoutes = createFileToolsRoutes;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
function createFileToolsRoutes(service) {
    const router = express_1.default.Router();
    // 配置 multer
    const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'file-tools', 'temp');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => cb(null, `${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`)
    });
    const upload = (0, multer_1.default)({
        storage,
        limits: {
            fileSize: 100 * 1024 * 1024 // 100MB
        }
    });
    /**
     * POST /convert - 文件格式转换
     */
    router.post('/convert', upload.any(), async (req, res) => {
        try {
            const files = req.files;
            const sourceFormat = req.body.sourceFormat || req.body.from;
            const targetFormat = req.body.targetFormat || req.body.to;
            const userId = req.user?.id || 'anonymous';
            const request = {
                files,
                sourceFormat,
                targetFormat,
                options: req.body.options ? JSON.parse(req.body.options) : undefined
            };
            const result = await service.convertFiles(request, userId);
            res.json(result);
        }
        catch (error) {
            console.error('文件转换错误:', error);
            res.status(500).json({
                success: false,
                error: error.message || '文件转换失败'
            });
        }
    });
    /**
     * GET /download/:id/:filename - 文件下载
     */
    router.get('/download/:id/:filename?', async (req, res) => {
        try {
            const fileId = req.params.id;
            const rawFileName = req.params.filename || req.query.name || 'download.txt';
            const filePath = service.getFilePath(fileId);
            if (!service.fileExists(fileId)) {
                return res.status(404).json({
                    error: '文件已失效（下载链接仅限一次有效或已过期）'
                });
            }
            console.log(`[FileDownload] 触发下载: ${rawFileName}, ID: ${fileId}`);
            // 设置响应头
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            // RFC 6266 标准处理中文文件名
            const encodedName = encodeURIComponent(rawFileName)
                .replace(/['()]/g, escape)
                .replace(/\*/g, '%2A');
            res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
            // 流式传输
            res.download(filePath, rawFileName, (err) => {
                if (err) {
                    console.error('[FileDownload] 下载出错:', err);
                }
                // 下载完成后清理文件
                service.cleanupFile(filePath);
                console.log(`[FileDownload] 临时文件已清理: ${fileId}`);
            });
        }
        catch (error) {
            console.error('[FileDownload] 系统错误:', error);
            res.status(500).json({ error: '系统内部错误' });
        }
    });
    /**
     * GET /history - 获取转换历史
     */
    router.get('/history', async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: '未授权' });
            }
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 20;
            const status = req.query.status;
            const startDate = req.query.startDate ? parseInt(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? parseInt(req.query.endDate) : undefined;
            const result = await service.getHistory({
                userId,
                page,
                pageSize,
                status,
                startDate,
                endDate
            });
            res.json(result);
        }
        catch (error) {
            console.error('获取历史记录错误:', error);
            res.status(500).json({ error: error.message || '获取历史记录失败' });
        }
    });
    /**
     * DELETE /history/:id - 删除历史记录
     */
    router.delete('/history/:id', async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: '未授权' });
            }
            const id = req.params.id;
            await service.deleteHistory(id, userId);
            res.json({ success: true, message: '删除成功' });
        }
        catch (error) {
            console.error('删除历史记录错误:', error);
            res.status(500).json({ error: error.message || '删除失败' });
        }
    });
    /**
     * POST /cleanup - 清理过期文件（管理员）
     */
    router.post('/cleanup', async (req, res) => {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            if (!userId || userRole !== 'admin') {
                return res.status(403).json({ error: '权限不足' });
            }
            const cleanedCount = await service.cleanupExpiredFiles();
            res.json({
                success: true,
                message: `已清理 ${cleanedCount} 个过期文件`
            });
        }
        catch (error) {
            console.error('清理过期文件错误:', error);
            res.status(500).json({ error: error.message || '清理失败' });
        }
    });
    return router;
}
