// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { PluginLogger } from "../index.js";
import { AGENT_MODES, describeAgentMode, getAgentMode, isAgentMode, setAgentMode } from "../agent-mode.js";

export interface ModeOptions {
  set?: string;
  logger: PluginLogger;
}

export async function cliMode(opts: ModeOptions): Promise<void> {
  const { set, logger } = opts;
  const envOverride = process.env.NEMOCLAWD_MODE?.trim();
  const hasActiveOverride = isAgentMode(envOverride);

  if (set === undefined) {
    const mode = getAgentMode();
    logger.info(`Agent mode: ${mode}`);
    logger.info(describeAgentMode(mode));
    if (hasActiveOverride) {
      logger.info(`(forced by NEMOCLAWD_MODE=${envOverride}; unset it to use the persisted mode)`);
    }
    return;
  }

  if (!isAgentMode(set)) {
    logger.error(`Unknown mode "${set}". Expected one of: ${AGENT_MODES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const mode = setAgentMode(set);

  if (hasActiveOverride && envOverride !== mode) {
    logger.error(
      `Persisted mode set to "${mode}", but NEMOCLAWD_MODE="${envOverride}" is active in this environment and overrides it. Unset NEMOCLAWD_MODE for the persisted mode to take effect.`,
    );
    process.exitCode = 1;
    return;
  }

  logger.info(`Agent mode set: ${mode}`);
  logger.info(describeAgentMode(mode));
}
