import { getWallet, NETWORK } from "./common.js";

async function show(role: "admin" | "payer" | "provider") {
  try {
    const { wallet } = await getWallet(role);
    const address = await wallet.getChangeAddress();
    const balance = await wallet.getBalance();
    const lovelace =
      balance.find((b) => b.unit === "lovelace")?.quantity ?? "0";
    const ada = (Number(lovelace) / 1_000_000).toFixed(2);
    console.log(`${role.padEnd(8)} ${address}   (${ada} tADA)`);
  } catch (e: any) {
    console.log(`${role.padEnd(8)} <error: ${e.message}>`);
  }
}

console.log(`${NETWORK} wallets:`);
await show("admin");
await show("payer");
await show("provider");
console.log("\nFund all three at:");
console.log(`  https://docs.cardano.org/cardano-testnets/tools/faucet (choose ${NETWORK[0].toUpperCase() + NETWORK.slice(1)})`);
