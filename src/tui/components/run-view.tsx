import { Box, Text } from 'ink';
import { type ActivityState, type ActivityEntry } from '../activity.ts';

const PEACH = '#FAB283';

function renderEntry(entry: ActivityEntry, i: number): JSX.Element {
	switch (entry.kind) {
		case 'user-task':
			return (
				<Box key={i} flexDirection="column" marginBottom={1}>
					<Box>
						<Text color={PEACH}>{'  \u25B9 '}</Text>
						<Text bold>{entry.text}</Text>
					</Box>
				</Box>
			);
		case 'phase-start':
			return (
				<Box key={i} flexDirection="column" marginLeft={3} marginBottom={0}>
					<Text color="cyan" bold>
						{entry.phase}
					</Text>
				</Box>
			);
		case 'phase-complete':
			return (
				<Box key={i} flexDirection="column" marginLeft={3} marginBottom={1}>
					<Text color="green">
						{'\u2713 '}
						{entry.phase} complete
					</Text>
					{entry.taskKey && (
						<Box marginLeft={2}>
							<Text dimColor>
								{entry.taskKey} {'\u00B7'} {entry.phase}
							</Text>
						</Box>
					)}
				</Box>
			);
		case 'command-output':
			return (
				<Box key={i} marginLeft={3}>
					<Text dimColor>{entry.text}</Text>
				</Box>
			);
		case 'artifact':
			return (
				<Box key={i} marginLeft={3}>
					<Text dimColor>
						{'  \u2192 '}
						{entry.label}: {entry.path}
					</Text>
				</Box>
			);
		case 'info':
			return (
				<Box key={i} marginLeft={3}>
					<Text dimColor>{entry.text}</Text>
				</Box>
			);
		case 'warning':
			return (
				<Box key={i} marginLeft={3}>
					<Text color="yellow">{'! ' + entry.text}</Text>
				</Box>
			);
		case 'error':
			return (
				<Box key={i} marginLeft={3}>
					<Text color="red">{'error: ' + entry.text}</Text>
					{entry.exitCode !== undefined && entry.exitCode !== 0 && (
						<Text dimColor>{' (exit ' + entry.exitCode + ')'}</Text>
					)}
				</Box>
			);
		case 'success':
			return (
				<Box key={i} marginLeft={3} marginBottom={1}>
					<Text color="green">
						{'\u2713 '}
						{entry.text}
					</Text>
					{entry.exitCode !== undefined && entry.exitCode !== 0 && (
						<Text dimColor>{' (exit ' + entry.exitCode + ')'}</Text>
					)}
				</Box>
			);
	}
}

export function RunView({ activity }: { activity: ActivityState }): JSX.Element {
	return (
		<Box flexDirection="column" paddingX={2}>
			{activity.entries.map((entry, i) => renderEntry(entry, i))}
		</Box>
	);
}

export function formatActivityForSnapshot(activity: ActivityState): string {
	const lines: string[] = [];
	for (const entry of activity.entries) {
		switch (entry.kind) {
			case 'user-task':
				lines.push(`  ▸ ${entry.text}`);
				break;
			case 'phase-start':
				lines.push(`     ${entry.phase}`);
				break;
			case 'phase-complete':
				lines.push(`     ✓ ${entry.phase} complete`);
				if (entry.taskKey) lines.push(`       ${entry.taskKey} · ${entry.phase}`);
				break;
			case 'command-output':
				lines.push(`     ${entry.text}`);
				break;
			case 'artifact':
				lines.push(`     → ${entry.label}: ${entry.path}`);
				break;
			case 'info':
				lines.push(`     ${entry.text}`);
				break;
			case 'warning':
				lines.push(`     ! ${entry.text}`);
				break;
			case 'error':
				lines.push(
					`     error: ${entry.text}${entry.exitCode !== undefined && entry.exitCode !== 0 ? ` (exit ${entry.exitCode})` : ''}`
				);
				break;
			case 'success':
				lines.push(
					`     ✓ ${entry.text}${entry.exitCode !== undefined && entry.exitCode !== 0 ? ` (exit ${entry.exitCode})` : ''}`
				);
				break;
		}
	}
	return lines.join('\n');
}
