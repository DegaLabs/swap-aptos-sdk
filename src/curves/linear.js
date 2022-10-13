const BN = require('bignumber.js')
const FEE_DIVISOR = 10000;
module.exports = {
    validateDelta: function (delta) {
        return true
    },
    validateSpotPrice: function (spotPrice) {
        return true
    },
    getBuyInfo: function (spotPrice, delta, numItems, feeMultiplier, protocolFeeMultiplier) {
        if (numItems == 0) {
            return (1, 0, 0, 0, 0, 0)
        }
        let newSpotPrice = spotPrice + delta * numItems
        let buySpotPrice = spotPrice + delta

        let inputValue = numItems * buySpotPrice + numItems * (numItems - 1) * delta / 2
        inputValue = Math.floor(inputValue)
        let totalFee = inputValue * (protocolFeeMultiplier + feeMultiplier) / FEE_DIVISOR;
        totalFee = Math.floor(totalFee)

        let tradeFee = inputValue * feeMultiplier / FEE_DIVISOR;
        tradeFee = Math.floor(tradeFee)

        let protocolFee = totalFee - tradeFee;
        inputValue = inputValue + tradeFee;
        inputValue = inputValue + protocolFee;
        let newDelta = delta;

        return [0, newSpotPrice, newDelta, inputValue, protocolFee, tradeFee]
    },
    getSellInfo: function (spotPrice, delta, numItemsSell, feeMultiplier, protocolFeeMultiplier) {
        if (numItemsSell == 0) {
            return (1, 0, 0, 0, 0, 0)
        }

        let totalPriceDecrease = delta * numItemsSell;
        let newSpotPrice = 0;
        let numItems = numItemsSell;

        if (spotPrice < totalPriceDecrease) {
            numItems = spotPrice / delta + 1;
            numItems = Math.floor(numItems)
        } else {
            newSpotPrice = spotPrice - totalPriceDecrease;
        }

        let outputValue = spotPrice * numItems - numItems * (numItems - 1) * delta / 2;

        let totalFee = outputValue * (protocolFeeMultiplier + feeMultiplier) / FEE_DIVISOR;
        totalFee = Math.floor(totalFee)

        let tradeFee = outputValue * feeMultiplier / FEE_DIVISOR;
        tradeFee = Math.floor(tradeFee)

        let protocolFee = totalFee - tradeFee;
        outputValue = outputValue - tradeFee;
        outputValue = outputValue - protocolFee;

        return [0, newSpotPrice, delta, outputValue, protocolFee, tradeFee]
    }
}