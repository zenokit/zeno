// examples/plugins/cors.ts
import { pluginManager } from '@/core/plugin';

export const corsPlugin = pluginManager.createPlugin('cors', {
  onRegister(api, config) {
    console.log("🔄 CORS plugin registered");
  },
  
  beforeRequest(req, res, context, config) {
    const origin = req.headers.origin;
    let allowOrigin = '*';
    
    // Déterminer l'origine autorisée
    if (config.origin) {
      if (typeof config.origin === 'boolean') {
        allowOrigin = config.origin ? '*' : 'null';
      } else if (typeof config.origin === 'string') {
        allowOrigin = config.origin === '*' || config.origin === origin ? origin : config.origin;
      } else if (Array.isArray(config.origin)) {
        allowOrigin = config.origin.includes('*') || config.origin.includes(origin) 
          ? origin 
          : config.origin[0];
      }
    }
    
    // Définir les en-têtes CORS
    if (allowOrigin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Vary', 'Origin');
    }
    
    // OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
      const methods = config.methods || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
      res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      
      if (config.allowedHeaders) {
        res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
      } else if (req.headers['access-control-request-headers']) {
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
      }
      
      if (config.maxAge !== undefined) {
        res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
      }
      
      if (config.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      if (config.exposedHeaders && config.exposedHeaders.length) {
        res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
      }
      
      if (!config.preflightContinue) {
        res.statusCode = 204;
        res.end();
        return false;
      }
    } else if (allowOrigin && config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    return true;
  }
});