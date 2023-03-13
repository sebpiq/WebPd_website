import { useMemo } from 'react'
import styled from 'styled-components'
import { Build } from 'webpd'
import { ArtefactButtonsContainer, Button, Filename, Filesize } from '../components'
import { theme } from '../theme'
import { download } from '../utils'
import { filesize } from 'filesize'

const CHAR_MAP = ['░', '▒', '▓', '▔', '▙', '▚', '▛', '▜', '▝', '▞', '▟']

interface Props {
    wasm: NonNullable<Build.Artefacts['wasm']>
    filename: string
    showDownloadButton?: boolean
    showFileSize?: boolean
    extraButtons?: Array<JSX.Element>
}

const Container = styled.div`
    position: relative;
`

const BinaryContainer = styled.div`
    word-break: break-all;
    height: 20vw;
    max-height: ${theme.dimensions.maxArtefactHeight};
    overflow: hidden;
    opacity: 0.1;
    text-align: justify;
`

const ButtonsContainer = styled(ArtefactButtonsContainer)`
    position: absolute;
    top: calc(${theme.spacings.space0p1});
    right: calc(${theme.spacings.space0p1});
`

const Wasm: React.FunctionComponent<Props> = ({
    wasm,
    filename,
    showDownloadButton,
    showFileSize,
    extraButtons,
}) => {
    if (showDownloadButton) {
        const onDownload = () => {
            download(filename, wasm, 'application/wasm')
        }
        extraButtons = [
            ...(extraButtons || []),
            <Button onClick={onDownload}>Download</Button>,
        ]
    }

    const array = useMemo(() => Array.from(new Uint8Array(wasm)), [wasm])

    const fileSizeStr = filesize(wasm.byteLength) as string

    return (
        <Container>
            {filename ? <Filename filename={filename} /> : null}
            {showFileSize ? (
                <Filesize>file size : {fileSizeStr}</Filesize>
            ) : null}
            <BinaryContainer>
                {array.slice(0, 1000).map((val, i) => (
                    <span key={i}>{CHAR_MAP[val % CHAR_MAP.length]} </span>
                ))}
            </BinaryContainer>
            {extraButtons ? (
                <ButtonsContainer>{extraButtons}</ButtonsContainer>
            ) : null}
        </Container>
    )
}
export default Wasm
