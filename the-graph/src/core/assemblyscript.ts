// Packs-in assemblyscript compiler so we can use it in the browser.
// See index.html for actual imports
// REF : 
// https://github.com/AssemblyScript/examples
// https://github.com/AssemblyScript/examples/tree/main/sdk

export const compileAs = async (code: PdEngine.Code): Promise<ArrayBuffer> => {
    const { error, binary, stderr } = await (window as any).asc.compileString(code, {
        optimizeLevel: 3,
        runtime: "stub"
    })
    if (error) {
        throw new Error(stderr.toString())
    }
    return binary.buffer
}