import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type * as PumpSdkTypes from "@nirholas/pump-sdk";

const require = createRequire(import.meta.url);
const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadPumpSdk(): typeof PumpSdkTypes {
  const candidates = [
    "@nirholas/pump-sdk",
    resolve(moduleDir, "../node_modules/@nirholas/pump-sdk/dist/index.js"),
    resolve(moduleDir, "../../node_modules/@nirholas/pump-sdk/dist/index.js"),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate) as typeof PumpSdkTypes;
    } catch {
      continue;
    }
  }

  throw new Error(
    "Unable to load @nirholas/pump-sdk from the package entrypoint or dist/index.js fallback paths.",
  );
}

const pumpSdk = loadPumpSdk();

export const {
  OnlinePumpSdk,
  PUMP_SDK,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  MAX_SHAREHOLDERS,
  bondingCurveMarketCap,
  calculateFeeTier,
  canonicalPumpPoolPda,
  computeFeesBps,
  createFallbackConnection,
  feeSharingConfigPda,
  getBondingCurveSummary,
  getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount,
  getFee,
  getGraduationProgress,
  getSellSolAmountFromTokenAmount,
  getTokenPrice,
  newBondingCurve,
  parseEndpoints,
} = pumpSdk;

export type OnlinePumpSdkInstance = PumpSdkTypes.OnlinePumpSdk;
