import styled from 'styled-components'
import { Select } from '../components'
import { useAppDispatch } from '../store'
import buildInput from '../store/build-input'
import { theme } from '../theme'

interface Props {}

const EXAMPLES = {
    ginger2: {
        display: "Martin's Brinkmann ginger2",
        url: './patches/Martin-Brinkmann-ginger2.pd',
    },
    randomperc1: {
        display: "Martin's Brinkmann randomperc1",
        url: './patches/Martin-Brinkmann-randomperc1.pd'
    }
}

const Container = styled.form`
    display: inline;
`

const ExampleSelect = styled(Select)`
    padding-left: 0;
    padding-top: ${theme.spacings.space0p1};
    text-overflow: ellipsis;
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        width: 100%;
        background-color: transparent;
        text-align: center;
    }
`

const FromExample: React.FunctionComponent<Props> = () => {
    const dispatch = useAppDispatch()

    const onChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
        const example = event.currentTarget.value as keyof typeof EXAMPLES
        dispatch(buildInput.actions.setUrl(EXAMPLES[example].url))
    }

    return (
        <Container>
            <ExampleSelect onChange={onChange}>
                <option value={''}>Load one of the following examples</option>
                {Object.entries(EXAMPLES).map(([key, params]) => (
                    <option value={key} key={key}>{params.display}</option>
                ))}
            </ExampleSelect>
        </Container>
    )
}

export default FromExample
