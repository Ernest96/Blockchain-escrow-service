import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BlockfrostProvider,
  MeshWallet,
  serializePlutusScript,
  resolvePaymentKeyHash,
  applyCborEncoding,
  unixTimeToEnclosingSlot,
  SLOT_CONFIG_NETWORK,
} from "@meshsdk/core";

// Network configuration — change here to switch between Preview / Preprod / Mainnet.
export const NETWORK = "preprod";
const NETWORK_ID = 0;
const SLOT_CONFIG = SLOT_CONFIG_NETWORK[NETWORK];
const TIME_MARGIN_MS = 1_000;

/** Cardanoscan transaction URL for the configured network. */
export function cardanoscanTxUrl(txHash: string): string {
  return `https://${NETWORK}.cardanoscan.io/transaction/${txHash}`;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key} (see .env.example)`);
  return v;
}

export function getProvider() {
  return new BlockfrostProvider(requireEnv("BLOCKFROST_PROJECT_ID"));
}

type Role = "payer" | "provider" | "admin";

const ENV_KEY_BY_ROLE: Record<Role, string> = {
  payer: "PAYER_MNEMONIC",
  provider: "PROVIDER_MNEMONIC",
  admin: "ADMIN_MNEMONIC",
};

export async function getWallet(role: Role) {
  const provider = getProvider();
  const envKey = ENV_KEY_BY_ROLE[role];
  const words = requireEnv(envKey).trim().split(/\s+/);
  const wallet = new MeshWallet({
    networkId: NETWORK_ID,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words },
  });
  await wallet.init();
  return { provider, wallet };
}

export async function getWalletByEnvKey(envKey: string) {
  const provider = getProvider();
  const words = requireEnv(envKey).trim().split(/\s+/);
  const wallet = new MeshWallet({
    networkId: NETWORK_ID,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words },
  });
  await wallet.init();
  return { provider, wallet };
}

export interface BlueprintValidator {
  title: string;
  hash: string;
  compiledCode: string;
}

export function loadValidator(): BlueprintValidator {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const blueprintPath = path.resolve(here, "..", "plutus.json");
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
  const v = blueprint.validators.find(
    (x: any) => x.title === "escrow.escrow.spend",
  );
  if (!v) throw new Error("escrow.escrow.spend not found in plutus.json");
  return v as BlueprintValidator;
}

export function getScriptCbor(): string {
  // Mesh expects the script to be wrapped in an additional CBOR byte-string.
  return applyCborEncoding(loadValidator().compiledCode);
}

export function getScriptAddress(): string {
  const cbor = getScriptCbor();
  return serializePlutusScript(
    { code: cbor, version: "V3" },
    undefined,
    NETWORK_ID,
  ).address;
}

export async function getPaymentKeyHash(wallet: MeshWallet): Promise<string> {
  const address = (await wallet.getUsedAddresses())[0] ??
    (await wallet.getUnusedAddresses())[0] ??
    (await wallet.getChangeAddress());
  return resolvePaymentKeyHash(address);
}

/**
 * Shape of the inline datum we attach to script-locked UTxOs.
 * Matches the Aiken `Datum` type in validators/escrow.ak:
 *   pub type Datum {
 *     payer: VerificationKeyHash,    // 28-byte hex
 *     provider: VerificationKeyHash, // 28-byte hex
 *     deadline: Int,                 // POSIX milliseconds
 *   }
 * `deserializeDatum<EscrowDatum>(plutusData)` returns this shape.
 */
export interface EscrowDatum {
  fields: [{ bytes: string }, { bytes: string }, { int: number }];
}

/**
 * Reference-script record produced by `publish-script.ts`. Mirrors what
 * Hardhat Ignition stores in `deployed_addresses.json` — the public
 * artefact of "where on-chain does the code live".
 */
export interface ScriptRef {
  txHash: string;
  outputIndex: number;
  scriptHash: string;
  validatorTitle: string;
  network: "preview" | "preprod" | "mainnet";
  publishedAt: string;
}

export function loadScriptRef(): ScriptRef {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const refPath = path.resolve(here, "..", "script-ref.json");
  if (!fs.existsSync(refPath)) {
    throw new Error(
      "script-ref.json not found. Run `npm run publish-script` first " +
      "to publish the validator on-chain as a reference UTxO.",
    );
  }
  return JSON.parse(fs.readFileSync(refPath, "utf8"));
}

const KOIOS_BASE_BY_NETWORK: Record<string, string> = {
  preview: "https://preview.koios.rest/api/v1",
  preprod: "https://preprod.koios.rest/api/v1",
  mainnet: "https://api.koios.rest/api/v1",
};

/**
 * Current on-chain Plutus cost models, ordered as `[V1, V2, V3]`.
 *
 * Why this exists: Mesh's transaction serializer otherwise computes the
 * `script_data_hash` from a hardcoded, outdated PlutusV3 cost model (297
 * params) that no longer matches preprod's live model (350 params). The
 * ledger recomputes the hash with the real model, the two disagree, and any
 * script-spending tx (claim/refund) is rejected with `ScriptIntegrityHashMismatch`.
 * (Lock executes no script, so it carries no script_data_hash and is immune.)
 *
 * Blockfrost's Mesh provider drops `cost_models` from `fetchProtocolParameters`,
 * so we fetch the live, canonically-ordered arrays from Koios and feed them to
 * `txBuilder.setCostModels(...)`.
 */
export async function getCostModels(): Promise<[number[], number[], number[]]> {
  const base = KOIOS_BASE_BY_NETWORK[NETWORK];
  if (!base) throw new Error(`No Koios endpoint configured for network "${NETWORK}".`);
  const res = await fetch(`${base}/epoch_params`);
  if (!res.ok) {
    throw new Error(`Koios epoch_params request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as Array<{ cost_models?: Record<string, number[]> }>;
  const cm = data?.[0]?.cost_models;
  if (!cm?.PlutusV1 || !cm?.PlutusV2 || !cm?.PlutusV3) {
    throw new Error("Koios epoch_params response did not include cost_models.");
  }
  return [cm.PlutusV1, cm.PlutusV2, cm.PlutusV3];
}

/**
 * Slot just before `deadlineMs` — used as `.invalidHereafter(...)` for
 * Claim, so the validator's `is_entirely_before(validity_range, deadline)`
 * check passes. A 1-second safety margin avoids edge-of-slot issues and
 * minor wall-clock drift between caller and node.
 */
export function slotBeforeDeadline(deadlineMs: number): number {
  const ms = deadlineMs - TIME_MARGIN_MS;
  return unixTimeToEnclosingSlot(ms, SLOT_CONFIG);
}

/**
 * Slot just after `deadlineMs` — used as `.invalidBefore(...)` for
 * Refund, so the validator's `is_entirely_after(validity_range, deadline)`
 * check passes. Symmetric counterpart of `slotBeforeDeadline`.
 */
export function slotAfterDeadline(deadlineMs: number): number {
  const ms = deadlineMs + TIME_MARGIN_MS;
  return unixTimeToEnclosingSlot(ms, SLOT_CONFIG);
}
