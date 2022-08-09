let BLOCK_SIZE: i32
let SAMPLE_RATE: f64
let CHANNEL_COUNT: i32 = 1
let FRAME: i32
let OUTPUT: Float64Array
let SAMPLE: Float64Array

export function configure(sampleRate: f64, blockSize: i32): Float64Array {
    BLOCK_SIZE = blockSize
    SAMPLE_RATE = sampleRate
    OUTPUT = new Float64Array(BLOCK_SIZE * CHANNEL_COUNT)
    FRAME = -1
    return OUTPUT
}

export function loop(): void {
    for (let k: i32 = 0; k < BLOCK_SIZE; k++) {
        FRAME++
        for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
            if (FRAME < SAMPLE.length) {
                OUTPUT[k + BLOCK_SIZE * channel] = SAMPLE[FRAME]
            } else {
                OUTPUT[k + BLOCK_SIZE * channel] = 0
            }
        }
    }
}

export function setArray(_: string, buffer: ArrayBuffer): void {
    let i: i32 = 0
    const arrayData: DataView = new DataView(buffer)
    const arrayLength: i32 = buffer.byteLength / Float64Array.BYTES_PER_ELEMENT
    const array: Float64Array = new Float64Array(arrayLength)
    for (i = 0; i < arrayLength; i++) {
        array[i] = arrayData.getFloat64(i * Float64Array.BYTES_PER_ELEMENT)
    }
    SAMPLE = array
}