import React, { useState } from 'react'
import styled from 'styled-components'
import { ButtonIconInline } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import { selectBuildInputUrl } from '../store/build-input-selectors'
import { theme } from '../theme'

const SPACE_BUTTON = '1.5rem'

interface Props {
    isActive: boolean
}

const Container = styled.form`
    display: inline;
`

const Input = styled.input<{ isActive: boolean }>`
    padding: ${theme.spacings.space0p1} 0;
    padding-right: ${SPACE_BUTTON};
    color: ${(props) =>
        props.isActive ? theme.colors.colorScheme.next() : theme.colors.fg2};
`

const OkButton = styled(ButtonIconInline)`
    position: relative;
    top: 0.1em;
    right: calc(${SPACE_BUTTON} * 0.9);
`

const FromUrl: React.FunctionComponent<Props> = ({ isActive }) => {
    const dispatch = useAppDispatch()
    const url = useAppSelector(selectBuildInputUrl)
    const [tempUrl, setTempUrl] = useState(url || '')

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        setTempUrl(event.target.value)
        dispatch(buildInput.actions.setFocusOn('url'))
    }

    const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault()
        dispatch(buildInput.actions.setUrl(tempUrl))
    }

    return (
        <Container onSubmit={onSubmit}>
            <Input
                isActive={isActive || false}
                value={tempUrl}
                onChange={onChange}
                placeholder="Load a file from a URL"
            />
            {tempUrl.length ? <OkButton>⮡</OkButton> : null}
        </Container>
    )
}

export default FromUrl
