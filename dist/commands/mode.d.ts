import type { PluginLogger } from "../index.js";
export interface ModeOptions {
    set?: string;
    logger: PluginLogger;
}
export declare function cliMode(opts: ModeOptions): Promise<void>;
//# sourceMappingURL=mode.d.ts.map