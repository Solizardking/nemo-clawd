"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSlashCommand = handleSlashCommand;
const state_js_1 = require("../blueprint/state.js");
const config_js_1 = require("../onboard/config.js");
const agent_mode_js_1 = require("../agent-mode.js");
function handleSlashCommand(ctx, _api) {
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
function slashHelp() {
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
function slashStatus() {
    const state = (0, state_js_1.loadState)();
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
function slashOnboard() {
    const config = (0, config_js_1.loadOnboardConfig)();
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
function slashMode(target, isAuthorizedSender) {
    if (target === undefined) {
        const mode = (0, agent_mode_js_1.getAgentMode)();
        return {
            text: [`**Agent Mode**: \`${mode}\``, "", (0, agent_mode_js_1.describeAgentMode)(mode), "", "Switch with `/nemoclawd mode ai` or `/nemoclawd mode trading`."].join("\n"),
        };
    }
    // Mode is a security boundary (it gates wallet/trading tool access), so only an
    // authorized sender may change it. Reading the current mode stays open to anyone.
    if (!isAuthorizedSender) {
        return {
            text: "Switching agent mode requires an authorized sender. Use `nemoclawd nemoclawd mode <ai|trading>` from the host CLI instead.",
        };
    }
    if (!(0, agent_mode_js_1.isAgentMode)(target)) {
        return { text: `Unknown mode "${target}". Expected one of: ${agent_mode_js_1.AGENT_MODES.join(", ")}` };
    }
    const mode = (0, agent_mode_js_1.setAgentMode)(target);
    return { text: [`**Agent mode set**: \`${mode}\``, "", (0, agent_mode_js_1.describeAgentMode)(mode)].join("\n") };
}
function slashEject() {
    const state = (0, state_js_1.loadState)();
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
//# sourceMappingURL=slash.js.map