import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { VcsAdapter, PullRequest } from '~/types/vcs.ts';
import type { Result } from '~/types/result.ts';

const execFileAsync = promisify(execFile);

export class GitHubAdapter implements VcsAdapter {
  async createPullRequest(options: {
    title: string;
    body: string;
    head: string;
    base?: string;
    signal?: AbortSignal;
  }): Promise<Result<PullRequest>> {
    try {
      const args = [
        'pr', 'create',
        '--title', options.title,
        '--body', options.body,
        '--head', options.head,
      ];
      if (options.base) {
        args.push('--base', options.base);
      }

      const { stdout } = await execFileAsync('gh', args, { signal: options.signal ?? undefined });
      const url = stdout.trim().split('\n').pop() ?? '';

      const prNumber = parseInt(url.split('/').pop() ?? '0', 10);

      return {
        ok: true,
        value: {
          number: prNumber,
          url,
          title: options.title,
          body: options.body,
          headBranch: options.head,
          baseBranch: options.base ?? 'main',
        },
      };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async addComment(prNumber: number, body: string, signal?: AbortSignal): Promise<Result<void>> {
    try {
      await execFileAsync('gh', ['pr', 'comment', String(prNumber), '--body', body], {
        signal: signal ?? undefined,
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async detectRemote(): Promise<Result<{ type: 'github' | 'gitlab'; org: string; repo: string }>> {
    try {
      const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin']);
      const url = stdout.trim();

      const sshMatch = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
      if (sshMatch?.[1] && sshMatch[2]) {
        return {
          ok: true,
          value: { type: 'github', org: sshMatch[1], repo: sshMatch[2] },
        };
      }

      const httpsMatch = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
      if (httpsMatch?.[1] && httpsMatch[2]) {
        return {
          ok: true,
          value: { type: 'github', org: httpsMatch[1], repo: httpsMatch[2] },
        };
      }

      return { ok: false, error: new Error('Could not parse GitHub remote URL') };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }
}
