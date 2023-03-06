import styled from 'styled-components'
import { Select } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildOutput from '../store/build-output'
import { selectBuildOutputCodeTarget } from '../store/build-output-selectors'
import { theme } from '../theme'
import { CodeTarget, CODE_TARGETS } from '../types'

interface Props {}

const Container = styled.div`
    margin-top: ${theme.spacings.space2};
    margin-bottom: ${theme.spacings.space2};
`

const OptionContainer = styled.div`
    &> label {
        margin-right ${theme.spacings.space1};
    }
`

const ExtraOptions: React.FunctionComponent<Props> = () => {
    const codeTarget = useAppSelector(selectBuildOutputCodeTarget)
    const dispatch = useAppDispatch()

    const onTargetChange: React.ChangeEventHandler<HTMLSelectElement> = (
        event
    ) =>
        dispatch(
            buildOutput.actions.setCodeTarget(
                event.currentTarget.value as CodeTarget
            )
        )

    return (
        <Container>
            <OptionContainer>
                <label>Compilation target</label>
                <Select value={codeTarget} onChange={onTargetChange}>
                    {Object.entries(CODE_TARGETS).map(
                        ([target, { display }]) => (
                            <option value={target} key={target}>
                                {display}
                            </option>
                        )
                    )}
                </Select>
            </OptionContainer>
        </Container>
    )
}

export default ExtraOptions
