import * as evalEngine from '../../src'
import {createButton} from '@webpd/shared/src/example-helpers'
import pEvent from 'p-event'

const context = new AudioContext()

const main = async () => {
    let engine = await evalEngine.create(context, {
        sampleRate: context.sampleRate, 
        channelCount: 2,
    })
    const button = createButton('Start')
    await pEvent(button, 'click')
    engine = await evalEngine.init(engine)
    await evalEngine.run(engine, `
        const modFreq = 1
        const freqBase = 400
        const freqAmplitude = 20
        const J = 2 * Math.PI / ${engine.waaContext.sampleRate}
        const phaseStepMod = J * modFreq

        let phaseMod = 0
        let phaseOsc = 0
        return {
            loop: () => { 
                phaseMod += phaseStepMod
                phaseOsc += J * (freqBase + freqAmplitude * Math.cos(phaseMod))
                return [Math.cos(phaseOsc) * 0.1, Math.cos(phaseOsc) * 0.1]
            },
            arrays: {}
        }
    `, {})
    return engine
}

main().then((engine) => {
    console.log('app started')
    ;(window as any).webPdEngine = engine
})