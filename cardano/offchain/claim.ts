// Spends a locked UTxO with the Claim redeemer (provider takes the funds).
// The transaction must be valid strictly before the datum's deadline,
// and signed by the provider key.
//
// Usage:
//   tsx claim.ts <lockTxHash> [outputIndex]
//   (outputIndex defaults to the first script-address output of that tx)

import {
  MeshTxBuilder,
  deserializeDatum,
  unixTimeToEnclosingSlot,
  SLOT_CONFIG_NETWORK,
  mConStr0,
} from "@meshsdk/core";
import { getWallet, getScriptAddress, getScriptCbor, getPaymentKeyHash } from "./common.js";

const [lockTxHash, outputIndexArg] = process.argv.slice(2);
if (!lockTxHash) {
  console.error("Usage: tsx claim.ts <lockTxHash> [outputIndex]");
  process.exit(1);
}

const { provider, wallet } = await getWallet("provider");
const providerAddress = await wallet.getChangeAddress();
const providerPkh = await getPaymentKeyHash(wallet);
const scriptAddress = getScriptAddress();
const scriptCbor = getScriptCbor();

// Find the script-address output of the lock tx.
const txUtxos = await provider.fetchUTxOs(lockTxHash);
const candidate = outputIndexArg
  ? txUtxos.find((u) => u.input.outputIndex === Number(outputIndexArg))
  : txUtxos.find((u) => u.output.address === scriptAddress);
if (!candidate) {
  throw new Error(
    `No script UTxO found at ${scriptAddress} in tx ${lockTxHash}. ` +
      `Outputs: ${JSON.stringify(txUtxos.map((u) => u.output.address))}`,
  );
}

const datumPlutus = candidate.output.plutusData;
if (!datumPlutus) throw new Error("Script UTxO has no inline datum.");

interface EscrowDatum {
  fields: [{ bytes: string }, { bytes: string }, { int: number }];
}
const datum = deserializeDatum<EscrowDatum>(datumPlutus);
const datumPayer = datum.fields[0].bytes;
const datumProvider = datum.fields[1].bytes;
const deadlineMs = Number(datum.fields[2].int);

if (datumProvider !== providerPkh) {
  throw new Error(
    `Datum provider hash (${datumProvider}) does not match wallet (${providerPkh}).`,
  );
}

const nowMs = Date.now();
if (nowMs >= deadlineMs) {
  throw new Error(
    `Deadline already passed: now=${new Date(nowMs).toISOString()} ` +
      `deadline=${new Date(deadlineMs).toISOString()}. Use refund.ts instead.`,
  );
}

// Validity-range upper bound must be strictly before deadline so the script's
// is_entirely_before(deadline) check passes. Subtract 1s of safety margin.
const upperUnixSec = Math.floor((deadlineMs - 1000) / 1000);
const invalidHereafter = unixTimeToEnclosingSlot(
  upperUnixSec,
  SLOT_CONFIG_NETWORK.preview,
);

const utxos = await wallet.getUtxos();
const collateral = await wallet.getCollateral();
if (collateral.length === 0) {
  throw new Error(
    "Provider wallet has no collateral. Run wallet.createCollateral() once " +
      "or fund a separate 5-ADA UTxO and tag it as collateral.",
  );
}

const txBuilder = new MeshTxBuilder({
  fetcher: provider,
  submitter: provider,
  evaluator: provider,
});

const unsignedTx = await txBuilder
  .spendingPlutusScriptV3()
  .txIn(
    candidate.input.txHash,
    candidate.input.outputIndex,
    candidate.output.amount,
    candidate.output.address,
  )
  .txInScript(scriptCbor)
  .txInInlineDatumPresent()
  .txInRedeemerValue(mConStr0([])) // Claim = constructor index 0
  .txInCollateral(
    collateral[0].input.txHash,
    collateral[0].input.outputIndex,
    collateral[0].output.amount,
    collateral[0].output.address,
  )
  .invalidHereafter(invalidHereafter)
  .requiredSignerHash(providerPkh)
  .changeAddress(providerAddress)
  .selectUtxosFrom(utxos)
  .complete();

const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);

console.log("CLAIM TX SUBMITTED");
console.log("Datum payer PKH: ", datumPayer);
console.log("Tx hash:         ", txHash);
console.log("Cardanoscan:     ", `https://preview.cardanoscan.io/transaction/${txHash}`);
