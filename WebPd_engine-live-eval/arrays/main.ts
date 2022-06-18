import * as evalEngine from '../../src'
import {createButton} from '@webpd/shared/src/example-helpers'
import pEvent from 'p-event'
import { ENGINE_ARRAYS_VARIABLE_NAME } from '../../src/constants'

const context = new AudioContext()

const arraySize = 2056 * 64

const noiseArray = new Float32Array(arraySize)
for (let i = 0; i < arraySize; i++) {
    noiseArray[i] = Math.random() * 2 - 1
}

const sawtoothArray = new Float32Array(arraySize)
for (let i = 0; i < arraySize; i++) {
    sawtoothArray[i] = -1 + 2 * (i % 512) / 512
}

const main = async () => {
    let engine = await evalEngine.create(context, {
        sampleRate: context.sampleRate, 
        channelCount: 2,
    })

    const startButton = createButton('START')
    await pEvent(startButton, 'click')

    engine = await evalEngine.init(engine)
    await evalEngine.run(engine, `
        let arrayIndex = 0
        let arraySize = null
        let currentArray = null

        const setArrayName = (arrayName) => {
            currentArray = ${ENGINE_ARRAYS_VARIABLE_NAME}[arrayName]
            arraySize = currentArray.length
        }

        setArrayName('sawtooth')

        return {
            loop: () => {
                arrayIndex = (arrayIndex + 1) % arraySize
                return [currentArray[arrayIndex] * 0.1, currentArray[arrayIndex] * 0.1]
            },
            ports: {
                setArray: (arrayName) => setArrayName(arrayName)
            }
        }
    `, {
        noise: noiseArray, 
        sawtooth: sawtoothArray
    })

    const setNoiseButton = createButton('Noise array')
    setNoiseButton.onclick = () => evalEngine.callPort(engine, 'setArray', ['noise'])
    const setPhasorButton = createButton('Phasor array')
    setPhasorButton.onclick = () => evalEngine.callPort(engine, 'setArray', ['sawtooth'])

    return engine
}

main().then((engine) => {
    console.log('app started')
    ;(window as any).webPdEngine = engine
})