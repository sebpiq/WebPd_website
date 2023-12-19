import { Build } from 'webpd'
import PdFile from './PdFile'
import Wasm from './Wasm'
import Wav from './Wav'
import GeneratedApp from './GeneratedApp'

interface Props {
    format: Build.BuildFormat
    artefacts: Build.Artefacts
    filename?: string
    showDownloadButton?: boolean
    extraButtons?: Array<JSX.Element>
}

const ArtefactViewer: React.FunctionComponent<Props> = ({
    format,
    artefacts,
    filename,
    showDownloadButton,
    extraButtons,
}) => {
    switch (format) {
        case 'pd':
            return artefacts.pd ? (
                <PdFile
                    pd={artefacts.pd}
                    filename={filename}
                    extraButtons={extraButtons}
                />
            ) : null
        case 'wasm':
            return artefacts.wasm ? (
                <Wasm
                    wasm={artefacts.wasm}
                    filename={filename || 'patch.wasm'}
                    showDownloadButton={showDownloadButton}
                    extraButtons={extraButtons}
                    showFileSize={true}
                />
            ) : null
        case 'wav':
            return artefacts.wav ? (
                <Wav
                    wav={artefacts.wav}
                    showDownloadButton={showDownloadButton}
                    extraButtons={extraButtons}
                />
            ) : null
        case 'app':
            return artefacts.app ? (
                <GeneratedApp
                    app={artefacts.app}
                    filename={filename || 'app.zip'}
                    extraButtons={extraButtons}
                    showDownloadButton={showDownloadButton}
                />
            ) : null
    }
    return null
}

export default ArtefactViewer
