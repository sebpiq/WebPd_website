let BLOCK_SIZE: i32
let SAMPLE_RATE: f64
let CHANNEL_COUNT: i32 = 1
let F: i32 = 0
let OUTPUT: Float64Array

const freq: f64 = 440
let phaseStep: f64 = 0
let phase: f64 = 0
let output: f64 = 0

export function configure(sampleRate: f64, blockSize: i32): Float64Array {
    BLOCK_SIZE = blockSize
    SAMPLE_RATE = sampleRate
    OUTPUT = new Float64Array(BLOCK_SIZE * CHANNEL_COUNT)
    phaseStep = 2 * Math.PI * freq / SAMPLE_RATE
    return OUTPUT
}

export function loop(): void {
    for (F = 0; F < BLOCK_SIZE; F++) {
        phase += phaseStep
        output = Math.cos(phase) * 0.5
        
        for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
            OUTPUT[F + BLOCK_SIZE * channel] = output
        }
    }
}