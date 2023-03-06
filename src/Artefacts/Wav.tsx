import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import styled from 'styled-components'
import { Artefacts } from 'webpd'
import { Button } from '../components'
import { selectBuildInputFilepath } from '../store/build-input-selectors'
import { theme } from '../theme'
import { download, round } from '../utils'

interface Props {
    wav: NonNullable<Artefacts['wav']>
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
    margin: 0 ${theme.spacings.space1};
    margin-right: calc(${theme.spacings.space1} + 0.5rem);
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

const Volume = styled.div``

const Player = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
`

const Wav: React.FunctionComponent<Props> = ({ wav, showDownloadButton }) => {
    const filepath = useSelector(selectBuildInputFilepath)
    const [isPlaying, setIsPlaying] = useState(false)
    const [, setCurrentTime] = useState(0)
    const volumeDialRef = useRef<HTMLDivElement>(null)

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
        const dial = new Nexus.Dial(volumeDialRef.current!, {
            value: audio.volume,
            min: 0,
            max: 1,
            size: [theme.controls.gridSize * 1, theme.controls.gridSize * 1],
        })
        const color = theme.colors.colorScheme.next()
        dial.on('change', (v: number) => {
            audio.volume = v
        })
        dial.colorize('accent', color)
        dial.colorize('fill', theme.colors.bg1)
        dial.colorize('dark', color)
        dial.colorize('mediumDark', theme.colors.bg1)
        dial.colorize('mediumLight', theme.colors.bg1)
        return () => dial.destroy()
    }, [wav])

    useEffect(() => {
        if (!isPlaying) {
            return
        }
        const interval = setInterval(() => {
            console.log('INTERVAL')
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

    const onDownload = () => {
        download(`${filepath ? filepath : 'audio'}.webpd.wav`, wav, 'audio/wav')
    }

    return (
        <Container>
            <Player>
            {isPlaying ? (
                <Button onClick={onClickPause}>Pause</Button>
            ) : (
                <Button onClick={onClickPlay}>Play</Button>
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
            <Volume>
                <div ref={volumeDialRef}></div>
            </Volume>
            </Player>
            {showDownloadButton ? <Button onClick={onDownload}>Download</Button>: null}
        </Container>
    )
}
export default Wav
