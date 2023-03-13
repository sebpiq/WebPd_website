import styled from 'styled-components'
import { useAppDispatch, useAppSelector } from '../store'
import buildOutput from '../store/build-output'
import { selectBuildOutputPreviewDurationSeconds } from '../store/build-output-selectors'
import { theme } from '../theme'

interface Props {}

const Container = styled.div`
    margin-top: ${theme.spacings.space2};
`

const DurationInput = styled.input`
    margin-left: ${theme.spacings.space0p1};
    background-color: ${theme.colors.bg1p5};
    width: 2em;
`

const OptionsWavLength: React.FunctionComponent<Props> = () => {
    const previewDurationSeconds = useAppSelector(
        selectBuildOutputPreviewDurationSeconds
    )
    const dispatch = useAppDispatch()

    const onDurationChange: React.ChangeEventHandler<HTMLInputElement> = (
        event
    ) => {
        if (event.currentTarget.value === '') {
            dispatch(buildOutput.actions.setPreviewDurationSeconds(null))
            return
        }

        const duration = Number.parseInt(event.currentTarget.value)
        if (isNaN(duration)) {
            return
        }
        dispatch(buildOutput.actions.setPreviewDurationSeconds(duration))
    }

    return (
        <Container>
            <label>Duration of preview in seconds</label>
            <DurationInput
                value={previewDurationSeconds || ''}
                onChange={onDurationChange}
            />
        </Container>
    )
}

export default OptionsWavLength
