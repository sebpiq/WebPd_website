import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import styled from 'styled-components'
import { useAppDispatch } from '../store'
import buildInput from '../store/build-input'
import { theme } from '../theme'

const Container = styled.span`
    cursor: pointer;
`

const Span = styled.span`
    color: ${theme.colors.colorScheme.next()};
`

const FromLocalFile = () => {
    const dispatch = useAppDispatch()

    const onDrop = useCallback((files: Array<File>) => {
        const file = files[0]!
        const reader = new FileReader()
        reader.onabort = () => console.log('file reading was aborted')
        reader.onerror = () => console.log('file reading has failed')
        reader.onload = () => {
            dispatch(
                buildInput.actions.setLocalFile({
                    arrayBuffer: reader.result as ArrayBuffer,
                    filepath: file.name,
                })
            )
        }
        reader.readAsArrayBuffer(file)
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
    })

    return (
        <Container {...getRootProps()}>
            <input {...getInputProps()} />
            {isDragActive ? (
                <Span>Drop the file here ...</Span>
            ) : (
                <Span>Upload a .pd file from your computer</Span>
            )}
        </Container>
    )
}

export default FromLocalFile
