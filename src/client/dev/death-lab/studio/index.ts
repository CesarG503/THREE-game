/**
 * studio/index.ts — Public API of the VIPER.IO Death Experience Studio.
 */

export * from "./DeathExperienceTypes";
export * from "./ModuleRegistry";
export * from "./BuiltinModules";
export * from "./CompositionEngine";
export * from "./PresetConverter";
export * from "./StudioEditorUI";

import { ModuleRegistry } from "./ModuleRegistry";
import { ALL_BUILTIN_MODULES } from "./BuiltinModules";

/**
 * Creates and initializes a ModuleRegistry populated with all builtin modules.
 */
export function createDefaultModuleRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();
  registry.registerAll(ALL_BUILTIN_MODULES);
  return registry;
}
