let SDK = require('../index')
let mnemonics = require("./getMnemonics")
async function main() {
    let collectibleSwap = "0xd39111acba9f96a14150674b359d564e566f8057143a0593723fe753fc67c3b2"
    const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
    const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
    let sdk = await SDK.createInstance("devnet", NODE_URL, FAUCET_URL, collectibleSwap)
    let aptosAccount = sdk.getAptosAccount({mnemonics: mnemonics})
    let aptosCoin = "0x1::aptos_coin::AptosCoin"
    await sdk.initializeTxBuilder(aptosAccount.address())
    let removal = sdk.estimateLiquidityRemoval(aptosCoin, "CloneX", "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd", 2000)
    console.log('coinamoint', removal)
    let txHash = await sdk.removeLiquidity(
        aptosAccount,
        aptosCoin,
        "CloneX",
        "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd",
        2000,
        0,
        removal.numItems
    )
    
    console.log(txHash)
    process.exit(0)
}

main()