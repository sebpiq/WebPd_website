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
    margin-right: ${theme.spacings.space2};
`

const ButtonsContainer = styled.div`
    display: flex;
    flex-direction: row;
`

const Link = styled.a`
    width: 10em;
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
`

const Footer = () => {
    return (
        <Container>
            <InfoContainer>
                WebPd is an open-source project released under the GNU Lesser General Public License v3.0.
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
