import React from 'react'
import styled from 'styled-components'
import themed, { ThemedProps } from '../styled-components/themed'

const Button = styled.button`
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
`

interface Props extends ThemedProps {
    onClick: () => void
}

export const BurgerMenu = ({ colors, onClick }: Props) => {
    const onClickStopPropagation = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation()
        onClick()
    }
    return (
        <Button onClick={onClickStopPropagation}>
            <svg viewBox="0 0 100 100" width="40" height="40">
                <rect
                    y="10"
                    width="100"
                    height="20"
                    rx="8"
                    fill={colors.primary}
                ></rect>
                <rect
                    y="40"
                    width="100"
                    height="20"
                    rx="8"
                    fill={colors.primary}
                ></rect>
                <rect
                    y="70"
                    width="100"
                    height="20"
                    rx="8"
                    fill={colors.primary}
                ></rect>
            </svg>
        </Button>
    )
}

export default themed(BurgerMenu)
