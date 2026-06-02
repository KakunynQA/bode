export type ComposerState = {
	lines: string[];
	cursorLine: number;
	cursorCol: number;
};

export type ComposerAction =
	| { kind: 'char'; value: string }
	| { kind: 'backspace' }
	| { kind: 'delete' }
	| { kind: 'left' }
	| { kind: 'right' }
	| { kind: 'up' }
	| { kind: 'down' }
	| { kind: 'home' }
	| { kind: 'end' }
	| { kind: 'newline' }
	| { kind: 'submit' }
	| { kind: 'clear' }
	| { kind: 'setText'; value: string }
	| { kind: 'killLine' }
	| { kind: 'killToStart' }
	| { kind: 'deleteWord' };

export function createComposerState(): ComposerState {
	return { lines: [''], cursorLine: 0, cursorCol: 0 };
}

export function reduceComposer(state: ComposerState, action: ComposerAction): ComposerState {
	switch (action.kind) {
		case 'char': {
			if (!action.value) return state;
			const lines = [...state.lines];
			const line = lines[state.cursorLine] ?? '';
			lines[state.cursorLine] =
				line.slice(0, state.cursorCol) + action.value + line.slice(state.cursorCol);
			return { ...state, lines, cursorCol: state.cursorCol + action.value.length };
		}
		case 'backspace': {
			if (state.cursorCol === 0 && state.cursorLine === 0) return state;
			if (state.cursorCol === 0) {
				const prevLine = state.lines[state.cursorLine - 1] ?? '';
				const curLine = state.lines[state.cursorLine] ?? '';
				const lines = [...state.lines];
				lines[state.cursorLine - 1] = prevLine + curLine;
				lines.splice(state.cursorLine, 1);
				return {
					...state,
					lines,
					cursorLine: state.cursorLine - 1,
					cursorCol: prevLine.length,
				};
			}
			const lines = [...state.lines];
			const line = lines[state.cursorLine] ?? '';
			lines[state.cursorLine] = line.slice(0, state.cursorCol - 1) + line.slice(state.cursorCol);
			return { ...state, lines, cursorCol: state.cursorCol - 1 };
		}
		case 'delete': {
			const line = state.lines[state.cursorLine] ?? '';
			if (state.cursorCol < line.length) {
				const lines = [...state.lines];
				lines[state.cursorLine] = line.slice(0, state.cursorCol) + line.slice(state.cursorCol + 1);
				return { ...state, lines };
			}
			if (state.cursorLine < state.lines.length - 1) {
				const nextLine = state.lines[state.cursorLine + 1] ?? '';
				const lines = [...state.lines];
				lines[state.cursorLine] = line + nextLine;
				lines.splice(state.cursorLine + 1, 1);
				return { ...state, lines };
			}
			return state;
		}
		case 'left': {
			if (state.cursorCol > 0) return { ...state, cursorCol: state.cursorCol - 1 };
			if (state.cursorLine > 0) {
				const prevLen = (state.lines[state.cursorLine - 1] ?? '').length;
				return { ...state, cursorLine: state.cursorLine - 1, cursorCol: prevLen };
			}
			return state;
		}
		case 'right': {
			const lineLen = (state.lines[state.cursorLine] ?? '').length;
			if (state.cursorCol < lineLen) return { ...state, cursorCol: state.cursorCol + 1 };
			if (state.cursorLine < state.lines.length - 1) {
				return { ...state, cursorLine: state.cursorLine + 1, cursorCol: 0 };
			}
			return state;
		}
		case 'up': {
			if (state.cursorLine === 0) return state;
			const prevLen = (state.lines[state.cursorLine - 1] ?? '').length;
			return {
				...state,
				cursorLine: state.cursorLine - 1,
				cursorCol: Math.min(state.cursorCol, prevLen),
			};
		}
		case 'down': {
			if (state.cursorLine >= state.lines.length - 1) return state;
			const nextLen = (state.lines[state.cursorLine + 1] ?? '').length;
			return {
				...state,
				cursorLine: state.cursorLine + 1,
				cursorCol: Math.min(state.cursorCol, nextLen),
			};
		}
		case 'home':
			return { ...state, cursorCol: 0 };
		case 'end':
			return { ...state, cursorCol: (state.lines[state.cursorLine] ?? '').length };
		case 'newline': {
			const line = state.lines[state.cursorLine] ?? '';
			const lines = [...state.lines];
			const before = line.slice(0, state.cursorCol);
			const after = line.slice(state.cursorCol);
			lines[state.cursorLine] = before;
			lines.splice(state.cursorLine + 1, 0, after);
			return { ...state, lines, cursorLine: state.cursorLine + 1, cursorCol: 0 };
		}
		case 'submit':
			return state;
		case 'clear':
			return createComposerState();
		case 'setText': {
			const newLines = action.value.split('\n');
			return {
				lines: newLines,
				cursorLine: newLines.length - 1,
				cursorCol: (newLines[newLines.length - 1] ?? '').length,
			};
		}
		case 'killLine': {
			const lines = [...state.lines];
			const line = lines[state.cursorLine] ?? '';
			lines[state.cursorLine] = line.slice(0, state.cursorCol);
			return { ...state, lines };
		}
		case 'killToStart': {
			const lines = [...state.lines];
			const line = lines[state.cursorLine] ?? '';
			lines[state.cursorLine] = line.slice(state.cursorCol);
			return { ...state, lines, cursorCol: 0 };
		}
		case 'deleteWord': {
			const lines = [...state.lines];
			const line = lines[state.cursorLine] ?? '';
			let col = state.cursorCol;
			while (col > 0 && line[col - 1] === ' ') col--;
			while (col > 0 && line[col - 1] !== ' ') col--;
			lines[state.cursorLine] = line.slice(0, col) + line.slice(state.cursorCol);
			return { ...state, lines, cursorCol: col };
		}
		default:
			return state;
	}
}

export function composerText(state: ComposerState): string {
	return state.lines.join('\n');
}

export function composerIsEmpty(state: ComposerState): boolean {
	return state.lines.length === 1 && state.lines[0] === '';
}

export function linearCursorOffset(state: ComposerState): number {
	let offset = 0;
	for (let i = 0; i < state.cursorLine; i++) {
		offset += (state.lines[i] ?? '').length + 1;
	}
	offset += state.cursorCol;
	return offset;
}
