import styled from 'styled-components'
import { Hint, Select } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildOutput from '../store/build-output'
import { selectBuildOutputCodeTarget } from '../store/build-output-selectors'
import { theme } from '../theme'
import { CodeTarget, CODE_TARGETS } from '../types'

interface Props {}

const Container = styled.div`
    margin-top: ${theme.spacings.space2};
`

const CodeTargetSelect = styled(Select)`
    min-width: 8em;
    margin-left: ${theme.spacings.space1};
`

const CodeTargetHint = styled(Hint)`
    margin-top: ${theme.spacings.space0p1};
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
            <label>Compilation target</label>
            <CodeTargetSelect value={codeTarget} onChange={onTargetChange}>
                {Object.entries(CODE_TARGETS).map(
                    ([target, { display }]) => (
                        <option value={target} key={target}>
                            {display}
                        </option>
                    )
                )}
            </CodeTargetSelect>
            <CodeTargetHint>
                {CODE_TARGETS[codeTarget].info}
            </CodeTargetHint>
        </Container>
    )
}

export default ExtraOptions
