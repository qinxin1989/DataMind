# 🚀 快速修复指南

## 问题: 数据源列表显示为空

### 症状
- 数据源管理页面显示 "暂无数据源"
- 已配置的数据源无法显示

### 快速修复步骤

#### 方法 1: 刷新浏览器 (推荐)
```
1. 按 F5 或 Ctrl+R 刷新页面
2. 清除浏览器缓存 (Ctrl+Shift+Delete)
3. 重新访问数据源管理页面
```

#### 方法 2: 重启服务器
```bash
# 停止服务器
Ctrl+C

# 重新启动
npm run dev
```

#### 方法 3: 检查数据库连接
```bash
# 检查 MySQL 是否运行
mysql -u root -pqinxin -e "SELECT 1"

# 检查数据源是否存在
mysql -u root -pqinxin -e "SELECT * FROM taobao_data.datasource_config"
```

#### 方法 4: 完整重置
```bash
# 1. 停止服务器
Ctrl+C

# 2. 重新初始化数据库
mysql -u root -pqinxin < init.sql

# 3. 重启服务器
npm run dev

# 4. 刷新浏览器
```

---

## 验证修复

### 检查清单
- [ ] 页面加载正常
- [ ] 数据源列表显示
- [ ] 可以添加新数据源
- [ ] 可以删除数据源
- [ ] 可以编辑数据源
- [ ] 可以测试连接

### 测试命令
```bash
# 运行 API 测试
npm run test

# 检查服务器日志
# 查看是否有错误信息
```

---

## 常见问题

### Q1: 刷新后还是显示为空？
**A**: 
1. 检查浏览器控制台是否有错误 (F12)
2. 检查网络标签页，API 请求是否成功
3. 检查服务器是否正常运行

### Q2: 数据库中有数据但页面显示为空？
**A**:
1. 检查 MySQL 连接是否正常
2. 检查 .env 文件中的数据库配置
3. 重启服务器

### Q3: 如何查看详细错误信息？
**A**:
1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签页
3. 查看 Network 标签页中的 API 请求

---

## 预防措施

### 1. 定期检查
- 每周检查一次数据源列表
- 验证关键数据源连接正常

### 2. 备份数据
```bash
# 备份数据库
mysqldump -u root -pqinxin taobao_data > backup.sql

# 恢复数据库
mysql -u root -pqinxin taobao_data < backup.sql
```

### 3. 监控日志
- 查看服务器日志
- 查看浏览器控制台
- 查看 MySQL 错误日志

---

## 获取帮助

### 查看日志
```bash
# 服务器日志
npm run dev  # 查看输出

# 浏览器日志
F12 -> Console 标签页

# 数据库日志
mysql -u root -pqinxin -e "SHOW ENGINE INNODB STATUS"
```

### 联系支持
- GitHub Issues: https://github.com/qinxin1989/ai-data-platform/issues
- Email: 896766709@qq.com

---

## 相关文档

- [BUGFIX_SUMMARY.md](./BUGFIX_SUMMARY.md) - Bug 修复总结
- [CHANGELOG.md](./CHANGELOG.md) - 版本更新日志
- [README.md](./README.md) - 项目说明

---

**需要帮助？查看上面的步骤或联系支持！** 🆘
