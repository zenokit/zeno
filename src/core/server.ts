import { getAdapter } from '@/adapters';
import { defaultConfig, type ServerConfig } from "@/config/serverConfig";
import { loadRoutes } from './router';
import { watchRoutes, stopWatching } from './watcher';
import { pluginManager } from './plugin';
import type { Server } from 'http';
import { primaryLog } from '@/utils/logs';
import cluster from 'cluster';
import { setupGracefulShutdown } from '@/utils/gracefulShutdown';

let serverInstance: Server | null = null;

async function createServer(
  routesDir: string,
  config: ServerConfig = defaultConfig
) {
  const { platform = 'node' } = config;
  const verbose = config.isDev && cluster.isPrimary;
  
  try {
    const extendedConfig = await pluginManager.extendConfig(config);
    pluginManager.setConfig(extendedConfig);
    
    await pluginManager.runHook('onRoutesLoad', routesDir);
    await loadRoutes(routesDir);
    
    if (verbose) {
      primaryLog("🚀 Serveur démarré");
      primaryLog(`📂 Routes chargées depuis: ${routesDir}`);
    }
    
    if (config.isDev) {
      watchRoutes(routesDir, verbose);
      
      if (verbose) {
        primaryLog("🔥 Mode de développement activé");
      }
    }

    const adapter = getAdapter(platform);
    const handler = adapter.createHandler(routesDir);

    let server;
    switch (platform) {
      case 'node':
        server = (handler as (config?: ServerConfig) => Server)(extendedConfig);
        if (server && typeof server.on === 'function') {
          serverInstance = server;
        } else {
          primaryLog("⚠️ Note: Server instance not available for graceful shutdown in this process");
        }
        break;
      case 'bun':
        server = (handler as (config?: ServerConfig) => void)(extendedConfig);
        break;
      case 'vercel':
      case 'netlify':
        server = handler;
        break;
      default:
        throw new Error(`Plateforme "${platform}" non supportée`);
    }
    
    if (serverInstance) {
      pluginManager.setServer(serverInstance);
      
      await pluginManager.runHook('onServerInit', serverInstance, extendedConfig);
      
      setupGracefulShutdown(serverInstance, {
        beforeShutdown: async () => {
          await pluginManager.runHook('onServerShutdown', serverInstance!);
        }
      });
      
      setTimeout(async () => {
        await pluginManager.runHook('onServerStart', serverInstance!, extendedConfig);
      }, 100);
    } else if (verbose) {
      primaryLog("⚠️ No server instance available for graceful shutdown");
    }
    
    return server;
  } catch (error) {
    if (verbose) {
      primaryLog("❌ Erreur lors de la création du serveur:", error);
    }
    throw error;
  }
}

export { createServer };