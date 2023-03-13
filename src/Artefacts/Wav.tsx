import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { Build } from 'webpd'
import { Button, ButtonActive } from '../components'
import { theme } from '../theme'
import { download, round } from '../utils'
import { ReactComponent as VolumeSvg } from '../images/volume.svg'

interface Props {
    wav: NonNullable<Build.Artefacts['wav']>
    showDownloadButton?: boolean
}

const formatTime = (timeSeconds: number) => {
    const rounded = round(timeSeconds, 2)
    const decimalPart = rounded % 1
    const intPart = Math.floor(rounded)
    const decimalStrParts = decimalPart.toString().split('.')
    let decimalStr = '00'
    if (decimalStrParts[1]) {
        decimalStr = decimalStrParts[1].slice(0, 2).padEnd(2, '0')
    }

    return `${intPart.toString().padStart(2, '0')}:${decimalStr}`
}

const Container = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
`

const Time = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 6em;
    margin: 0 calc(${theme.spacings.space1} + 0.5rem);
    font-size: ${theme.fontSizes.h2};
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

const Volume = styled.div<{ value: number }>`
    cursor: pointer;
    position: relative;
    bottom: 0.15em;
    svg {
        display: block;
        height: 1.25em;
        width: 4em;
    }

    svg:first-child {
    }

    svg:last-child {
        position: absolute;
        top: 0;
        clip-path: polygon(0% 0%, ${(props) => props.value * 100}% 0%, ${(props) => props.value * 100}% 100%, 0% 100%);
        path {
            fill: ${theme.colors.colorScheme.next()};
        }
    }
`

const Player = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    flex: auto;
`

const PlayPauseButton = styled(ButtonActive)`
    min-width: 4.5em;
`

const Wav: React.FunctionComponent<Props> = ({ wav, showDownloadButton }) => {
    const [isPlaying, setIsPlaying] = useState(false)
    const [, setCurrentTime] = useState(0)
    const [isChangingVolume, setIsChangingVolume] = useState(false)
    const [, setCurrentVolume] = useState(0)
    const volumeChangeStartPrevX = useRef(0)

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
        if (isChangingVolume === false) {
            return
        }

        const onPointerUp = () => {
            console.log('POINTER UP')
            setIsChangingVolume(false)
        }

        const onPointerMove = (event: PointerEvent) => {
            audio.volume = Math.max(
                Math.min(audio.volume + (event.clientX - volumeChangeStartPrevX.current) / 50, 1),
                0
            )
            setCurrentVolume(audio.volume)
            volumeChangeStartPrevX.current = event.clientX
        }

        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointermove', onPointerMove)
        return () => {
            console.log('DESTROU CHANGING')
            window.removeEventListener('pointerup', onPointerUp)
            window.removeEventListener('pointermove', onPointerMove)
        }
    }, [isChangingVolume])

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

    const onStartVolumeChange: React.PointerEventHandler<HTMLDivElement> = (
        event
    ) => {
        setIsChangingVolume(true)
        volumeChangeStartPrevX.current = event.clientX
    }

    const onDownload = () => {
        download(`audio.webpd.wav`, wav, 'audio/wav')
    }

    return (
        <Container>
            <Player>
                {isPlaying ? (
                    <PlayPauseButton onClick={onClickPause}>Pause</PlayPauseButton>
                ) : (
                    <PlayPauseButton onClick={onClickPlay}>Play</PlayPauseButton>
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
                <Volume
                    value={audio.volume}
                    onPointerDown={onStartVolumeChange}
                >
                    <VolumeSvg />
                    <VolumeSvg />
                </Volume>
            </Player>
            {showDownloadButton ? (
                <Button onClick={onDownload}>Download</Button>
            ) : null}
        </Container>
    )
}
export default Wav
