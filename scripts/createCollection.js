const Aptos = require('aptos')
const {
  AptosClient,
  AptosAccount,
  FaucetClient,
  BCS,
  TxnBuilderTypes,
} = Aptos;
const getMnemonics = require('./getMnemonics')

let AptosWeb3 = require('../dist/wallet_client')

// devnet is used here for testing
const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

let collectionName = "GFC"
let collectionDescription = "Faucet " + collectionName
let collectionURL = "Fake URL " + collectionName
async function main() {
  // Generates key pair for Alice
  let mnemonics = getMnemonics
  const wallet = new AptosWeb3.WalletClient(NODE_URL, FAUCET_URL)
  let aptosAccount = await AptosWeb3.WalletClient.getAccountFromMnemonic(mnemonics)
  let addr = aptosAccount.address()
  console.log("addr", aptosAccount.address());
  // Creates Alice's account and mint 5000 test coins
  // await faucetClient.fundAccount(alice.address(), 5000);
  let collection = null
  try {
    collection = await wallet.getCollection(addr, collectionName)
  } catch (e) {
    console.log("no collection")
  }
  if (!collection) {
    await wallet.createCollection(aptosAccount, collectionName, collectionDescription, collectionURL)
    console.log("collection created")
  } else {
    console.log("collection already exists")
  }

  process.exit(0);
}

main();
