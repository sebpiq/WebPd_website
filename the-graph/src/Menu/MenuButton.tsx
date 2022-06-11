import React from 'react'
import Button from '../styled-components/Button'

interface Props {
    onClick?: () => void
    children: Array<React.ReactChild> | React.ReactChild
}

const MenuButton = ({ onClick, children }: Props) => {
    const onClickStopPropagation = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation()
        onClick()
    }
    return <Button onClick={onClickStopPropagation}>{children}</Button>
}

export default MenuButton
