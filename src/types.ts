import { BuildFormat } from "webpd"

export const BIT_DEPTH = 64

export const CODE_TARGETS = {
    'WebAssembly': {
        display: 'Web Assembly',
    },
    'JavaScript': {
        display: 'JavaScript'
    }
}

export type BitDepth = typeof BIT_DEPTH

export type CodeTarget = keyof typeof CODE_TARGETS

export type BuildFormatWebSite = BuildFormat | 'patchPlayer'