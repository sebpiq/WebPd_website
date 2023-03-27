import styled from 'styled-components'
import { Box, H3, Hint } from './components'
import { useAppSelector } from './store'
import {
    selectConsoleErrors,
    selectConsoleWarnings,
} from './store/console-selectors'
import { theme } from './theme'

const Container = styled(Box)``

const WarningContainer = styled.pre`
    overflow: auto;
    margin: 0;
`

const ErrorContainer = styled.pre`
    overflow: auto;
    margin: 0;
    color: ${theme.colors.colorScheme.next()};
`

const MessagesContainer = styled.div`
    margin-top: ${theme.spacings.space1};
`

const MoreOptionsContainer = styled(Hint)`
    margin-top: ${theme.spacings.space2};
`

const Console: React.FunctionComponent = () => {
    const errors = useAppSelector(selectConsoleErrors)
    const warnings = useAppSelector(selectConsoleWarnings)
    const hasErrors = errors && errors.length
    const hasWarnings = warnings && warnings.length
    if (!hasErrors && !hasWarnings) {
        return null
    }

    const compilationWarningsOrErrors = (
        <>
            WebPd is still in alpha release and many patches will likely not
            work (for now). You can find the list of implemented objects <a
                href="https://github.com/sebpiq/WebPd/blob/main/ROADMAP.md"
                target="_blank"
                rel="noreferrer"
            >
                here
            </a>. 
            If failure was caused by a missing feature, you can
            either{' '}
            <a
                href="https://opencollective.com/webpd"
                target="_blank"
                rel="noreferrer"
            >
                donate
            </a>{' '}
            to speed up its implementation, or you can directly{' '}
            <a
                href="https://github.com/sebpiq/WebPd/#contributing"
                target="_blank"
                rel="noreferrer"
            >
                contribute to development
            </a>
            . If, on the other hand, this looks like a bug, thanks for{' '}
            <a
                href="https://github.com/sebpiq/WebPd/#reporting-a-bug"
                target="_blank"
                rel="noreferrer"
            >
                reporting it here.
            </a>
        </>
    )

    return (
        <Container>
            <H3>Compilation output :</H3>
            <MessagesContainer>
                {hasWarnings
                    ? warnings.map((warning, i) => (
                          <WarningContainer key={i}>
                              WARNING : {warning}
                          </WarningContainer>
                      ))
                    : null}
                {hasErrors
                    ? errors.map((error, i) => (
                          <ErrorContainer key={i}>
                              ERROR : {error}
                          </ErrorContainer>
                      ))
                    : null}
            </MessagesContainer>
            {hasErrors || hasWarnings ? (
                <MoreOptionsContainer>
                    {hasErrors ? 'It seems like your compilation failed 😢.': 'It seems like your compilation succeeded but with warnings 😅.'}
                    <br />
                    {compilationWarningsOrErrors}
                </MoreOptionsContainer>
            ) : null}
        </Container>
    )
}

export default Console
