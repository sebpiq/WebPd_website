import React, { useState } from 'react'
import styled from 'styled-components'
import { Button } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import { selectBuildInputUrl } from '../store/build-input-selectors'
import { theme } from '../theme'

const Container = styled.form`
    display: inline;
`

const Input = styled.input`
    color: ${theme.colors.colorScheme.next()};
`

const FromUrl = () => {
    const dispatch = useAppDispatch()
    const url = useAppSelector(selectBuildInputUrl)
    const [tempUrl, setTempUrl] = useState(url || '')

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        setTempUrl(event.target.value)
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
                placeholder="Type the url of a patch"
            />
            {tempUrl.length ? <Button>OK</Button>: null}
        </Container>
    )
}

export default FromUrl
