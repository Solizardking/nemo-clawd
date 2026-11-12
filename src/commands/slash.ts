// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Handler for the /nemoclawd slash command (chat interface).
 *
 * Supports subcommands:
 *   /nemoclawd status - show sandbox/blueprint/inference state
 *   /nemoclawd eject - rollback to host installation
 *   /nemoclawd          - show help
 */

import type { PluginCommandContext, PluginCommandResult, NemoclawdPluginApi } from "../index.js";
import { loadState } from "../blueprint/state.js";
import { loadOnboardConfig } from "../onboard/config.js";
import { AGENT_MODES, describeAgentMode, getAgentMode, isAgentMode, setAgentMode } from "../agent-mode.js";

export function handleSlashCommand(
  ctx: PluginCommandContext,
  _api: NemoclawdPluginApi,
): PluginCommandResult {
  const args = ctx.args?.trim().split(/\s+/) ?? [];
  const subcommand = args[0] ?? "";

  switch (subcommand) {
    case "status":
      return slashStatus();
    case "eject":
      return slashEject();
    case "onboard":
      return slashOnboard();
    case "mode":
      return slashMode(args[1], ctx.isAuthorizedSender);
    default:
      return slashHelp();
  }
}

function slashHelp(): PluginCommandResult {
  return {
    text: [
      "**Nemo Clawd**",
      "",
      "Usage: `/nemoclawd <subcommand>`",
      "",
      "Subcommands:",
      "  `status`     - Show sandbox, blueprint, and inference state",
      "  `eject`      - Show rollback instructions",
      "  `onboard`    - Show onboarding status and instructions",
      "  `mode [ai|trading]` - Show or switch the agent mode",
      "",
      "For full management use the CLI:",
      "  `nemoclawd nemoclawd status `",
      "  `nemoclawd nemoclawd migrate `",
      "  `nemoclawd nemoclawd launch `",
      "  `nemoclawd nemoclawd connect `",
      "  `nemoclawd nemoclawd mode [ai|trading]`",
      "  `nemoclawd nemoclawd eject --confirm`",
    ].join("\n"),
  };
}

function slashStatus(): PluginCommandResult {
  const state = loadState();

  if (!state.lastAction) {
    return {
      text: "**Nemo Clawd**: No operations performed yet. Run `nemoclawd nemoclawd launch ` or `nemoclawd nemoclawd migrate ` to get started.",
    };
  }

  const lines = [
    "**Nemo Clawd Status**",
    "",
    `Last action: ${state.lastAction}`,
    `Blueprint: ${state.blueprintVersion ?? "unknown"}`,
    `Run ID: ${state.lastRunId ?? "none"}`,
    `Sandbox: ${state.sandboxName ?? "none"}`,
    `Updated: ${state.updatedAt}`,
  ];

  if (state.migrationSnapshot) {
    lines.push("", `Rollback snapshot: ${state.migrationSnapshot}`);
  }

  return { text: lines.join("\n") };
}

function slashOnboard(): PluginCommandResult {
  const config = loadOnboardConfig();
  if (config) {
    return {
      text: [
        "**Nemo Clawd Onboard Status**",
        "",
        `Endpoint: ${config.endpointType} (${config.endpointUrl})`,
        config.ncpPartner ? `NCP Partner: ${config.ncpPartner}` : null,
        `Model: ${config.model}`,
        `Credential: $${config.credentialEnv}`,
        `Profile: ${config.profile}`,
        `Onboarded: ${config.onboardedAt}`,
        "",
        "To reconfigure, run: `nemoclawd nemoclawd onboard `",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  return {
    text: [
      "**Nemo Clawd Onboarding**",
      "",
      "No configuration found. Run the onboard command to set up inference:",
      "",
      "```",
      "nemoclawd nemoclawd onboard ",
      "```",
      "",
      "Or non-interactively:",
      "```",
      'nemoclawd nemoclawd onboard --api-key "$NVIDIA_API_KEY" --endpoint build --model nvidia/nemotron-3-ultra-550b-a55b',
      "```",
    ].join("\n"),
  };
}

function slashMode(target: string | undefined, isAuthorizedSender: boolean): PluginCommandResult {
  const envOverride = process.env.NEMOCLAWD_MODE?.trim();
  const hasActiveOverride = isAgentMode(envOverride);

  if (target === undefined) {
    const mode = getAgentMode();
    const overrideNote = hasActiveOverride ? `\n\n_(forced by NEMOCLAWD_MODE=${envOverride}; unset it to use the persisted mode)_` : "";
    return {
      text: [`**Agent Mode**: \`${mode}\``, "", describeAgentMode(mode), "", "Switch with `/nemoclawd mode ai` or `/nemoclawd mode trading`."].join(
        "\n",
      ) + overrideNote,
    };
  }

  // Mode is a security boundary (it gates wallet/trading tool access), so only an
  // authorized sender may change it. Reading the current mode stays open to anyone.
  if (!isAuthorizedSender) {
    return {
      text: "Switching agent mode requires an authorized sender. Use `nemoclawd nemoclawd mode <ai|trading>` from the host CLI instead.",
    };
  }

  if (!isAgentMode(target)) {
    return { text: `Unknown mode "${target}". Expected one of: ${AGENT_MODES.join(", ")}` };
  }

  const mode = setAgentMode(target);

  if (hasActiveOverride && envOverride !== mode) {
    return {
      text: `Persisted mode set to \`${mode}\`, but \`NEMOCLAWD_MODE=${envOverride}\` is active in this environment and overrides it. Unset NEMOCLAWD_MODE for the persisted mode to take effect.`,
    };
  }

  return { text: [`**Agent mode set**: \`${mode}\``, "", describeAgentMode(mode)].join("\n") };
}

function slashEject(): PluginCommandResult {
  const state = loadState();

  if (!state.lastAction) {
    return { text: "No Nemo Clawd deployment found. Nothing to eject from." };
  }

  if (!state.migrationSnapshot && !state.hostBackupPath) {
    return {
      text: "No migration snapshot found. Manual rollback required.",
    };
  }

  return {
    text: [
      "**Eject from Nemo Clawd**",
      "",
      "To rollback to your host Nemo Clawd installation, run:",
      "",
      "```",
      "nemoclawd nemoclawd eject --confirm",
      "```",
      "",
      `Snapshot: ${state.migrationSnapshot ?? state.hostBackupPath ?? "none"}`,
    ].join("\n"),
  };
}
