// Imports
const crypto = require("crypto");
const {
  initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");
require("dotenv").config();
const forge = require("node-forge");

// Setup developer sdk
const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
  apiKey: `${process.env.API_KEY}`,
  entitySecret: `${process.env.ENTITY_SECRET}`, // Make sure to enter the entity secret from the step above.
});

// Generate a random secret
const generate_secret = () => {
  const secret = crypto.randomBytes(32).toString("hex");
  return secret;
};

// Fetch public key
const fetch_public_key = async (secret) => {
  const local_circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
    apiKey: `${process.env.API_KEY}`,
    entitySecret: secret, // Make sure to enter the entity secret from the step above.
  });

  const response = await local_circleDeveloperSdk.getPublicKey({});
  return response.data.publicKey;
};

// Generate ciphertext
const generate_ciphertext = async (secret) => {
  const entitySecret = forge.util.hexToBytes(secret);
  const publicKey = forge.pki.publicKeyFromPem(await fetch_public_key(secret));
  const encryptedData = publicKey.encrypt(entitySecret, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha256.create(),
    },
  });
  console.log("encryptedData:", forge.util.encode64(encryptedData));
  return forge.util.encode64(encryptedData);
};

// Create Wallet Set
const create_wallet_set = async () => {
  const response = await circleDeveloperSdk.createWalletSet({
    name: "Set 1",
  });
  console.log("response:", response);
};

// Create Wallet Set
const create_wallet = async () => {
  const response = await circleDeveloperSdk.createWallets({
    accountType: "SCA",
    blockchains: ["MATIC-AMOY"],
    count: 2,
    walletSetId: `${process.env.WALLET_SET_ID}`,
  });

  console.log(response.data.wallets);
};

// Get Wallets
const get_wallets = async () => {
  try {
    const response = await circleDeveloperSdk.listWallets({});
    console.log(response.data.wallets);
  } catch (error) {
    console.log("error:", error);
  }
};

// Get Specific Wallet
const get_wallet = async () => {
  try {
    const response = await circleDeveloperSdk.getWallet({
      id: `${process.env.WALLET_ID_1}`,
    });
    console.log(response.data);
  } catch (error) {
    console.log("error:", error);
  }
};

// List wallet transactions
const wallet_transactions = async () => {
  const response = await circleDeveloperSdk.listTransactions({
    walletIds: [`${process.env.WALLET_ID_1}`],
  });

  console.log("response: ", response.data);
  console.log("amount: ", response.data.transactions[0].amounts);
};

// Get wallet balance
const get_balance = async () => {
  const response = await circleDeveloperSdk.getWalletTokenBalance({
    id: `${process.env.WALLET_ID_1}`,
  });

  console.log("response: ", response.data);
  console.log("Matic token id: ", response.data.tokenBalances[0].token.id);
  console.log("USDC token id: ", response.data.tokenBalances[1].token.id);
};

// Transfer Token
const transfer_token = async () => {
  const response = await circleDeveloperSdk.createTransaction({
    walletId: `${process.env.WALLET_ID_1}`,
    tokenId: `${process.env.USDC_TOKEN_ID}`,
    destinationAddress: `${process.env.WALLET_ADDRESS_2}`,
    amounts: [".01"],
    fee: {
      type: "level",
      config: {
        feeLevel: "MEDIUM",
      },
    },
  });

  console.log("response: ", response.data);
};

// Check transafer state
const check_transfer_state = async (id) => {
  const response = await circleDeveloperSdk.getTransaction({
    id: id,
  });

  console.log("response: ", response.data);
};

// Exports
module.exports = {
  generate_secret,
  generate_ciphertext,
  create_wallet_set,
  create_wallet,
  get_wallets,
  get_wallet,
  wallet_transactions,
  get_balance,
  transfer_token,
  check_transfer_state,
};
