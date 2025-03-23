// examples/plugins/security.ts
import { pluginManager } from '@/core/plugin';

export const securityPlugin = pluginManager.createPlugin('security', {
  onRegister(api, config) {
    console.log(`🔒 Security plugin registered`);
    
    // Stocker les informations de rate limiting
    api.store.set('rateLimit', new Map<string, { count: number, resetAt: number }>());
  },
  
  beforeRequest(req, res, context, config) {
    // Helmet headers
    if (config.helmet) {
      if (config.helmet.contentSecurityPolicy) {
        res.setHeader('Content-Security-Policy', typeof config.helmet.contentSecurityPolicy === 'boolean' 
          ? "default-src 'self'" 
          : Object.entries(config.helmet.contentSecurityPolicy).map(([key, value]) => `${key} ${value}`).join('; '));
      }
      
      if (config.helmet.xssFilter !== false) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }
      
      if (config.helmet.noSniff !== false) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      
      if (config.helmet.frameguard !== false) {
        const action = typeof config.helmet.frameguard === 'object' 
          ? config.helmet.frameguard.action 
          : 'sameorigin';
        res.setHeader('X-Frame-Options', action.toUpperCase());
      }
      
      if (config.helmet.hsts) {
        const hstsOptions = typeof config.helmet.hsts === 'object' 
          ? config.helmet.hsts 
          : { maxAge: 15552000, includeSubDomains: true, preload: false };
        
        let hstsHeader = `max-age=${hstsOptions.maxAge}`;
        if (hstsOptions.includeSubDomains) hstsHeader += '; includeSubDomains';
        if (hstsOptions.preload) hstsHeader += '; preload';
        
        res.setHeader('Strict-Transport-Security', hstsHeader);
      }
    }
    
    // Rate limiting
    if (config.rateLimit) {
      const store = pluginManager.store.get<Map<string, { count: number, resetAt: number }>>('rateLimit');
      
      if (store) {
        const windowMs = config.rateLimit.windowMs || 60000;
        const maxRequests = config.rateLimit.max || 100;
        
        const key = config.rateLimit.keyGenerator 
          ? config.rateLimit.keyGenerator(req) 
          : (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '');
        
        const now = Date.now();
        let record = store.get(key);
        
        // Réinitialiser si la fenêtre est expirée
        if (!record || record.resetAt < now) {
          record = { count: 0, resetAt: now + windowMs };
        }
        
        // Incrémenter le compteur
        record.count++;
        store.set(key, record);
        
        // Ajouter les en-têtes de rate limiting si configurés
        if (config.rateLimit.headers !== false) {
          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
          res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());
        }
        
        // Vérifier si la limite est dépassée
        if (record.count > maxRequests) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Too Many Requests',
            message: config.rateLimit.message || 'You have exceeded the request rate limit'
          }));
          return false;
        }
      }
    }
    
    return true;
  }
});