import { render, Text, useApp } from 'ink';
import { useEffect } from 'react';

function Smoke() {
	const { exit } = useApp();
	useEffect(() => {
		const t = setTimeout(() => exit(), 50);
		return () => clearTimeout(t);
	}, [exit]);
	return <Text>ok</Text>;
}

render(<Smoke />);
