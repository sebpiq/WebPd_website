import React from 'react'
import Button from '../styled-components/Button'

interface Props {
    className?: string
    onClick?: () => void
    children: Array<React.ReactChild> | React.ReactChild
}

const MenuButton = ({ onClick, children, className }: Props) => {
    const onClickStopPropagation = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation()
        onClick()
    }
    return (
        <Button onClick={onClickStopPropagation} className={className}>
            {children}
        </Button>
    )
}

export default MenuButton
