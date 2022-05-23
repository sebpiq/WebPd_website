import React from 'react'

export interface Props {
    className?: string
}

const Component = ({ 
    className = ''
}) => {
    return (
        <div className={className}>
            <span>TEST TEST TEST TEST</span>
        </div>
    )
}

export default Component