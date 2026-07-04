import type { PaymentChain } from "../utils/settings.js";
import type { BrinScanResult } from "./brin.js";

export interface PaymentOption {
  scheme: string;
  network: string;
  asset: string;
  amount?: string;
  maxAmountRequired?: string;
  price?: string;
  payTo?: string;
}

export interface PaymentAuditRecord {
  id: string;
  sessionId: string | null;
  url: string;
  domain: string;
  method: string;
  chain: PaymentChain;
  network: string;
  asset: string;
  amount: string;
  txHash?: string | null;
  status: "success" | "failed" | "requires_approval" | "blocked_by_brin";
  createdAt: string;
}

export interface PaymentInspectionResult {
  requiresPayment: boolean;
  url: string;
  method: string;
  status: number;
  options: PaymentOption[];
  description?: string;
  data?: unknown;
  brin?: BrinScanResult | null;
}
