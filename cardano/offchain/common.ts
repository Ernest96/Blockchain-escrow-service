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
} from "@meshsdk/core";

const NETWORK_ID = 0; // 0 = testnet

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key} (see .env.example)`);
  return v;
}

export function getProvider() {
  return new BlockfrostProvider(requireEnv("BLOCKFROST_PROJECT_ID"));
}

export async function getWallet(role: "payer" | "provider") {
  const provider = getProvider();
  const envKey = role === "payer" ? "PAYER_MNEMONIC" : "PROVIDER_MNEMONIC";
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
  // Aiken's compiledCode is a hex-encoded flat-Plutus blob.
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
