// examples/plugins/logger.ts
import { pluginManager } from '@/core/plugin';

export const loggerPlugin = pluginManager.createPlugin('logger', {
  onRegister(api, config) {
    console.log(`📝 Logger plugin registered with level: ${config.logLevel || 'info'}`);
  },
  
  beforeRequest(req, res, context, config) {
    // Toujours stocker l'heure de début
    (req as any)._requestStart = Date.now();
    
    // Log simple, toujours affiché
    console.log(`📥 ${req.method} ${req.url}`);
    
    // Log détaillé si en mode debug
    if (config.logLevel === 'debug' && config.logHeaders) {
      console.log('Headers:', req.headers);
    }
    
    return true;
  },
  
  afterRequest(req, res, context, config) {
    const start = (req as any)._requestStart || Date.now();
    const duration = Date.now() - start;
    
    console.log(`📤 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    
    return true;
  },
  
  onError(req, res, context, config) {
    const { error } = context || {};
    
    console.error(`❌ Error on ${req.method} ${req.url}:`, error?.message || 'Unknown error');
    
    if (config.logLevel === 'debug' && error?.stack) {
      console.error(error.stack);
    }
    
    return true;
  }
});