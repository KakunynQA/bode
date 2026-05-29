import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';

type Props = {
	onSubmit: (value: string) => void;
};

export function PromptInput({ onSubmit }: Props): JSX.Element {
	const [value, setValue] = useState('');

	function handleSubmit(submitted: string) {
		setValue('');
		onSubmit(submitted);
	}

	return (
		<Box paddingX={1}>
			<Text color="cyan">{'> '}</Text>
			<TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
		</Box>
	);
}
