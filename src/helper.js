const Helper = {
    sleep: async (time) => new Promise((resolve) => setTimeout(resolve, time)),
    tryCallWithTrial: async (func, trial = 10, waitTime = 2000) => {
        let initial = trial
        while (trial > 0) {
            try {
                let ret = await func()
                return ret
            } catch (e) {
                console.warn(e.toString())
                await Helper.sleep(waitTime)
            }
            trial--
            if (initial - trial > 5) {
                await Helper.sleep(waitTime)
            }
        }
        return undefined
    }
}

module.exports = Helper