import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const repo = process.env.GITHUB_REPOSITORY || '';
const prefix = (process.env.PAGES_BASE ?? '').replace(/^\/+|\/+$/g,'');
if (prefix && !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(prefix)) throw new Error('Unexpected GitHub Pages base path');
if (repo && !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Unexpected GITHUB_REPOSITORY');
const base = prefix ? '/' + prefix + '/' : '/';
const cli = join(root,'node_modules','@forgeax','engine','dist','bin','forgeax.mjs');
const run = spawnSync(process.execPath,[cli,'project','build','--base',base,'--out-dir','dist-pages','--json'],{cwd:root,stdio:'inherit'});
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);
writeFileSync(join(root,'dist-pages','campus-config.json'),JSON.stringify({repository:repo})+'\n');
writeFileSync(join(root,'dist-pages','.nojekyll'),'');
