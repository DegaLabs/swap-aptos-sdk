let SDK = require('../index')

async function main() {
    const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
    const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
    let sdk = new SDK(NODE_URL, FAUCET_URL)
    let nfts = await sdk.getNFTs("0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd")
    console.log(nfts)
    process.exit(0)
}

main()