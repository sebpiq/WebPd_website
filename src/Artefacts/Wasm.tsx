import { useMemo } from 'react'
import styled from 'styled-components'
import { Artefacts } from 'webpd'
import { Button, Filename, Filesize } from '../components'
import { theme } from '../theme'
import { download } from '../utils'
import { filesize } from 'filesize'

const CHAR_MAP = ['░', '▒', '▓', '▔', '▙', '▚', '▛', '▜', '▝', '▞', '▟']

interface Props {
    wasm: NonNullable<Artefacts['wasm']>
    filename?: string
    showDownloadButton?: boolean
    showFileSize?: boolean
}

const Container = styled.div`
    position: relative;
`

const BinaryContainer = styled.div`
    word-break: break-all;
    max-height: 20vw;
    overflow: hidden;
    opacity: 0.1;
    text-align: justify;
`

const DownloadButton = styled(Button)`
    position: absolute;
    bottom: ${theme.spacings.space0p1};
    right: ${theme.spacings.space0p1};
`

const Wasm: React.FunctionComponent<Props> = ({
    wasm,
    filename,
    showDownloadButton,
    showFileSize,
}) => {
    const onDownload = () => {
        download('patch.wasm', wasm, 'application/wasm')
    }

    const array = useMemo(() => Array.from(new Uint8Array(wasm)), [wasm])

    const fileSizeStr = filesize(wasm.byteLength) as string

    return (
        <Container>
            {filename ? <Filename filename={filename} /> : null}
            {showFileSize ? <Filesize>file size : {fileSizeStr}</Filesize> : null}
            <BinaryContainer>
                {array.slice(0, 1000).map((val, i) => (
                    <span key={i}>{CHAR_MAP[val % CHAR_MAP.length]} </span>
                ))}
            </BinaryContainer>
            {showDownloadButton ? (
                <DownloadButton onClick={onDownload}>Download</DownloadButton>
            ) : null}
        </Container>
    )
}
export default Wasm
