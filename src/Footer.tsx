import styled from 'styled-components'
import { Box } from './components'
import { theme } from './theme'
import { ReactComponent as GitHubLogoSvg } from './images/github-mark.svg'
import { ReactComponent as HeartSvg } from './images/heart.svg'

const Container = styled(Box)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    & * {
        font-size: 90%;
    }
    background: linear-gradient(
        180deg,
        ${theme.colors.bg2} 33%,
        ${theme.colors.bg2} 60%,
        rgba(0, 0, 0, 0) 100%
    );
    padding-bottom: calc(${theme.spacings.space2} * 2);
`

const InfoContainer = styled.div`
    color: ${theme.colors.fg2};
    margin-right: 1em;
`

const ButtonsContainer = styled.div`
    display: flex;
    flex-direction: row;
    @media (min-width: ${theme.devices.mobile.maxWidth}px) {
        min-width: 10em;
    }
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        flex-direction: column;
        min-width: 5em;
    }
`

const Link = styled.a`
    text-align: right;
    color: ${theme.colors.fg2};

    svg {
        height: 1em;
        width: 1em;
        display: inline;
        position: relative;
        top: 0.2em;
        margin-left: 0.5em;
        path {
            fill: ${theme.colors.fg2};
        }
    }

    @media (min-width: ${theme.devices.mobile.maxWidth}px) {
        width: 10em;
    }

    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        margin-bottom: ${theme.spacings.space1};
        &:last-child {
            margin-bottom: 0;
        }
    }
`

const Footer = () => {
    return (
        <Container>
            <InfoContainer>
                WebPd is an open-source project released under the LGPL v3.0.
                Files uploaded on this web site are not stored on any server.
            </InfoContainer>
            <ButtonsContainer>
                <Link
                    href="https://github.com/sebpiq/WebPd"
                    target="_blank"
                    rel="noopener"
                >
                    GitHub
                    <GitHubLogoSvg viewBox="0 0 97.627 96" />
                </Link>
                <Link
                    href="https://opencollective.com/webpd"
                    target="_blank"
                    rel="noopener"
                >
                    Donate
                    <HeartSvg />
                </Link>
            </ButtonsContainer>
        </Container>
    )
}

export default Footer
