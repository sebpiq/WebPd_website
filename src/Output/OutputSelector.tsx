import styled from 'styled-components/macro'
import { Build } from 'webpd'
import { Button, Or, Hint } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildOutput from '../store/build-output'
import {
    selectBuildOutputFormat,
    selectBuildOutputFormatsAvailable,
} from '../store/build-output-selectors'
import { theme } from '../theme'

const BUILD_WEBSITE_FORMATS = {
    ...Build.BUILD_FORMATS,
    patchPlayer: { description: 'Patch player' },
}

const BUILD_WEBSITE_FORMATS_INFO: {
    [Property in keyof typeof BUILD_WEBSITE_FORMATS]: { info: string }
} = {
    pd: { info: 'A Pure Data file (.pd) in text format.' },
    pdJson: { info: 'Will compile a JSON representation of a pure data file.' },
    dspGraph: {
        info: 'Will compile a DSP graph that is used internally by the WebPd compiler to generate the audio output.',
    },
    compiledJs: {
        info: 'Will compile a JavaScript function for generating audio.',
    },
    compiledAsc: {
        info: 'Will compile an AssemblyScript function which can then be compiled to Web Assembly.',
    },
    wasm: { info: 'Will generate a Web Assembly module from your patch. This module can be loaded again here at a later time to play your patch.' },
    wav: { info: 'Will generate an audio preview of your patch.' },
    patchPlayer: {
        info: 'Will render a interactive interface allowing to play your patch online.',
    },
    appTemplate: {
        info: 'Will generate a bare bones web page embedding your patch. A good starter to build an audio web site of your own.'
    }
}

const Container = styled.div``

const FormatSelector = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        flex-direction: column;
        align-items: initial;
        ${Or} {
            text-align: center;
        }
    }
`

const FormatHint = styled(Hint)`
    margin-top: ${theme.spacings.space0p1};
`

const ButtonInit = styled(Button)`
`

const ButtonActive = styled(Button)`
    color: ${theme.colors.colorScheme.next()};
    background-color: ${theme.colors.bg1p5};
`

const ButtonInactive = styled(Button)`
    color: ${theme.colors.fg1};
    background-color: ${theme.colors.bg1p5};
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
            {outFormat ? (
                <FormatHint>
                    {BUILD_WEBSITE_FORMATS_INFO[outFormat].info}
                </FormatHint>
            ) : null}
        </Container>
    )
}

export default OutputSelector
