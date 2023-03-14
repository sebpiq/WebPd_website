import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { Build } from 'webpd'
import {
    ArtefactButtonsContainer as ArtefactButtonsContainerBase,
    Button,
    ButtonActive,
} from '../components'
import { theme } from '../theme'
import { download, round } from '../utils'

interface Props {
    wav: NonNullable<Build.Artefacts['wav']>
    showDownloadButton?: boolean
    extraButtons?: Array<JSX.Element>
}

const formatTime = (timeSeconds: number) => {
    const intPart = Math.floor(round(timeSeconds, 2))
    return `${intPart.toString().padStart(3, '0')}`
}

const Container = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        flex-direction: column-reverse;
        align-items: flex-end;
    }
`

const Time = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    min-width: 4em;
    margin: 0 ${theme.spacings.space1};
    font-size: ${theme.fontSizes.h2};
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        font-size: 120%;
    }
    & > span {
        font-size: 100%;
    }
    & > span:nth-child(1) {
        text-align: right;
    }
    & > span:nth-child(2) {
        text-align: center;
    }
`

const Player = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex: auto;
    margin-right: ${theme.spacings.space1};
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        align-self: stretch;
        margin-right: 0;
    }
    @media (max-width: 400px) {
        font-size: 50%;
    }

`

const PlayPauseButton = styled(ButtonActive)`
    min-width: 4.5em;
    align-self: stretch;
    @media (max-width: 700px) {
        font-size: 80%;
    }
`

const VolumeContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-self: stretch;
`

const VolumeButton = styled(ButtonActive)`
    min-width: 3em;
    @media (max-width: 700px) {
        font-size: 80%;
    }
`

const ArtefactButtonsContainer = styled(ArtefactButtonsContainerBase)`
    align-self: stretch;
    display: flex;
    align-items: stretch;
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        justify-content: flex-end;
        margin-bottom: ${theme.spacings.space1};
    }
`

const Wav: React.FunctionComponent<Props> = ({
    wav,
    showDownloadButton,
    extraButtons,
}) => {
    const [isPlaying, setIsPlaying] = useState(false)
    const [, setCurrentTime] = useState(0)

    const audio = useMemo(() => {
        const audio = new Audio(
            URL.createObjectURL(
                new Blob([wav], {
                    type: 'audio/wav',
                })
            )
        )
        const onPlay = () => {
            setIsPlaying(true)
        }
        const onPause = () => {
            setIsPlaying(false)
        }
        const onEnded = () => {
            setIsPlaying(false)
        }
        audio.onplay = onPlay
        audio.onpause = onPause
        audio.onended = onEnded
        return audio
    }, [wav])

    useEffect(() => {
        if (!isPlaying) {
            return
        }
        const interval = setInterval(() => {
            setCurrentTime(audio.currentTime)
        }, 100)
        return () => clearInterval(interval)
    }, [isPlaying])

    const onClickPlay = () => {
        if (!audio.paused) {
            setIsPlaying(true)
        }
        audio.play()
    }

    const onClickPause = () => {
        if (audio.paused) {
            setIsPlaying(false)
        }
        audio.pause()
    }

    const onVolumeUp = () => {
        audio.volume += 0.05
    }

    const onVolumeDown = () => {
        audio.volume -= 0.05
    }

    const onDownload = () => {
        download(`audio.webpd.wav`, wav, 'audio/wav')
    }

    return (
        <Container>
            <Player>
                {isPlaying ? (
                    <PlayPauseButton onClick={onClickPause}>
                        Pause
                    </PlayPauseButton>
                ) : (
                    <PlayPauseButton onClick={onClickPlay}>
                        Play
                    </PlayPauseButton>
                )}
                <Time>
                    <span>{formatTime(audio.currentTime)}</span>
                    <span>/</span>
                    <span>
                        {isNaN(audio.duration)
                            ? formatTime(0)
                            : formatTime(audio.duration)}
                    </span>
                </Time>
                <VolumeContainer>
                    <VolumeButton onClick={onVolumeDown}>-</VolumeButton>
                    <VolumeButton onClick={onVolumeUp}>+</VolumeButton>
                </VolumeContainer>
            </Player>
            <ArtefactButtonsContainer>
                {extraButtons ? extraButtons : null}
                {showDownloadButton ? (
                    <Button onClick={onDownload}>download</Button>
                ) : null}
            </ArtefactButtonsContainer>
        </Container>
    )
}
export default Wav
