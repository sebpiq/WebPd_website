import React from 'react'
import styled from 'styled-components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import { selectBuildInputUrl } from '../store/build-input-selectors'
import { theme } from '../theme'

const Input = styled.input`
    color: ${theme.colors.colorScheme.next()};
`

const FromUrl = () => {
    const dispatch = useAppDispatch()
    const url = useAppSelector(selectBuildInputUrl)

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        dispatch(buildInput.actions.setUrl(event.target.value))
    }

    return (
        <Input
            value={url || ''}
            onChange={onChange}
            placeholder="Type the url of a patch"
        />
    )
}

export default FromUrl
