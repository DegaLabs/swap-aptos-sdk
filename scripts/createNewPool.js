let SDK = require('../index')
let mnemonics = require("./getMnemonics")
async function main() {
    let collectibleSwap = "0xd39111acba9f96a14150674b359d564e566f8057143a0593723fe753fc67c3b2"
    const NODE_URL = "https://fullnode.testnet.aptoslabs.com";
    const FAUCET_URL = "https://faucet.testnet.aptoslabs.com";
    let sdk = await SDK.createInstance("devnet", NODE_URL, FAUCET_URL, collectibleSwap)
    let aptosAccount = sdk.getAptosAccount({mnemonics: mnemonics})
    await sdk.initializeTxBuilder(aptosAccount.address())
    
    let nfts = await sdk.wallet.getTokens(aptosAccount.address())
    //console.log('nfts', nfts)
    let payload = await sdk.createNewPoolFunctionPayload(
        "0x1::aptos_coin::AptosCoin",
        "CloneX",
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd",
        1500000,
        1,
        2,
        "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd",
        20000,
        0
    )
    
    let txHash = await sdk.submitTransaction(aptosAccount, payload)

    console.log(txHash)
    process.exit(0)
}

main()