import pc from 'picocolors';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function prefixEmoji(text: string, useEmoji: boolean): string {
  if (!useEmoji) return text;
  return `🤖 ${text}`;
}

export function formatStatus(status: string): string {
  switch (status) {
    case 'done':
    case 'reviewed':
    case 'planned':
      return pc.green(status);
    case 'planning':
    case 'implementing':
    case 'reviewing':
      return pc.yellow(status);
    case 'failed':
    case 'aborted':
      return pc.red(status);
    default:
      return status;
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
