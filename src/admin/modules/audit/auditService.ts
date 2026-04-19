import { pool } from '../../core/database';
import { AuditLogService } from '../../../../modules/audit-log/backend/service';

function mapCompatLog(log: any) {
  let oldValue: string | undefined;
  let newValue: string | undefined;

  try {
    const details = log.details ? JSON.parse(log.details) : {};
    if (details.old !== undefined) {
      oldValue = JSON.stringify(details.old);
    }
    if (details.new !== undefined) {
      newValue = JSON.stringify(details.new);
    }
  } catch {
    // ignore invalid details payloads in compatibility layer
  }

  return {
    ...log,
    oldValue,
    newValue,
  };
}

export class AuditService {
  private service = new AuditLogService();

  async log(data: any): Promise<any> {
    await this.service.log(data);
    const result = await this.service.queryLogs({
      userId: data.userId,
      action: data.action,
      resourceType: data.resourceType,
      page: 1,
      pageSize: 1,
    });
    return result.items[0] ? mapCompatLog(result.items[0]) : null;
  }

  async query(params: any): Promise<{ list: any[]; total: number; page: number; pageSize: number }> {
    const result = await this.service.queryLogs({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      startDate: params.startTime,
      endDate: params.endTime,
      page: params.page,
      pageSize: params.pageSize,
    });

    return {
      list: result.items.map(mapCompatLog),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async export(params: any, format: 'json' | 'csv'): Promise<string> {
    return this.service.exportLogs({
      format,
      userId: params.userId,
      action: params.action,
      startDate: params.startTime,
      endDate: params.endTime,
    });
  }

  async logUpdate(
    userId: string,
    username: string,
    resourceType: string,
    resourceId: string,
    oldValue: any,
    newValue: any,
    ip: string,
    userAgent: string
  ): Promise<any> {
    return this.log({ userId, username, action: 'update', resourceType, resourceId, oldValue, newValue, ip, userAgent });
  }

  async logLogin(userId: string, username: string, ip: string, userAgent: string, success: boolean): Promise<any> {
    return this.log({
      userId,
      username,
      action: 'login',
      resourceType: 'session',
      resourceId: userId,
      newValue: { success },
      ip,
      userAgent,
      module: 'auth',
    });
  }

  async logCreate(userId: string, username: string, resourceType: string, resourceId: string, newValue: any, ip: string, userAgent: string): Promise<any> {
    return this.log({ userId, username, action: 'create', resourceType, resourceId, newValue, ip, userAgent });
  }

  async logDelete(userId: string, username: string, resourceType: string, resourceId: string, oldValue: any, ip: string, userAgent: string): Promise<any> {
    return this.log({ userId, username, action: 'delete', resourceType, resourceId, oldValue, ip, userAgent });
  }

  async getStats(startTime: number, endTime: number): Promise<any> {
    const stats = await this.service.getStats(startTime, endTime);
    return {
      totalLogs: stats.totalLogs,
      byAction: Object.fromEntries(stats.topActions.map(item => [item.action, item.count])),
      byUser: stats.topUsers,
    };
  }

  async getUserTrail(userId: string, startTime: number, endTime: number): Promise<any[]> {
    const result = await this.service.getUserTrail(userId, startTime, endTime);
    return result.items.map(mapCompatLog);
  }

  async clearAll(): Promise<void> {
    await pool.execute('DELETE FROM sys_audit_logs');
  }
}
