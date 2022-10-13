let SDK = require('../index')
let mnemonics = require("./getMnemonics")
async function main() {
    let collectibleSwap = "0xd39111acba9f96a14150674b359d564e566f8057143a0593723fe753fc67c3b2"
    const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
    const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
    let sdk = new SDK(NODE_URL, FAUCET_URL, collectibleSwap)
    let aptosAccount = sdk.getAptosAccount({mnemonics: mnemonics})
    
    let payload = await sdk.createNewPoolFunctionPayload(
        aptosAccount.address(),
        "0x1::aptos_coin::AptosCoin",
        "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd::collection_type_clonex::CollectionTypeCloneX",
        "CloneX",
        ["1", "2", "3", "4", "5", "6", "7"],
        "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd",
        1000000,
        0,
        2,
        "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd",
        10000,
        0
    )
    
    let txHash = await sdk.submitTransaction(aptosAccount, payload)

    console.log(txHash)
    process.exit(0)
}

main()