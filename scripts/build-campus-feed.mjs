import { writeFile } from 'node:fs/promises';

const repo = process.env.GITHUB_REPOSITORY ?? '';
const token = process.env.GITHUB_TOKEN;
const output = process.argv[2];
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !token || !output) {
  throw new Error('Expected GITHUB_REPOSITORY, GITHUB_TOKEN and a feed output path');
}

const posts = [];
for (let page = 1; page <= 3; page++) {
  const url = new URL(`https://api.github.com/repos/${repo}/issues`);
  url.search = new URLSearchParams({ state: 'open', sort: 'created', direction: 'desc', per_page: '100', page: String(page) });
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Campus feed: GitHub Issues returned HTTP ${response.status}`);
  const issues = await response.json();
  if (!Array.isArray(issues)) throw new Error('Campus feed: expected an issue list');
  for (const issue of issues) {
    if (issue.pull_request || !/^\[北洋(?:留言|藏梗) (?:OSM1|AMAP1) /.test(issue.title)) continue;
    posts.push({
      number: issue.number,
      state: issue.state,
      title: issue.title,
      body: issue.body?.slice(0, 20_000) ?? '',
      user: { login: issue.user?.login },
      created_at: issue.created_at,
      comments: issue.comments,
    });
  }
  if (issues.length < 100) break;
}
await writeFile(output, JSON.stringify(posts) + '\n');
