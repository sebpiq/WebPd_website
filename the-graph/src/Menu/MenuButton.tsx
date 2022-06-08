import React from 'react'
import ThemedButton from '../styled-components/ThemedButton'

interface Props {
    onClick?: () => void
    children: Array<React.ReactChild> | React.ReactChild
}

const MenuButton = ({ onClick, children }: Props) => {
    const onClickStopPropagation = (event: React.MouseEvent<HTMLButtonElement>) => { 
        event.stopPropagation()
        onClick()
    }
    return (
        <ThemedButton onClick={onClickStopPropagation}>
            {children}
        </ThemedButton>
    )
}

export default MenuButton