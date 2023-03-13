import React, { useState } from 'react'
import styled from 'styled-components'
import { Select } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import { selectBuildInputUrl } from '../store/build-input-selectors'
import { theme } from '../theme'

interface Props {}

const EXAMPLES = {
    ginger2: {
        display: "Martin's Brinkmann ginger2",
        url: 'https://raw.githubusercontent.com/sebpiq/WebPd_website/bc04a2a5bf603f872cf44409009c2b251bbafa9b/patch-player/www/ginger2.pd',
    },
}

const Container = styled.form`
    display: inline;
`

const ExampleSelect = styled(Select)`
    padding-left: 0;
    padding-top: ${theme.spacings.space0p1};
`

const FromExample: React.FunctionComponent<Props> = () => {
    const dispatch = useAppDispatch()

    const onChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
        const example = event.currentTarget.value as keyof typeof EXAMPLES
        dispatch(buildInput.actions.setUrl(EXAMPLES[example].url))
    }

    return (
        <Container>
            <ExampleSelect onChange={onChange}>
                <option value={''}>Load one of the following examples</option>
                {Object.entries(EXAMPLES).map(([key, params]) => (
                    <option value={key} key={key}>{params.display}</option>
                ))}
            </ExampleSelect>
        </Container>
    )
}

export default FromExample
