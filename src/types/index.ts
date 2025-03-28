import { IncomingMessage, ServerResponse } from "http";
import type { MiddlewareCallback } from "./middleware";

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

// Handler for each HTTP method, need to be modified to give extra parameters and functionality
type GetHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
type PostHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
type PutHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
type DeleteHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void>;
type PatchHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void>;

type RouteHandlers = {
  GET?: Handler;
  POST?: Handler;
  PUT?: Handler;
  DELETE?: Handler;
  PATCH?: Handler;
};

type Route = {
  pattern: RegExp;
  handlers: RouteHandlers;
  params: string[];
};

// Dans src/types/index.ts
interface ServerConfig {
  // Options existantes
  isDev?: boolean;
  port?: number;
  platform?: 'node' | 'vercel' | 'netlify' | 'bun';
  timeout?: number;
  httpsOptions?: {
    cert?: string | Buffer;
    key?: string | Buffer;
    ca?: string | Buffer | Array<string | Buffer>;
  },
  cluster?: {
    enabled: boolean;
    workers?: number;
    loadBalancing?: 'round-robin' | 'least-connections' | 'least-cpu' | 'fastest-response';
    stickySessions?: boolean;
  };
  defaultHeaders?: Record<string, string>;
  globalMiddlewares?: {
    beforeRequest?: MiddlewareCallback;
    afterRequest?: MiddlewareCallback;
    onError?: MiddlewareCallback;
  };
  
  monitoring?: {
    enabled: boolean;
    sampleInterval?: number;
    reportInterval?: number;
    thresholds?: {
      cpu?: number;
      memory?: number;
      responseTime?: number;
      errorRate?: number;
    };
  };
}

interface ClusterConfig {
  enabled: boolean;
  workers?: number; // Number of workers, defaults to CPU cores
}

export type { Handler, RouteHandlers, Route, ServerConfig, ClusterConfig };
export * from "./sse";
export * from "./adapter";
export * from "./platform";
export * from "./enhancer";
export * from "./platform";
export * from "./middleware";
export * from "./monitor";
export * from "./loadBalancer";