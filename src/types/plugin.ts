import type { Server } from "http";
import type { MiddlewareCallback, Request, Response } from "./";
import type { ServerConfig } from "./index";

export interface PluginHooks {
  onRegister?: (pluginApi: PluginAPI) => void | Promise<void>;
  onServerInit?: (server: Server, config: ServerConfig) => void | Promise<void>;
  onServerStart?: (server: Server, config: ServerConfig) => void | Promise<void>;
  onServerShutdown?: (server: Server) => void | Promise<void>;
  onRoutesLoad?: (routesDir: string) => void | Promise<void>;
  onRoutesReload?: (routesDir: string) => void | Promise<void>;
  
  enhanceRequest?: (req: Request) => Request | Promise<Request>;
  enhanceResponse?: (res: Response) => Response | Promise<Response>;
  
  beforeRequest?: MiddlewareCallback;
  afterRequest?: MiddlewareCallback;
  onError?: MiddlewareCallback;
  
  extendConfig?: (config: ServerConfig) => ServerConfig | Promise<ServerConfig>;
}

export interface PluginOptions {
  name: string;
  version?: string;
  dependencies?: string[];
  enabled?: boolean;
  order?: number; 
  config?: Record<string, any>;
}

export interface Plugin {
  options: PluginOptions;
  hooks: PluginHooks;
}

export interface PluginAPI {
  registerHook: <T extends keyof PluginHooks>(
    hookName: T,
    callback: PluginHooks[T]
  ) => void;
  
  getServer: () => Server | null;
  getConfig: () => ServerConfig;
  
  addMiddleware: (
    type: 'beforeRequest' | 'afterRequest' | 'onError', 
    middleware: MiddlewareCallback
  ) => { remove: () => void };
  
  emit: (eventName: string, ...args: any[]) => boolean;
  on: (eventName: string, listener: (...args: any[]) => void) => void;
  
  store: {
    get: <T>(key: string) => T | undefined;
    set: <T>(key: string, value: T) => void;
    has: (key: string) => boolean;
    delete: (key: string) => boolean;
  };
}

export type PluginCreator = (
  options?: Partial<Omit<PluginOptions, "name">> & { config?: Record<string, any> }
) => Plugin;