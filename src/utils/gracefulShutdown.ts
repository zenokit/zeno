import * as http from 'http';
import * as net from 'net';
import cluster from 'cluster';
import { primaryLog } from './logs';

interface ShutdownOptions {
  timeout?: number;
  signals?: NodeJS.Signals[];
  beforeShutdown?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;
}

function setupGracefulShutdown(server: http.Server | null, options: ShutdownOptions = {}) {
  if (!server) {
    primaryLog('⚠️ Warning: No valid server provided to setupGracefulShutdown');
    return { shutdown: (signal = 'MANUAL') => Promise.resolve() };
  }

  if (typeof server.on !== 'function') {
    primaryLog('⚠️ Warning: Server provided to setupGracefulShutdown does not have .on method');
    return { shutdown: (signal = 'MANUAL') => Promise.resolve() };
  }

  const {
    timeout = 30000,
    signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'],
    beforeShutdown = async () => {},
    onShutdown = async () => {},
  } = options;

  let isShuttingDown = false;
  const connections = new Set<net.Socket>();

  server.on('connection', (connection: net.Socket) => {
    connections.add(connection);
    connection.on('close', () => {
      connections.delete(connection);
    });
  });

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    primaryLog(`\n🛑 ${signal} received. Graceful shutdown initiated...`);
    
    try {
      await beforeShutdown();
      
      const forceShutdownTimeout = setTimeout(() => {
        primaryLog('⚠️ Graceful shutdown timeout reached, forcing exit');
        process.exit(1);
      }, timeout);
      
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      
      primaryLog('✅ Server closed, no longer accepting connections');
      
      if (connections.size > 0) {
        primaryLog(`Waiting for ${connections.size} active connections to finish...`);
        
        for (const socket of connections) {
          socket.setKeepAlive(false);
          
          if (!socket.destroyed) {
            socket.end();
          }
        }
        
        const connectionCloseTimeout = setTimeout(() => {
          if (connections.size > 0) {
            primaryLog(`Forcing close of ${connections.size} connections`);
            for (const socket of connections) {
              socket.destroy();
            }
          }
        }, timeout / 2);
        
        const checkInterval = setInterval(() => {
          if (connections.size === 0) {
            clearInterval(checkInterval);
            clearTimeout(connectionCloseTimeout);
            primaryLog('✅ All connections closed successfully');
          }
        }, 1000);
      }
      
      await onShutdown();
      
      clearTimeout(forceShutdownTimeout);
      
      primaryLog('✅ Graceful shutdown completed');
      
      if (cluster.isWorker) {
        process.exit(0);
      }
    } catch (error) {
      primaryLog('⚠️ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  for (const signal of signals) {
    process.on(signal, () => {
      shutdown(signal).catch((error) => {
        primaryLog('Critical error during shutdown:', error);
        process.exit(1);
      });
    });
  }

  process.on('uncaughtException', (error) => {
    primaryLog('⚠️ Uncaught exception:', error);
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    primaryLog('⚠️ Unhandled rejection:', reason);
    shutdown('unhandledRejection').catch(() => process.exit(1));
  });

  return {
    shutdown: (signal = 'MANUAL') => shutdown(signal),
  };
}

export { setupGracefulShutdown };