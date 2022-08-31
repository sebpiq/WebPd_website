import React from 'react'
import styled from 'styled-components'
import H2 from '../styled-components/H2'
import themeConfig from '../theme-config'

const Container = styled.div`
    height: 100%;
    width: 100%;
    padding: ${themeConfig.spacing.default};
    display: flex;
    flex-direction: column;
    justify-content: center;
    >* {
        text-align: center;
    }
`

const CompilationErrorPopUp = () => {
    return (
        <Container>
            <H2>Compilation Error !!!</H2>
            <p>Open browser console for details.</p>
        </Container>
    )
}

export default CompilationErrorPopUp
