const Aptos = require('aptos')
const {
  AptosClient,
  AptosAccount,
  FaucetClient,
  BCS,
  TxnBuilderTypes,
} = Aptos;
const getMnemonics = require('./getMnemonics')

let AptosWeb3 = require('../dist/wallet_client');
const { default: axios } = require('axios');

// devnet is used here for testing
const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

let collectionName = process.argv[2]
let from = parseInt(process.argv[3])
let to = parseInt(process.argv[4])

let baseUris = {
  CloneX: "https://clonex-assets.rtfkt.com/",
  GFC: "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/"
}

let baseUri = baseUris[collectionName]
if (!baseUri) {
  console.error("invalid collection name")
  process.exit(1)
}

const sleep = async function (s) { await new Promise(resolve => setTimeout(resolve, s * 1000)) }

async function main() {
  // Generates key pair for Alice
  let mnemonics = getMnemonics
  const wallet = new AptosWeb3.WalletClient(NODE_URL, FAUCET_URL)
  let aptosAccount = await AptosWeb3.WalletClient.getAccountFromMnemonic(mnemonics)
  let addr = aptosAccount.address()
  console.log("addr", aptosAccount.address(), from, to);

  for (var i = from; i <= to; i++) {
    try {
      let metadataUri = baseUri + i
      if (metadataUri.startsWith("ipfs://")) {
        metadataUri = metadataUri.substring("ipfs://".length)
        metadataUri = "https://gateway.ipfs.io/ipfs/" + metadataUri
      }
      let metadata = await axios.get(metadataUri)
      let uri = metadata.data.image
      console.log('uri', uri)
      await wallet.createToken(aptosAccount, collectionName, `${i}`, `Token ${i}`, 1, uri)
      await sleep(5)
      aptosAccount = await AptosWeb3.WalletClient.getAccountFromMnemonic(mnemonics)
      console.log('success create token', i)
    } catch (e) {
      console.error("error in creating nft", i, e)
    }
  }

  process.exit(0);
}

try {
  main();
} catch (e) {
  console.log(e)
}