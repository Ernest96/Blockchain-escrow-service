import { getWalletByEnvKey, cardanoscanTxUrl } from "./common.js";

const envKey = process.argv[2];
if (envKey === undefined || envKey === null) {
  console.error("no envKey");
  process.exit(1);
}

const { wallet } = await getWalletByEnvKey(envKey);
const address = await wallet.getChangeAddress();
console.log(`${envKey} address:    `, address);

const collateral = await wallet.getCollateral();
if (collateral.length > 0) {
  console.log("Collateral already exists:", collateral[0].input.txHash);
  process.exit(0);
}

console.log("Creating collateral (5 ADA)…");
const txHash = await wallet.createCollateral();
console.log("Collateral tx:    ", txHash);
console.log("Cardanoscan:      ", cardanoscanTxUrl(txHash));
