import {
  BlockfrostProvider,
  MeshWallet,
  resolvePaymentKeyHash,
} from "@meshsdk/core";

const NETWORK_ID = 0; // 0 = testnet (Preprod/Preprod)

const dummyProvider = new BlockfrostProvider("preview_offline_unused");

const count = Number(process.argv[2] ?? "5");
if (!Number.isInteger(count) || count < 1 || count > 20) {
  console.error("Usage: tsx brew-wallets.ts [count between 1 and 20, default 5]");
  process.exit(1);
}

console.log(
  `Generating ${count} fresh Cardano wallet(s) for the Preprod testnet.\n` +
    `These are NEW mnemonics — never use them on mainnet.\n`,
);

for (let i = 1; i <= count; i++) {
  const words = MeshWallet.brew() as string[];

  const wallet = new MeshWallet({
    networkId: NETWORK_ID,
    fetcher: dummyProvider,
    submitter: dummyProvider,
    key: { type: "mnemonic", words },
  });
  await wallet.init();

  const address = await wallet.getChangeAddress();
  const pkh = resolvePaymentKeyHash(address);

  console.log(`# --- wallet ${i} ---`);
  console.log(`# address:  ${address}`);
  console.log(`# pkh:      ${pkh}`);
  console.log(`WALLET_${i}_MNEMONIC="${words.join(" ")}"`);
  console.log();
}

console.log("---");
console.log("Next steps:");
console.log(
  "  1. Pick two of these as PAYER_MNEMONIC and PROVIDER_MNEMONIC in",
);
console.log("     cardano/offchain/.env. Keep the rest for axis-3 (concurrency).");
console.log(
  "  2. Fund every address you plan to use at the Preprod faucet:",
);
console.log("     https://docs.cardano.org/cardano-testnets/tools/faucet");
console.log(
  "  3. Set collateral on payer + provider (via Lace UI, or run",
);
console.log("     `npm run setup-collateral payer` and `... provider`).");
