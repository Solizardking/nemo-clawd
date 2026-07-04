/**
 * Nemo Clawd — Nemo Clawd Plugin for OpenShell
 *
 * Uses the real Nemo Clawd plugin API. Types defined locally are minimal stubs
 * that match the Nemo Clawd SDK interfaces available at runtime via
 * `nemoclawd/plugin-sdk`. We define them here because the SDK package is only
 * available inside the Nemo Clawd host process and cannot be imported at build
 * time.
 */
type Command = import("commander").Command;
/** Subset of NemoclawdConfig that we actually read. */
export interface NemoclawdConfig {
    [key: string]: unknown;
}
/** Logger provided by the plugin host. */
export interface PluginLogger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}
/** Context passed to slash-command handlers. */
export interface PluginCommandContext {
    senderId?: string;
    channel: string;
    isAuthorizedSender: boolean;
    args?: string;
    commandBody: string;
    config: NemoclawdConfig;
    from?: string;
    to?: string;
    accountId?: string;
}
/** Return value from a slash-command handler. */
export interface PluginCommandResult {
    text?: string;
    mediaUrl?: string;
    mediaUrls?: string[];
}
/** Registration shape for a slash command. */
export interface PluginCommandDefinition {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: PluginCommandContext) => PluginCommandResult | Promise<PluginCommandResult>;
}
/** Context passed to the CLI registrar callback. */
export interface PluginCliContext {
    program: Command;
    config: NemoclawdConfig;
    workspaceDir?: string;
    logger: PluginLogger;
}
/** CLI registrar callback type. */
export type PluginCliRegistrar = (ctx: PluginCliContext) => void | Promise<void>;
/** Auth method for a provider plugin. */
export interface ProviderAuthMethod {
    type: string;
    envVar?: string;
    headerName?: string;
    label?: string;
}
/** Model entry in a provider's model catalog. */
export interface ModelProviderEntry {
    id: string;
    label: string;
    contextWindow?: number;
    maxOutput?: number;
}
/** Model catalog shape. */
export interface ModelProviderConfig {
    chat?: ModelProviderEntry[];
    completion?: ModelProviderEntry[];
}
/** Registration shape for a custom model provider. */
export interface ProviderPlugin {
    id: string;
    label: string;
    docsPath?: string;
    aliases?: string[];
    envVars?: string[];
    models?: ModelProviderConfig;
    auth: ProviderAuthMethod[];
}
/** Background service registration. */
export interface PluginService {
    id: string;
    start: (ctx: {
        config: NemoclawdConfig;
        logger: PluginLogger;
    }) => void | Promise<void>;
    stop?: (ctx: {
        config: NemoclawdConfig;
        logger: PluginLogger;
    }) => void | Promise<void>;
}
/**
 * The API object injected into the plugin's register function by the Nemo Clawd
 * host. Only the methods we actually call are listed here.
 */
export interface NemoclawdPluginApi {
    id: string;
    name: string;
    version?: string;
    config: NemoclawdConfig;
    pluginConfig?: Record<string, unknown>;
    logger: PluginLogger;
    registerCommand: (command: PluginCommandDefinition) => void;
    registerCli: (registrar: PluginCliRegistrar, opts?: {
        commands?: string[];
    }) => void;
    registerProvider: (provider: ProviderPlugin) => void;
    registerService: (service: PluginService) => void;
    resolvePath: (input: string) => string;
    on: (hookName: string, handler: (...args: unknown[]) => void) => void;
}
export interface NemoClawdConfig {
    blueprintVersion: string;
    blueprintRegistry: string;
    sandboxName: string;
    inferenceProvider: string;
    spotTradingProvider: "dflow" | string;
    predictionMarketProvider: "dflow" | string;
    dflowTradeApiUrl?: string;
    dflowTradeApiWsUrl?: string;
    dflowMetadataApiUrl?: string;
    dflowMetadataApiWsUrl?: string;
}
export declare function getPluginConfig(api: NemoclawdPluginApi): NemoClawdConfig;
export default function register(api: NemoclawdPluginApi): void;
export {};
//# sourceMappingURL=index.d.ts.map