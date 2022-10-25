let SDK = require('../index')
let mnemonics = require("./getMnemonics")
async function main() {
    let collectibleSwap = "0xd39111acba9f96a14150674b359d564e566f8057143a0593723fe753fc67c3b2"
    const NODE_URL = "https://fullnode.testnet.aptoslabs.com";
    const FAUCET_URL = "https://faucet.testnet.aptoslabs.com";
    let sdk = await SDK.createInstance("testnet", NODE_URL, FAUCET_URL, collectibleSwap)
    let aptosAccount = sdk.getAptosAccount({mnemonics: mnemonics})
    await sdk.initializeTxBuilder(aptosAccount.address())
    
    let payload = await sdk.createCreateCollectionCoinTypeFunctionPayload(
        "https://api-aptos-testnet.collectibleswap.io/",
        "CollectionTest1",
        aptosAccount.address().hex()
    )
    let txHash = await sdk.submitTransaction(aptosAccount, payload)
    console.log(txHash)
    process.exit(0)
}

main()