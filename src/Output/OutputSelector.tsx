import styled from 'styled-components/macro'
import { BUILD_FORMATS } from 'webpd'
import { Button, Or, h3Mixin } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildOutput from '../store/build-output'
import {
    selectBuildOutputFormat,
    selectBuildOutputFormatsAvailable,
} from '../store/build-output-selectors'
import { theme } from '../theme'

const BUILD_WEBSITE_FORMATS = {
    ...BUILD_FORMATS,
    patchPlayer: { description: 'Patch player' },
}

const BUILD_WEBSITE_FORMATS_INFO: {
    [Property in keyof typeof BUILD_WEBSITE_FORMATS]: { info: string }
} = {
    pd: { info: 'Pure Data file (.pd) in text format.' },
    pdJson: { info: 'A JSON representation of a pure data file.' },
    dspGraph: {
        info: 'A DSP graph that is used internally by the WebPd compiler to generate the audio output.',
    },
    compiledJs: {
        info: 'A copmiled JavaScript function for generating audio.',
    },
    compiledAsc: {
        info: 'An AssemblyScript function which can then be compiled to Web Assembly.',
    },
    wasm: { info: 'A Web Assembly module compiled from your patch.' },
    wav: { info: 'An audio preview of your patch.' },
    patchPlayer: {
        info: 'An interactive interface, allowing to play with your patch online.',
    },
}

const Container = styled.div``

const FormatSelector = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`

const FormatInfo = styled.div`
    margin-top: ${theme.spacings.space1};
`

const ButtonInit = styled(Button)`
    ${h3Mixin}
`

const ButtonActive = styled(Button)`
    ${h3Mixin}
    background: none;
`

const ButtonInactive = styled(Button)`
    background-color: ${theme.colors.bg2};
    color: ${theme.colors.fg2};
`

const OutputSelector = () => {
    const dispatch = useAppDispatch()
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const outFormats = Array.from(
        useAppSelector(selectBuildOutputFormatsAvailable)
    )

    return (
        <Container>
            <FormatSelector>
                {outFormats.flatMap((outFormatOption, i) => {
                    const ButtonComponent =
                        outFormatOption === outFormat
                            ? ButtonActive
                            : !!outFormat
                            ? ButtonInactive
                            : ButtonInit
                    return [
                        <ButtonComponent
                            key={outFormatOption}
                            onClick={() =>
                                dispatch(
                                    buildOutput.actions.setFormat(
                                        outFormatOption
                                    )
                                )
                            }
                        >
                            {BUILD_WEBSITE_FORMATS[outFormatOption].description}
                        </ButtonComponent>,
                        i < outFormats.length - 1 ? (
                            <Or key={outFormatOption + 'OR'}>OR</Or>
                        ) : null,
                    ]
                })}
            </FormatSelector>
            {outFormat ? <FormatInfo>
                {'→ ' + BUILD_WEBSITE_FORMATS_INFO[outFormat].info}
            </FormatInfo>: null}
        </Container>
    )
}

export default OutputSelector
