// Locks ETH at the deployed Escrow on Sepolia.
//
// Required env: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, PROVIDER_PRIVATE_KEY
// Optional env: LOCK_AMOUNT_ETH (default 0.001), LOCK_DEADLINE_MIN (default 30),
//               ESCROW_ADDRESS (auto-read from Ignition deployments otherwise).
//
// Run: npx hardhat run scripts/sepolia/lock.ts --network sepolia

import { getContext, etherscanTx, isEntryPoint } from "./_lib.js";

/**
 * Locks `amountEth` ETH for the provider with a deadline `deadlineMin` minutes
 * from now. Returns the new deal id and the lock tx hash.
 */
export async function lockDeal(opts: {
  amountEth?: string;
  deadlineMin?: number;
} = {}): Promise<{ dealId: bigint; txHash: string }> {
  const amountEth = opts.amountEth ?? process.env.LOCK_AMOUNT_ETH ?? "0.001";
  const deadlineMin = Number(
    opts.deadlineMin ?? process.env.LOCK_DEADLINE_MIN ?? "30",
  );

  const { ethers, payer, provider, escrow } = await getContext();
  const amount = ethers.parseEther(amountEth);
  const deadline = Math.floor(Date.now() / 1000) + deadlineMin * 60;

  console.log(`Payer:        ${payer.address}`);
  console.log(`Provider:     ${provider.address}`);
  console.log(`Amount:       ${amountEth} ETH`);
  console.log(`Deadline:     ${new Date(deadline * 1000).toISOString()}`);

  const tx = await escrow.lock(provider.address, deadline, { value: amount });
  console.log(`\nlock tx:      ${tx.hash}`);
  console.log(`etherscan:    ${etherscanTx(tx.hash)}`);
  const receipt = await tx.wait();

  const lockEvent = receipt!.logs
    .map((l) => {
      try {
        return escrow.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "Locked");
  const dealId = lockEvent?.args[0] as bigint;

  console.log(`deal id:      ${dealId.toString()}`);
  console.log(`gas used:     ${receipt!.gasUsed.toString()}`);
  return { dealId, txHash: tx.hash };
}

if (isEntryPoint(import.meta.url)) {
  await lockDeal();
}
