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

export function handleSlashCommand(
  ctx: PluginCommandContext,
  _api: NemoclawdPluginApi,
): PluginCommandResult {
  const subcommand = ctx.args?.trim().split(/\s+/)[0] ?? "";

  switch (subcommand) {
    case "status":
      return slashStatus();
    case "eject":
      return slashEject();
    case "onboard":
      return slashOnboard();
    default:
      return slashHelp();
  }
}

function slashHelp(): PluginCommandResult {
  return {
    text: [
      "**Nemo Clawdd**",
      "",
      "Usage: `/nemoclawd <subcommand>`",
      "",
      "Subcommands:",
      "  `status`  - Show sandbox, blueprint, and inference state",
      "  `eject`   - Show rollback instructions",
      "  `onboard` - Show onboarding status and instructions",
      "",
      "For full management use the CLI:",
      "  `nemoclawdd nemoclawd status `",
      "  `nemoclawdd nemoclawd migrate `",
      "  `nemoclawdd nemoclawd launch `",
      "  `nemoclawdd nemoclawd connect `",
      "  `nemoclawdd nemoclawd eject --confirm`",
    ].join("\n"),
  };
}

function slashStatus(): PluginCommandResult {
  const state = loadState();

  if (!state.lastAction) {
    return {
      text: "**Nemo Clawdd**: No operations performed yet. Run `nemoclawdd nemoclawd launch ` or `nemoclawdd nemoclawd migrate ` to get started.",
    };
  }

  const lines = [
    "**Nemo Clawdd Status**",
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
        "**Nemo Clawdd Onboard Status**",
        "",
        `Endpoint: ${config.endpointType} (${config.endpointUrl})`,
        config.ncpPartner ? `NCP Partner: ${config.ncpPartner}` : null,
        `Model: ${config.model}`,
        `Credential: $${config.credentialEnv}`,
        `Profile: ${config.profile}`,
        `Onboarded: ${config.onboardedAt}`,
        "",
        "To reconfigure, run: `nemoclawdd nemoclawd onboard `",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  return {
    text: [
      "**Nemo Clawdd Onboarding**",
      "",
      "No configuration found. Run the onboard command to set up inference:",
      "",
      "```",
      "nemoclawdd nemoclawd onboard ",
      "```",
      "",
      "Or non-interactively:",
      "```",
      'nemoclawdd nemoclawd onboard --api-key "$NVIDIA_API_KEY" --endpoint build --model nvidia/nemotron-3-super-120b-a12b',
      "```",
    ].join("\n"),
  };
}

function slashEject(): PluginCommandResult {
  const state = loadState();

  if (!state.lastAction) {
    return { text: "No Nemo Clawdd deployment found. Nothing to eject from." };
  }

  if (!state.migrationSnapshot && !state.hostBackupPath) {
    return {
      text: "No migration snapshot found. Manual rollback required.",
    };
  }

  return {
    text: [
      "**Eject from Nemo Clawdd**",
      "",
      "To rollback to your host Nemo Clawdd installation, run:",
      "",
      "```",
      "nemoclawdd nemoclawd eject --confirm",
      "```",
      "",
      `Snapshot: ${state.migrationSnapshot ?? state.hostBackupPath ?? "none"}`,
    ].join("\n"),
  };
}
