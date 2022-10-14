const UTILS = {
    getPoolTokenIds: async (walletClient, pool, collectibleSwap, poolAddress) => {
        const depositCount = {};
        const tokenDepositForClaim = {};
        let eventStore = `${collectibleSwap}::pool::EventsStore<${pool.data.coinType}, ${pool.data.collectionCoinType}>`;
        let start = pool.liquidityAddedEventsStart ? pool.liquidityAddedEventsStart : 0;
        const liquidityAddedEvents = await walletClient.getEventStream(poolAddress, eventStore, "liquidity_added_handle", null, start);
        let liquidityAddedEventsStart = start + liquidityAddedEvents.length;
        start = pool.liquidityRemovedEventsStart ? pool.liquidityRemovedEventsStart : 0;
        const liquidityRemovedEvents = await walletClient.getEventStream(poolAddress, eventStore, "liquidity_removed_handle", null, start);
        let liquidityRemovedEventsStart = start + liquidityRemovedEvents.length;
        start = pool.swapCoinToTokensEventsStart ? pool.swapCoinToTokensEventsStart : 0;
        const swapCoinToTokensEvents = await walletClient.getEventStream(poolAddress, eventStore, "swap_coin_to_tokens_handle", null, start);
        let swapCoinToTokensEventsStart = start + swapCoinToTokensEvents.length;
        start = pool.swapTokensToCoinEventsStart ? pool.swapTokensToCoinEventsStart : 0;
        const swapTokensToCoinEvents = await walletClient.getEventStream(poolAddress, eventStore, "swap_tokens_to_coin_handle", null, start);
        let swapTokensToCoinEventsStart = start + swapTokensToCoinEvents.length;
        start = pool.claimTokensEventsStart ? pool.claimTokensEventsStart : 0;
        const claimTokensEvents = await walletClient.getEventStream(poolAddress, eventStore, "claim_tokens_handle", null, start);
        let claimTokensEventsStart = start + claimTokensEvents.length;
        const processElement = function (element, store, push) {
            const elementString = JSON.stringify(element);
            if (push) {
                store[elementString] = store[elementString]
                    ? {
                        count: store[elementString].count + 1,
                        data: element
                    }
                    : {
                        count: 1,
                        data: element
                    };
            }
            else {
                store[elementString] = store[elementString]
                    ? {
                        count: store[elementString].count - 1,
                        data: element
                    }
                    : {
                        count: -1,
                        data: element
                    };
            }
        };
        liquidityAddedEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, depositCount, true);
            });
        });
        if (pool.data.pool_type == 0) {
            // tokens deposit for claim
            swapTokensToCoinEvents.forEach((e) => {
                e.data.token_ids.forEach((element) => {
                    processElement({ data: element }, tokenDepositForClaim, false);
                });
            });
        }
        else {
            // tokens transfer to pool
            swapTokensToCoinEvents.forEach((e) => {
                e.data.token_ids.forEach((element) => {
                    processElement({ data: element }, depositCount, true);
                });
            });
        }
        liquidityRemovedEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, depositCount, false);
            });
        });
        swapCoinToTokensEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, depositCount, false);
            });
        });
        claimTokensEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, tokenDepositForClaim, false);
            });
        });
        let inPool = Object.values(depositCount);
        let forClaim = Object.values(tokenDepositForClaim);
        inPool = inPool.filter((e) => e.count > 0);
        forClaim = forClaim.filter((e) => e.count > 0);
        pool.liquidityAddedEventsStart = liquidityAddedEventsStart;
        pool.liquidityRemovedEventsStart = liquidityRemovedEventsStart;
        pool.swapCoinToTokensEventsStart = swapCoinToTokensEventsStart;
        pool.swapTokensToCoinEventsStart = swapTokensToCoinEventsStart;
        pool.claimTokensEventsStart = claimTokensEventsStart;
        return { tokenIds: inPool, tokenIdsForClaim: forClaim };
    }
};
module.exports = UTILS;
//# sourceMappingURL=utils.js.map