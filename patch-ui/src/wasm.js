export const waitAscCompiler = async () => {
    return new Promise((resolve) => {
        const _waitRepeat = () => {
            setTimeout(() => {
                if (window.asc) {
                    resolve()
                } else _waitRepeat()
            }, 200)
        }
        _waitRepeat()        
    })
}

export const compileAsc = async (code, bitDepth) => {
    const compileOptions = {
        optimizeLevel: 3,
        runtime: "incremental",
        exportRuntime: true,
    }
    if (bitDepth === 32) {
        // For 32 bits version of Math
        compileOptions.use = ['Math=NativeMathf']
    }
    const { error, binary, stderr } = await window.asc.compileString(code, compileOptions)
    if (error) {
        console.error(code)
        throw new Error(stderr.toString())
    }
    return binary.buffer
}