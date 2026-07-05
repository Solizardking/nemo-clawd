"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliMode = cliMode;
const agent_mode_js_1 = require("../agent-mode.js");
async function cliMode(opts) {
    const { set, logger } = opts;
    if (set === undefined) {
        const mode = (0, agent_mode_js_1.getAgentMode)();
        logger.info(`Agent mode: ${mode}`);
        logger.info((0, agent_mode_js_1.describeAgentMode)(mode));
        return;
    }
    if (!(0, agent_mode_js_1.isAgentMode)(set)) {
        logger.error(`Unknown mode "${set}". Expected one of: ${agent_mode_js_1.AGENT_MODES.join(", ")}`);
        process.exitCode = 1;
        return;
    }
    const mode = (0, agent_mode_js_1.setAgentMode)(set);
    logger.info(`Agent mode set: ${mode}`);
    logger.info((0, agent_mode_js_1.describeAgentMode)(mode));
}
//# sourceMappingURL=mode.js.map