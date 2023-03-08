import { BuildFormat } from "webpd"

export const BIT_DEPTH = 64

export const CODE_TARGETS = {
    'WebAssembly': {
        display: 'Web Assembly',
        info: 'Slower to build, but more performance when running. Good when your patch is stable and you want to take it elsewhere.',
    },
    'JavaScript': {
        display: 'JavaScript',
        info: 'Fast to build, but less performance when running. Good if you want to test things fast.'
    }
}

export type BitDepth = typeof BIT_DEPTH

export type CodeTarget = keyof typeof CODE_TARGETS

export type BuildFormatWebSite = BuildFormat | 'patchPlayer'