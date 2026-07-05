"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliMode = cliMode;
const agent_mode_js_1 = require("../agent-mode.js");
async function cliMode(opts) {
    const { set, logger } = opts;
    const envOverride = process.env.NEMOCLAWD_MODE?.trim();
    const hasActiveOverride = (0, agent_mode_js_1.isAgentMode)(envOverride);
    if (set === undefined) {
        const mode = (0, agent_mode_js_1.getAgentMode)();
        logger.info(`Agent mode: ${mode}`);
        logger.info((0, agent_mode_js_1.describeAgentMode)(mode));
        if (hasActiveOverride) {
            logger.info(`(forced by NEMOCLAWD_MODE=${envOverride}; unset it to use the persisted mode)`);
        }
        return;
    }
    if (!(0, agent_mode_js_1.isAgentMode)(set)) {
        logger.error(`Unknown mode "${set}". Expected one of: ${agent_mode_js_1.AGENT_MODES.join(", ")}`);
        process.exitCode = 1;
        return;
    }
    const mode = (0, agent_mode_js_1.setAgentMode)(set);
    if (hasActiveOverride && envOverride !== mode) {
        logger.error(`Persisted mode set to "${mode}", but NEMOCLAWD_MODE="${envOverride}" is active in this environment and overrides it. Unset NEMOCLAWD_MODE for the persisted mode to take effect.`);
        process.exitCode = 1;
        return;
    }
    logger.info(`Agent mode set: ${mode}`);
    logger.info((0, agent_mode_js_1.describeAgentMode)(mode));
}
//# sourceMappingURL=mode.js.map