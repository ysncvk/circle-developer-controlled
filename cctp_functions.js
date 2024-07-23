const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const { generate_ciphertext } = require("./helper_functions.js");
const Web3 = require("web3").default;

const web3 = new Web3(
  "https://sepolia.infura.io/v3/2925d9a9561b4f5cbd76023e3e6af296"
);

const get_cipher_text = async () => {
  let ciphertext = generate_ciphertext(`${process.env.ENTITY_SECRET}`);
  return ciphertext;
};

const approve_usdc = async () => {
  const ciphertext = await get_cipher_text();

  const url =
    "https://api.circle.com/v1/w3s/developer/transactions/contractExecution";
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [`${process.env.TOKEN_MESSENGER_ADDRESS}`, "100000000"],
      idempotencyKey: uuidv4(),
      contractAddress: `${process.env.CONTRACT_ADDRESS}`,
      feeLevel: "HIGH",
      walletId: `${process.env.CCTP_SENDER_WALLET_ID}`,
      entitySecretCiphertext: ciphertext,
    }),
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => console.log(json))
    .catch((err) => console.error("error:" + err));
};

const burn_usdc = async () => {
  const ciphertext = await get_cipher_text();

  const encodedDestinationAddress = web3.eth.abi.encodeParameter(
    "address",
    `${process.env.CCTP_RECEIVER_ADDRESS}`
  );

  console.log("encoded address", encodedDestinationAddress);

  const data = {
    abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
    abiParameters: [
      "1000000",
      "7",
      `${encodedDestinationAddress}`,
      `${process.env.CONTRACT_ADDRESS}`,
    ],
    idempotencyKey: uuidv4(),
    contractAddress: `${process.env.TOKEN_MESSENGER_ADDRESS}`,
    feeLevel: "MEDIUM",
    walletId: `${process.env.CCTP_SENDER_WALLET_ID}`,
    entitySecretCiphertext: ciphertext,
  };

  fetch(
    "https://api.circle.com/v1/w3s/developer/transactions/contractExecution",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => {
      console.error("Error:", error);
    });
};

const fetch_deposit_transaction = async () => {
  const url = `https://api.circle.com/v1/w3s/transactions/${process.env.BURN_TRANSACTION_ID}`;
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
  };

  return fetch(url, options)
    .then((res) => res.json())
    .then((json) => {
      return json.data.transaction;
    })
    .catch((err) => console.error("error:" + err));
};

const get_attestation = async () => {
  // 1 - Fetching the deposit transaction object from programmable wallets
  let transaction = await fetch_deposit_transaction();
  console.log("transaction", transaction);

  // 2 - Decoding and Creating messageBytes and messageHash with a Web3 Library
  // Get messageBytes from EVM logs using tx_hash of thetransaction.
  const transactionReceipt = await web3.eth.getTransactionReceipt(
    transaction.txHash
  );
  const eventTopic = web3.utils.keccak256("MessageSent(bytes)");
  const log = transactionReceipt.logs.find((l) => l.topics[0] === eventTopic);
  const messageBytes = web3.eth.abi.decodeParameters(["bytes"], log.data)[0];
  const messageHash = web3.utils.keccak256(messageBytes);

  // 3 - Fetch Attestation Signature from Circle's Iris API
  // Get attestation signature from iris-api.circle.com
  let attestationResponse = { status: "pending" };
  while (attestationResponse.status != "complete") {
    const response = await fetch(
      `https://iris-api-sandbox.circle.com/attestations/${messageHash}`
    );
    attestationResponse = await response.json();
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("messageBytes: ", messageBytes);
  console.log("attestationResponse: ", attestationResponse);
  return {
    messageBytes: messageBytes,
    attestation: attestationResponse.attestation,
  };
};

const mint_usdc = async () => {
  const ciphertext = await get_cipher_text();

  const attestation_variables = await get_attestation();

  const url =
    "https://api.circle.com/v1/w3s/developer/transactions/contractExecution";
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({
      abiFunctionSignature: "receiveMessage(bytes,bytes)",
      abiParameters: [
        `${attestation_variables.messageBytes}`,
        `${attestation_variables.attestation}`,
      ],
      idempotencyKey: `${uuidv4()}`,
      contractAddress: `${process.env.MESSAGE_TRANSMITTER_ADDRESS}`,
      feeLevel: "MEDIUM",
      walletId: `${process.env.CCTP_RECEIVER_WALLET_ID}`,
      entitySecretCiphertext: ciphertext,
    }),
  };

  fetch(url, options)
    .then((res) => res.json())
    .then((json) => console.log(json))
    .catch((err) => console.error("error:" + err));
};

module.exports = {
  approve_usdc,
  burn_usdc,
  get_attestation,
  mint_usdc,
};
