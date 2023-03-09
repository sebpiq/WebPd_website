import { BuildFormat } from "webpd"

export const BIT_DEPTH = 64

export const CODE_TARGETS = {
    'WebAssembly': {
        display: 'Web Assembly',
        info: 'Web Assembly is slower to build, but provides a higher performance when running. Good for when your patch is stable and you want to take it elsewhere.',
    },
    'JavaScript': {
        display: 'JavaScript',
        info: 'JavaScript is fast to build, but slower when running. Good if you want to test things fast.'
    }
}

export type BitDepth = typeof BIT_DEPTH

export type CodeTarget = keyof typeof CODE_TARGETS

export type BuildFormatWebSite = BuildFormat | 'patchPlayer'