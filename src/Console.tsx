import styled from 'styled-components'
import { Box, H2 } from './components'
import { useAppSelector } from './store'
import { selectConsoleErrors, selectConsoleWarnings } from './store/console-selectors'

const Container = styled(Box)``

const WarningContainer = styled.pre`
    overflow: auto;
    margin: 0;
`

const ErrorContainer = styled.pre`
    overflow: auto;
    margin: 0;
`

const Console: React.FunctionComponent = () => {
    const errors = useAppSelector(selectConsoleErrors)
    const warnings = useAppSelector(selectConsoleWarnings)
    if (!errors && !warnings) {
        return null
    }

    return (
        <Container>
            <H2>Output messages :</H2>
            {warnings ? warnings.map((warning, i) => (
                <WarningContainer key={i}>WARNING : {warning}</WarningContainer>
            )): null}
            {errors ? errors.map((error, i) => (
                <ErrorContainer key={i}>ERROR : {error}</ErrorContainer>
            )): null}
        </Container>
    )
}

export default Console
