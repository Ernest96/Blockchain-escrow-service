import fs from "node:fs";
import { network } from "hardhat";

const SEPOLIA_CHAIN_ID = 11155111;
const IGNITION_DEPLOYMENTS = `ignition/deployments/chain-${SEPOLIA_CHAIN_ID}/deployed_addresses.json`;

export function loadEscrowAddress(): string {
  const fromEnv = process.env.ESCROW_ADDRESS;
  if (fromEnv) return fromEnv;
  if (fs.existsSync(IGNITION_DEPLOYMENTS)) {
    const data = JSON.parse(fs.readFileSync(IGNITION_DEPLOYMENTS, "utf8"));
    const addr = data["EscrowModule#Escrow"];
    return addr;
  }
  throw new Error("Escrow address not found.\n");
}

export async function getContext() {
  const { ethers } = await network.connect();

  const payerKey = process.env.PAYER_PRIVATE_KEY;
  if (!payerKey) throw new Error("PAYER_PRIVATE_KEY not set in .env");
  const payer = new ethers.Wallet(payerKey, ethers.provider);

  const providerKey = process.env.PROVIDER_PRIVATE_KEY;
  if (!providerKey) throw new Error("PROVIDER_PRIVATE_KEY not set in .env");
  const provider = new ethers.Wallet(providerKey, ethers.provider);

  const escrow = await ethers.getContractAt("Escrow", loadEscrowAddress());
  return { ethers, payer, provider, escrow };
}

export const etherscanTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;