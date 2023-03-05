import styled from 'styled-components'
import { BuildFormat } from 'webpd'
import { Box, H2 } from '../components'

interface Props {
    errors: Array<string>
    buildStep: BuildFormat | null
}

const Container = styled(Box)``

const ErrorContainer = styled.div``

const Errors: React.FunctionComponent<Props> = ({ errors, buildStep }) => {
    return (
        <Container>
            <H2>Building {buildStep} failed with errors :</H2>
            {errors.map((error) => (
                <ErrorContainer key={error}>{error}</ErrorContainer>
            ))}
        </Container>
    )
}

export default Errors
