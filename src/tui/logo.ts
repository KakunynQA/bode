declare const __GOAT_ART__: string;
declare const __GOAT_COMPACT_ART__: string;

export type ArtChoice = 'full' | 'compact' | 'text';

function measureArt(art: string): { width: number; height: number } {
	const lines = art.split('\n');
	let maxWidth = 0;
	for (const line of lines) {
		const visible = stripInvisible(line);
		if (visible.length > maxWidth) maxWidth = visible.length;
	}
	return { width: maxWidth, height: lines.length };
}

function stripInvisible(s: string): string {
	const ESC = '\x1b';
	return s.replace(new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g'), '');
}

export function selectArt(
	termCols: number,
	termRows: number,
	options?: { fullArt?: string; compactArt?: string; textFallback?: string }
): { choice: ArtChoice; art: string } {
	const full = options?.fullArt ?? (typeof __GOAT_ART__ !== 'undefined' ? __GOAT_ART__ : '');
	const compact =
		options?.compactArt ??
		(typeof __GOAT_COMPACT_ART__ !== 'undefined' ? __GOAT_COMPACT_ART__ : '');
	const text = options?.textFallback ?? 'BODE';

	const fullSize = measureArt(full);
	const compactSize = measureArt(compact);

	const reservedRows = 10;
	const availableRows = termRows - reservedRows;

	if (full && fullSize.width <= termCols && fullSize.height <= Math.max(availableRows, 10)) {
		return { choice: 'full', art: full };
	}

	if (
		compact &&
		compactSize.width <= termCols &&
		compactSize.height <= Math.max(availableRows, 8)
	) {
		return { choice: 'compact', art: compact };
	}

	return { choice: 'text', art: text };
}

export function centerArt(art: string, termCols: number): string {
	const lines = art.split('\n');
	return lines
		.map((line) => {
			const visibleLen = stripInvisible(line).length;
			const pad = Math.max(0, Math.floor((termCols - visibleLen) / 2));
			return ' '.repeat(pad) + line;
		})
		.join('\n');
}

export const __testing = { measureArt, stripInvisible };
