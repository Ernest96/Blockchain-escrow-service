// Prints the script address for the compiled escrow validator.
// Useful as a sanity check before doing anything on-chain.
//
//   tsx address.ts

import { getScriptAddress, loadValidator } from "./common.js";

const v = loadValidator();
console.log("Validator:        ", v.title);
console.log("Script hash:      ", v.hash);
console.log("Script address:   ", getScriptAddress(), "(network 0 = Preview)");
