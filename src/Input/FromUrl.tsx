import React, { useState } from 'react'
import styled from 'styled-components'
import { Button } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import { selectBuildInputUrl } from '../store/build-input-selectors'
import { theme } from '../theme'

interface Props {}

const Container = styled.form`
    display: inline;
`

const Input = styled.input`
    padding: ${theme.spacings.space0p1} 0;
    color: ${theme.colors.fg1};
    ::placeholder,
    ::-webkit-input-placeholder {
        color: ${theme.colors.fg1};
        opacity: 1;
    }
    :-ms-input-placeholder {
        color: ${theme.colors.fg1};
        opacity: 1;
    }
`

const OkButton = styled(Button)`
    margin-left: ${theme.spacings.space1};
`

const FromUrl: React.FunctionComponent<Props> = () => {
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
                value={tempUrl}
                onChange={onChange}
                placeholder="Load a file from a URL"
            />
            {tempUrl.length ? <OkButton>Load</OkButton> : null}
        </Container>
    )
}

export default FromUrl
