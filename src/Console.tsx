import styled from 'styled-components'
import { Box, H3 } from './components'
import { useAppSelector } from './store'
import {
    selectConsoleErrors,
    selectConsoleWarnings,
} from './store/console-selectors'
import { theme } from './theme'

const Container = styled(Box)``

const WarningContainer = styled.pre`
    overflow: auto;
    margin: 0;
`

const ErrorContainer = styled.pre`
    overflow: auto;
    margin: 0;
`

const MessagesContainer = styled.div`
    margin-top: ${theme.spacings.space1};
`

const Console: React.FunctionComponent = () => {
    const errors = useAppSelector(selectConsoleErrors)
    const warnings = useAppSelector(selectConsoleWarnings)
    if (!errors && !warnings) {
        return null
    }

    return (
        <Container>
            <H3>Compilation output :</H3>
            <MessagesContainer>
                {warnings
                    ? warnings.map((warning, i) => (
                          <WarningContainer key={i}>
                              WARNING : {warning}
                          </WarningContainer>
                      ))
                    : null}
                {errors
                    ? errors.map((error, i) => (
                          <ErrorContainer key={i}>
                              ERROR : {error}
                          </ErrorContainer>
                      ))
                    : null}
            </MessagesContainer>
        </Container>
    )
}

export default Console
