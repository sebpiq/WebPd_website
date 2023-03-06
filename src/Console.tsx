import styled from 'styled-components'
import { Box, H2 } from './components'
import { useAppSelector } from './store'
import { selectConsoleErrors } from './store/console-selectors'

const Container = styled(Box)``

const ErrorContainer = styled.pre`
    overflow: auto;
`

const Console: React.FunctionComponent = () => {
    const errors = useAppSelector(selectConsoleErrors)
    console.log('ERRORS', errors)
    if (!errors) {
        return null
    }

    return (
        <Container>
            <H2>Errors :</H2>
            {errors.map((error) => (
                <ErrorContainer key={error}>{error}</ErrorContainer>
            ))}
        </Container>
    )
}

export default Console
