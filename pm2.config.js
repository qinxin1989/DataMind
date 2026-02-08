module.exports = {
  apps: [
    {
      name: 'datamind',
      script: './dist/index.js',
      instances: 'max',  // 使用所有CPU核心
      exec_mode: 'cluster',  // 集群模式
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      env_staging: {
        NODE_ENV: 'staging',
      },
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // 自动重启配置
      watch: false,  // 生产环境不建议开启
      ignore_watch: ['node_modules', 'logs', 'uploads', 'backups'],
      max_memory_restart: '1G',  // 内存超过1G自动重启

      // 重启策略
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // 其他配置
      instance_var: 'INSTANCE_ID',
      combine_logs: true,
    },
  ],
};
