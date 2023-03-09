import { Artefacts, BuildFormat } from 'webpd'
import PdFile from './PdFile'
import Wasm from './Wasm'
import Wav from './Wav'

interface Props {
    format: BuildFormat
    artefacts: Artefacts
    filename?: string
    showDownloadButton?: boolean
}

const ArtefactViewer: React.FunctionComponent<Props> = ({
    format,
    artefacts,
    filename,
    showDownloadButton,
}) => {
    switch (format) {
        case 'pd':
            return artefacts.pd ? (
                <PdFile pd={artefacts.pd} filename={filename} />
            ) : null
        case 'wasm':
            return artefacts.wasm ? (
                <Wasm
                    wasm={artefacts.wasm}
                    filename={filename || 'patch.wasm'}
                    showDownloadButton={showDownloadButton}
                    showFileSize={true}
                />
            ) : null
        case 'wav':
            return artefacts.wav ? (
                <Wav
                    wav={artefacts.wav}
                    showDownloadButton={showDownloadButton}
                />
            ) : null
    }
    return null
}

export default ArtefactViewer
