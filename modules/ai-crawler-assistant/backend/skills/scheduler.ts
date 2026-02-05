import { pool } from '../../../admin/core/database';
import { crawlerService } from './service';
import { crawlerSkills } from './index';
import { SkillContext } from '../registry';

export class CrawlerScheduler {
    private interval: NodeJS.Timeout | null = null;
    private isProcessing = false;

    start() {
        if (this.interval) return;
        console.log('[CrawlerScheduler] Started');
        // 每分钟检查一次
        this.interval = setInterval(() => this.checkTasks(), 60000);
        // 立即检查一次
        this.checkTasks();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private async checkTasks() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const [tasks]: any = await pool.execute(
                "SELECT * FROM crawler_tasks WHERE status = 'active' AND (next_run_at <= NOW() OR next_run_at IS NULL)"
            );

            for (const task of tasks) {
                await this.runTask(task);
            }
        } catch (error) {
            console.error('[CrawlerScheduler] Error checking tasks:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    private async runTask(task: any) {
        console.log(`[CrawlerScheduler] Running task: ${task.name} (${task.id})`);

        try {
            const template = await crawlerService.getTemplate(task.template_id);
            if (!template) {
                console.warn(`[CrawlerScheduler] Template not found for task ${task.id}`);
                return;
            }

            // 构造执行参数
            const params = {
                url: template.url,
                description: `Scheduled run for template: ${template.name}`,
                templateId: template.id // 告诉技能使用已有模板
            };

            // 构造上下文 (需要确保能获取 AI 配置)
            // 注意：定时任务执行时可能没有实时的 req 上下文，这里需要使用系统默认的 AI 配置
            const context: SkillContext = {
                userId: task.user_id,
                openai: null, // 稍后在 execute 中动态获取
                model: 'gpt-4o'
            };

            const skill = crawlerSkills.find(s => s.name === 'crawler.extract');
            if (skill) {
                const result = await skill.execute(params, context);
                console.log(`[CrawlerScheduler] Task ${task.id} result: ${result.success ? 'Success' : 'Failed'}`);
            }

            // 更新下次执行时间
            const nextRun = this.calculateNextRun(task.frequency);
            await pool.execute(
                'UPDATE crawler_tasks SET next_run_at = ?, updated_at = NOW() WHERE id = ?',
                [nextRun, task.id]
            );

        } catch (error) {
            console.error(`[CrawlerScheduler] Error running task ${task.id}:`, error);
        }
    }

    private calculateNextRun(frequency: string): Date {
        const now = new Date();
        switch (frequency) {
            case 'minutely':
                return new Date(now.getTime() + 60000);
            case 'hourly':
                return new Date(now.getTime() + 3600 * 1000);
            case 'daily':
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow;
            default:
                // 默认每天
                const day = new Date(now);
                day.setDate(day.getDate() + 1);
                return day;
        }
    }
}

export const crawlerScheduler = new CrawlerScheduler();
