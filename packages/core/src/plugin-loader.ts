import fs from 'fs/promises';
import path from 'path';

export async function loadPlugins() {
  // Find all installed packages matching server-plugin-*
  const pluginPackages = await findPluginPackages();
  
  for (const pkg of pluginPackages) {
    // Dynamic import of the plugin
    const plugin = await import(pkg.name);
    // Plugin self-registers via PluginRegistry
  }
}

export async function loadPluginsFromDirectory(dir: string) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    if (file.endsWith('.plugin.js')) {
      const plugin = await import(path.join(dir, file));
      // Plugin self-registers
    }
  }
} 