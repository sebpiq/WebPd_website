import styled from 'styled-components'
import { Box, H2 } from './components'

const Container = styled(Box)`
    text-align: center;
`

const CompilerTitle = () => {
    return (
        <Container>
            <H2>↓ Online compiler ↓</H2>
        </Container>
    )
}

export default CompilerTitle
