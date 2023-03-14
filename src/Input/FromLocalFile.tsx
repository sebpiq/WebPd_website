import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import styled from 'styled-components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import { selectBuildInputFilepath } from '../store/build-input-selectors'
import { theme } from '../theme'

interface Props {}

const Container = styled.span`
    padding: ${theme.spacings.space0p1} 0;
    cursor: pointer;
`

const Span = styled.span`
    color: ${theme.colors.fg1};
`

const FromLocalFile: React.FunctionComponent<Props> = () => {
    const filepath = useAppSelector(selectBuildInputFilepath)
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
                <Span>{filepath ? 'Choose a different file': 'Upload a file from your device'}</Span>
            )}
        </Container>
    )
}

export default FromLocalFile
