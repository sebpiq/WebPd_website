import styled from 'styled-components'
import { BUILD_FORMATS } from 'webpd'
import { Button, Or, h2Mixin } from '../components'
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

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`

const ButtonActive = styled(Button)`
    ${h2Mixin}
    background: none;
`

const ButtonInactive = styled(Button)`
    background-color: ${theme.colors.bg2};
    color: ${theme.colors.fg2};
`

const OutputSelector = () => {
    const dispatch = useAppDispatch()
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const outFormats = Array.from(useAppSelector(selectBuildOutputFormatsAvailable))

    return (
        <Container>
            {outFormats.flatMap((outFormatOption, i) => {
                const ButtonComponent = outFormatOption === outFormat ? ButtonActive: (!!outFormat ? ButtonInactive: Button)
                return [
                    <ButtonComponent
                        key={outFormatOption}
                        onClick={() =>
                            dispatch(buildOutput.actions.setFormat(outFormatOption))
                        }
                    >
                        {BUILD_WEBSITE_FORMATS[outFormatOption].description}
                    </ButtonComponent>,
                    i < outFormats.length - 1 ? <Or key={outFormatOption + 'OR'}>OR</Or> : null
                ]
            })}
        </Container>
    )
}

export default OutputSelector
