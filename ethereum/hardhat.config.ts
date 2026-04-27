import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
// Deployer key — used only by `hardhat ignition deploy`. Action scripts
// read their own keys explicitly (PAYER_PRIVATE_KEY, PROVIDER_PRIVATE_KEY).
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;

const networks: Record<string, any> = {
  hardhat: {
    type: "edr-simulated",
    chainType: "l1",
  },
};

if (SEPOLIA_RPC_URL && SEPOLIA_PRIVATE_KEY) {
  networks.sepolia = {
    type: "http",
    chainType: "l1",
    url: SEPOLIA_RPC_URL,
    accounts: [SEPOLIA_PRIVATE_KEY],
  };
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  networks,
});
