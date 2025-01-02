export const nextTick = () => new Promise((resolve) => setTimeout(resolve, 1))

export const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const throttled = <P extends Array<any>>(
    delay: number,
    func: (...args: P) => void
) => {
    let timeout: number | null = null
    return (...args: P) => {
        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(() => func(...args), delay) as any
    }
}

export const assertNonNullable = <T>(obj: T, errMessage?: string) => {
    if (!obj) {
        throw new Error(errMessage || `expected ${obj} to be defined`)
    }
    return obj
}
