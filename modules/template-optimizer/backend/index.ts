/**
 * 模板优化器入口
 */
import { Router } from 'express';
import routes from './routes';

export default {
  name: 'template-optimizer',
  routes: routes as Router
};
