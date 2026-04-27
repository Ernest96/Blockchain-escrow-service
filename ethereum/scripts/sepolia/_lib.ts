// Shared helpers for the Sepolia action scripts.
//
// Action-specific logic (lockDeal / claimDeal / refundDeal) lives in
// lock.ts / claim.ts / refund.ts. This file only holds plumbing that all
// three need: address resolution, signer setup, and a small URL helper.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

const SEPOLIA_CHAIN_ID = 11155111;
const IGNITION_DEPLOYMENTS = `ignition/deployments/chain-${SEPOLIA_CHAIN_ID}/deployed_addresses.json`;

/**
 * Resolves the deployed Escrow address. Priority:
 *   1. `ESCROW_ADDRESS` env var (lets you point at any deployment).
 *   2. Hardhat Ignition's deployments file (auto-populated by `deploy:sepolia`).
 */
export function loadEscrowAddress(): string {
  const fromEnv = process.env.ESCROW_ADDRESS;
  if (fromEnv) return fromEnv;
  if (fs.existsSync(IGNITION_DEPLOYMENTS)) {
    const data = JSON.parse(fs.readFileSync(IGNITION_DEPLOYMENTS, "utf8"));
    const addr = data["EscrowModule#Escrow"];
    if (addr) return addr;
  }
  throw new Error(
    "Escrow address not found.\n" +
      "  Either deploy first: npm run deploy:sepolia\n" +
      "  Or set ESCROW_ADDRESS in .env",
  );
}

/**
 * Connects to the configured network and resolves the payer / provider signers.
 * Payer comes from `SEPOLIA_PRIVATE_KEY` (the Hardhat default signer).
 * Provider comes from `PROVIDER_PRIVATE_KEY` (a second funded testnet key).
 */
export async function getContext() {
  const { ethers } = await network.connect();
  const [payer] = await ethers.getSigners();
  const providerKey = process.env.PROVIDER_PRIVATE_KEY;
  if (!providerKey) {
    throw new Error("PROVIDER_PRIVATE_KEY not set in .env");
  }
  const provider = new ethers.Wallet(providerKey, ethers.provider);
  const escrow = await ethers.getContractAt("Escrow", loadEscrowAddress(), payer);
  return { ethers, payer, provider, escrow };
}

export const etherscanTx = (hash: string) =>
  `https://sepolia.etherscan.io/tx/${hash}`;

/**
 * True when the current module is being executed as the script entry-point
 * (e.g. via `npx hardhat run scripts/sepolia/lock.ts`), false when it's been
 * imported by another module (e.g. smoke.ts importing lockDeal).
 */
export function isEntryPoint(metaUrl: string): boolean {
  return process.argv[1] === fileURLToPath(metaUrl);
}
