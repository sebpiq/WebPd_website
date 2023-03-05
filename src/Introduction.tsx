import styled from 'styled-components'
import { Box, H1 } from './components'
import { theme } from './theme'

const Container = styled(Box)`
    background: rgb(0,0,0);
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, ${theme.colors.bg2} 50%, ${theme.colors.bg2} 67%); 
`

const Introduction = () => {
    return (
        <Container>
            <H1>WebPd</H1>
        </Container>
    )
}

export default Introduction
