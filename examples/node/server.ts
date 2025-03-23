// examples/node/server-with-plugins.ts
import { createServer } from "@core/server";
import { getRoutesDir } from "@core/router";
import { pluginManager } from "@core/plugin";
import { corsPlugin } from "./plugins/cors";
import { loggerPlugin } from "./plugins/logger";
import { securityPlugin } from "./plugins/security";
import { staticPlugin } from "./plugins/static";

// Créer et configurer les plugins
const plugins = [
  // Plugin CORS
  corsPlugin({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    order: 5 // Priorité élevée
  }),
  
  // Plugin Security
  securityPlugin({
    helmet: {
      contentSecurityPolicy: true,
      xssFilter: true,
      noSniff: true,
      frameguard: true
    },
    rateLimit: {
      windowMs: 60000,
      max: 9999999
    },
    order: 20
  })
];

pluginManager.register(plugins);

createServer(getRoutesDir(), {
  port: 8888,
  isDev: process.env.NODE_ENV !== 'production',
  
  cluster: {
    enabled: true
  }
});