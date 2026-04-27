// Spends a locked UTxO with the Refund redeemer (payer reclaims the funds).
// The transaction must be valid strictly after the datum's deadline,
// and signed by the payer key.
//
// Usage:
//   tsx refund.ts <lockTxHash> [outputIndex]

import {
  MeshTxBuilder,
  deserializeDatum,
  unixTimeToEnclosingSlot,
  SLOT_CONFIG_NETWORK,
  mConStr1,
} from "@meshsdk/core";
import { getWallet, getScriptAddress, getScriptCbor, getPaymentKeyHash } from "./common.js";

const [lockTxHash, outputIndexArg] = process.argv.slice(2);
if (!lockTxHash) {
  console.error("Usage: tsx refund.ts <lockTxHash> [outputIndex]");
  process.exit(1);
}

const { provider, wallet } = await getWallet("payer");
const payerAddress = await wallet.getChangeAddress();
const payerPkh = await getPaymentKeyHash(wallet);
const scriptAddress = getScriptAddress();
const scriptCbor = getScriptCbor();

const txUtxos = await provider.fetchUTxOs(lockTxHash);
const candidate = outputIndexArg
  ? txUtxos.find((u) => u.input.outputIndex === Number(outputIndexArg))
  : txUtxos.find((u) => u.output.address === scriptAddress);
if (!candidate) {
  throw new Error(
    `No script UTxO found at ${scriptAddress} in tx ${lockTxHash}.`,
  );
}

const datumPlutus = candidate.output.plutusData;
if (!datumPlutus) throw new Error("Script UTxO has no inline datum.");

interface EscrowDatum {
  fields: [{ bytes: string }, { bytes: string }, { int: number }];
}
const datum = deserializeDatum<EscrowDatum>(datumPlutus);
const datumPayer = datum.fields[0].bytes;
const deadlineMs = Number(datum.fields[2].int);

if (datumPayer !== payerPkh) {
  throw new Error(
    `Datum payer hash (${datumPayer}) does not match wallet (${payerPkh}).`,
  );
}

const nowMs = Date.now();
if (nowMs < deadlineMs) {
  throw new Error(
    `Deadline has not passed yet: now=${new Date(nowMs).toISOString()} ` +
      `deadline=${new Date(deadlineMs).toISOString()}.`,
  );
}

// Validity-range lower bound must be strictly after deadline so the script's
// is_entirely_after(deadline) check passes. Add 1s of safety margin.
const lowerUnixSec = Math.floor((deadlineMs + 1000) / 1000);
const invalidBefore = unixTimeToEnclosingSlot(
  lowerUnixSec,
  SLOT_CONFIG_NETWORK.preview,
);

const utxos = await wallet.getUtxos();
const collateral = await wallet.getCollateral();
if (collateral.length === 0) {
  throw new Error(
    "Payer wallet has no collateral. Run wallet.createCollateral() first.",
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
  .txInRedeemerValue(mConStr1([])) // Refund = constructor index 1
  .txInCollateral(
    collateral[0].input.txHash,
    collateral[0].input.outputIndex,
    collateral[0].output.amount,
    collateral[0].output.address,
  )
  .invalidBefore(invalidBefore)
  .requiredSignerHash(payerPkh)
  .changeAddress(payerAddress)
  .selectUtxosFrom(utxos)
  .complete();

const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);

console.log("REFUND TX SUBMITTED");
console.log("Tx hash:         ", txHash);
console.log("Cardanoscan:     ", `https://preview.cardanoscan.io/transaction/${txHash}`);
