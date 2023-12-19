import styled from 'styled-components'
import { Build } from 'webpd'
import {
    ArtefactButtonsContainer,
    Button,
    artefactTextMixin,
} from '../components'
import { theme } from '../theme'
import { byteCountInString, download } from '../utils'
import { filesize } from 'filesize'
import JSZip from 'jszip'

interface Props {
    app: NonNullable<Build.Artefacts['app']>
    filename: string
    showDownloadButton?: boolean
    extraButtons?: Array<JSX.Element>
}

const Container = styled.div`
    position: relative;
    background-color: ${theme.colors.bg1p5};
`

const RootFilename = styled.div`
    ${artefactTextMixin}
    font-weight: bold;
    margin: 0;
    padding: 0;
`

const FilesContainer = styled.table`
    ${artefactTextMixin}
    word-break: break-all;
    overflow: hidden;
    text-align: justify;
    padding-left: 0.5em;

    & td {
        padding-right: 0.5em;
    }
`

const ButtonsContainer = styled(ArtefactButtonsContainer)`
    position: absolute;
    top: calc(${theme.spacings.space0p1});
    right: calc(${theme.spacings.space0p1});
`

const GeneratedApp: React.FunctionComponent<Props> = ({
    app,
    filename,
    showDownloadButton,
    extraButtons,
}) => {
    if (showDownloadButton) {
        const onDownload = () => {
            var zip = new JSZip()
            Object.entries(app).forEach(([filename, contents]) => {
                zip.file(filename, contents)
            })
            zip.generateAsync({ type: 'arraybuffer' }).then((arrayBuffer) => {
                download(filename, arrayBuffer, 'application/zip')
            })
        }
        extraButtons = [
            ...(extraButtons || []),
            <Button key="download" onClick={onDownload}>
                download
            </Button>,
        ]
    }

    return (
        <Container>
            <RootFilename>{filename}</RootFilename>
            <FilesContainer>
                {Object.entries(app).map(([filename, contents]) => (
                    <tr>
                        <td> ∟ {filename}</td>
                        <td>
                            {filesize(
                                typeof contents === 'string'
                                    ? byteCountInString(contents)
                                    : contents.byteLength
                            )}
                        </td>
                    </tr>
                ))}
            </FilesContainer>
            {extraButtons ? (
                <ButtonsContainer>{extraButtons}</ButtonsContainer>
            ) : null}
        </Container>
    )
}
export default GeneratedApp
