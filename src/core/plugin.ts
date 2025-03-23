// src/core/plugin.ts
import { EventEmitter } from "events";
import type { Server } from "http";
import type { ServerConfig, MiddlewareCallback } from "@/types";
import { addMiddleware } from "./middleware";
import { primaryLog } from "@/utils/logs";

// Store partagé entre les plugins
const pluginStore = new Map<string, any>();

// Événements partagés entre les plugins
const pluginEmitter = new EventEmitter();
pluginEmitter.setMaxListeners(100); // Augmenter la limite d'écouteurs

// Interface Plugin simplifiée
interface Plugin {
  name: string;
  hooks: Record<string, Function>;
  config?: any;
  order?: number;
  enabled?: boolean;
  dependencies?: string[];
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private server: Server | null = null;
  private config: ServerConfig = {};
  
  constructor() {}
  
  // Création d'un plugin avec une API facile à utiliser
  createPlugin(name: string, hooks: Record<string, Function>) {
    // Retourne une fonction de configuration qui capture les hooks
    return (options: any = {}) => {
      // Configurer les hooks pour qu'ils aient accès à options
      const configuredHooks: Record<string, Function> = {};
      
      // Pour chaque hook, créer une fonction qui capture options
      Object.entries(hooks).forEach(([hookName, hook]) => {
        // La nouvelle fonction a le même nom mais capture options
        configuredHooks[hookName] = (...args: any[]) => {
          // Ajouter options comme dernier argument
          return (hook as Function)(...args, options);
        };
      });
      
      // Retourner le plugin configuré
      return {
        name,
        hooks: configuredHooks,
        config: options,
        order: options.order || 0,
        enabled: options.enabled !== false,
        dependencies: options.dependencies || []
      };
    };
  }
  
  // Enregistrement d'un ou plusieurs plugins
  async register(pluginOrPlugins: Plugin | Plugin[]): Promise<void> {
    // Si c'est un tableau, traiter chaque plugin
    if (Array.isArray(pluginOrPlugins)) {
      // Trier les plugins par ordre d'exécution
      const sortedPlugins = [...pluginOrPlugins].sort((a, b) => 
        (a.order || 0) - (b.order || 0)
      );
      
      // Enregistrer chaque plugin
      for (const plugin of sortedPlugins) {
        if (plugin.enabled !== false) {
          // Utiliser la méthode register pour un seul plugin
          await this.registerSinglePlugin(plugin);
        }
      }
      return;
    }
    
    // Sinon, traiter un seul plugin
    await this.registerSinglePlugin(pluginOrPlugins);
  }
  
  // Enregistrement d'un plugin individuel
  private async registerSinglePlugin(plugin: Plugin): Promise<void> {
    if (!plugin.name) {
      throw new Error("Plugin must have a name");
    }
    
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered`);
    }
    
    // Vérifier les dépendances
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      for (const dependency of plugin.dependencies) {
        if (!this.plugins.has(dependency)) {
          throw new Error(`Plugin "${plugin.name}" depends on "${dependency}", which is not registered`);
        }
      }
    }
    
    // Stocker le plugin
    this.plugins.set(plugin.name, plugin);
    
    // Appeler le hook onRegister si disponible avec accès au store et events
    const onRegister = plugin.hooks.onRegister;
    if (onRegister) {
      const api = {
        store: {
          get: <T>(key: string): T | undefined => pluginStore.get(key),
          set: <T>(key: string, value: T): void => { pluginStore.set(key, value); },
          has: (key: string): boolean => pluginStore.has(key),
          delete: (key: string): boolean => pluginStore.delete(key)
        },
        emit: pluginEmitter.emit.bind(pluginEmitter),
        on: pluginEmitter.on.bind(pluginEmitter),
        getServer: () => this.server,
        getConfig: () => ({ ...this.config }),
        addMiddleware
      };
      
      await onRegister(api, plugin.config);
    }
    
    if (plugin.enabled !== false) {
      primaryLog(`📦 Plugin "${plugin.name}" registered successfully`);
    }
  }
  
  // Désactiver un plugin
  disable(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.enabled = false;
      return true;
    }
    return false;
  }
  
  // Activer un plugin
  enable(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.enabled = true;
      return true;
    }
    return false;
  }
  
  // Récupérer un plugin par son nom
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }
  
  // Récupérer tous les plugins
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  // Récupérer uniquement les plugins activés
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled !== false);
  }
  
  // Définir la référence au serveur
  setServer(server: Server): void {
    this.server = server;
  }
  
  // Définir la configuration
  setConfig(config: ServerConfig): void {
    this.config = { ...config };
  }
  
  // Exécuter un hook sur tous les plugins activés
  async runHook(hookName: string, ...args: any[]): Promise<any[]> {
    const enabledPlugins = this.getEnabledPlugins();
    const results: any[] = [];
    
    for (const plugin of enabledPlugins) {
      const hook = plugin.hooks[hookName];
      if (hook && typeof hook === 'function') {
        try {
          const result = await hook(...args);
          results.push(result);
        } catch (error) {
          primaryLog(`❌ Error running hook "${hookName}" in plugin "${plugin.name}":`, error);
          results.push(null);
        }
      }
    }
    
    return results;
  }
  
  // Exécuter les hooks de middleware dans l'ordre correct
  async runMiddlewareHook(
    hookName: 'beforeRequest' | 'afterRequest' | 'onError',
    req: any,
    res: any,
    context?: any
  ): Promise<boolean> {
    const enabledPlugins = this.getEnabledPlugins()
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    for (const plugin of enabledPlugins) {
      const middleware = plugin.hooks[hookName];
      
      if (middleware && typeof middleware === 'function') {
        try {
          const result = await middleware(req, res, context);
          if (result === false) {
            return false;
          }
        } catch (error) {
          if (hookName !== 'onError') {
            // Exécuter les hooks onError
            await this.runMiddlewareHook('onError', req, res, { error, phase: hookName });
          }
          return false;
        }
      }
    }
    
    return true;
  }
  
  // Étendre la configuration avec tous les plugins activés
  async extendConfig(config: ServerConfig): Promise<ServerConfig> {
    let extendedConfig = { ...config };
    const enabledPlugins = this.getEnabledPlugins();
    
    for (const plugin of enabledPlugins) {
      const extendConfigHook = plugin.hooks.extendConfig;
      if (extendConfigHook) {
        try {
          // Passer la config actuelle et la config du plugin
          extendedConfig = await extendConfigHook(extendedConfig, plugin.config) || extendedConfig;
        } catch (error) {
          primaryLog(`❌ Error extending config in plugin "${plugin.name}":`, error);
        }
      }
    }
    
    return extendedConfig;
  }
  
  // Accès au store partagé et aux événements
  get store() {
    return {
      get: <T>(key: string): T | undefined => pluginStore.get(key),
      set: <T>(key: string, value: T): void => { pluginStore.set(key, value); },
      has: (key: string): boolean => pluginStore.has(key),
      delete: (key: string): boolean => pluginStore.delete(key)
    };
  }
  
  get events() {
    return pluginEmitter;
  }
}

// Singleton pour le gestionnaire de plugins
const pluginManager = new PluginManager();

export {
  pluginManager,
  type Plugin
};