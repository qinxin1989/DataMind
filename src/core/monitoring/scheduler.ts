/**
 * 性能监控定时任务调度器
 * 使用 node-cron 实现定时报告生成
 */

import * as cron from 'node-cron';
import { reportGenerator } from './ReportGenerator';

/**
 * 启动定时任务
 */
export function startScheduledTasks(): void {
  // 每天凌晨 1 点生成日报
  cron.schedule('0 1 * * *', async () => {
    try {
      console.log('Generating daily performance report...');
      await reportGenerator.generateDailyReport();
      console.log('Daily performance report generated successfully');
    } catch (error) {
      console.error('Failed to generate daily report:', error);
    }
  });

  // 每周一凌晨 2 点生成周报
  cron.schedule('0 2 * * 1', async () => {
    try {
      console.log('Generating weekly performance report...');
      await reportGenerator.generateWeeklyReport();
      console.log('Weekly performance report generated successfully');
    } catch (error) {
      console.error('Failed to generate weekly report:', error);
    }
  });

  console.log('Performance monitoring scheduled tasks started');
}
