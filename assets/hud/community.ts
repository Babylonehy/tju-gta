import { ATLAS_REVISION, distance, fromLegacy, nearestSpot, onCampus, type Point } from '../campus/atlas.ts';
import { LIMITS as LEGACY_LIMITS } from '../campus/survey.ts';
export const POST_LIMIT = 280;
export type PostKind = 'note' | 'meme';
const CAMPUS_REFERENCES = /北洋园|郑东|青年湖|诚园|平园|齐园|三问桥|求是大道|宣怀|大通|海棠堤|太雷|七星路|敬业湖|北洋狮|求实会堂|天大之星|天津大学星|北洋大学|静算楼|四十七教|47 教/i;
const UNIVERSITY = /\bTJU\b|天大|天津大学/i;
const CAMPUS_LIFE = /食堂|宿舍|图书馆|校庆|校史|社团|校园|校训|实验室|上课|教学楼|运动会|操场|校友|军训|课程|老师/;
export const connectsToTju = (title:string,body:string) =>
  CAMPUS_REFERENCES.test(title+' '+body) || UNIVERSITY.test(title+' '+body) && CAMPUS_LIFE.test(body);
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/;
const PHOTO = /^https:\/\/(?:github\.com\/user-attachments\/assets\/[\da-f-]+|user-images\.githubusercontent\.com\/[\w./%-]+|private-user-images\.githubusercontent\.com\/[\w./%-]+(?:\?[^\s<>"]+)?)$/i;
const PICTURE_MD = /!\[[^\]\r\n]*\]\((https:\/\/[^\s)]+)\)/g;
const PICTURE_HTML = /<img\b[^>]*?\ssrc=["'](https:\/\/[^"'\s>]+)["'][^>]*>/gi;
export interface Post extends Point { id: number; kind: PostKind; title: string; author: string; date: string; message: string; images: string[]; url?: string; replies: number }
export function repoName(value: unknown) { return typeof value === 'string' && REPO.test(value) ? value : ''; }
export async function getRepository(signal: AbortSignal) {
  try {
    const res = await fetch(new URL('campus-config.json',document.baseURI),{signal});
    if (res.ok) return repoName((await res.json()).repository);
  } catch { /* Unconfigured local Preview does not have a feed. */ }
  return '';
}
export function newIssueUrl(repo: string, p: Point, message: string, kind: PostKind = 'note', name = '') {
  if (!repoName(repo) || !onCampus(p)) throw new Error('无效的公开留言位置');
  const heading = name.trim().replace(/\s+/g,' ').slice(0,36);
  if (kind === 'meme' && (!heading || !message.trim() || !connectsToTju(heading,message))) throw new Error('请填写梗名、含义，并写出与天津大学的联系。');
  const title = `[${kind==='meme'?'北洋藏梗':'北洋留言'} ${ATLAS_REVISION} ${p.x.toFixed(1)},${p.z.toFixed(1)}] ${kind==='meme'?heading:nearestSpot(p).name}`;
  const body = message.trim().slice(0,POST_LIMIT) + '\n\n<!-- 如要发照片，请把 JPG / PNG 拖到这条注释下面。保留标题里的坐标。 -->\n';
  return 'https://github.com/' + repo + '/issues/new?' + new URLSearchParams({title,body}).toString();
}
export function issueToPost(value: unknown, repo: string): Post | null {
  if (!value || typeof value !== 'object') return null;
  const issue = value as { title?:unknown; body?:unknown; state?:unknown; pull_request?:unknown; number?:unknown; user?:{login?:unknown}; created_at?:unknown; comments?:unknown };
  if (issue.state !== 'open' || issue.pull_request || typeof issue.title !== 'string' || typeof issue.number !== 'number' || !Number.isSafeInteger(issue.number) || issue.number < 1) return null;
  const match = /^\[(北洋留言|北洋藏梗) ([A-Z0-9]+) (-?\d{1,4}(?:\.\d)?),(-?\d{1,4}(?:\.\d)?)\](?: ([^\r\n]{1,64}))?$/.exec(issue.title);
  if (!match || (match[2] !== ATLAS_REVISION && match[2] !== 'AMAP1')) return null;
  let p = {x:Number(match[3]),z:Number(match[4])};
  if(match[2]==='AMAP1'){
    const {minX,maxX,minZ,maxZ}=LEGACY_LIMITS;
    if(p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ)return null;
    p=fromLegacy(p);
  }
  if (!onCampus(p) || !repoName(repo)) return null;
  const images: string[] = [];
  const takePhoto = (_: string, raw: string) => {
    const url = raw.replaceAll('&amp;','&');
    if (PHOTO.test(url) && !images.includes(url) && images.length < 4) images.push(url);
    return '';
  };
  const message = (typeof issue.body === 'string' ? issue.body.slice(0,20000) : '').replace(/<!--[\s\S]*?-->/g,'')
    .replace(PICTURE_MD,takePhoto).replace(PICTURE_HTML,takePhoto).trim().slice(0,POST_LIMIT);
  const kind: PostKind = match[1] === '北洋藏梗' ? 'meme' : 'note';
  const title = (match[5] ?? '').trim().slice(0,36);
  if ((!message && !images.length) || (kind === 'meme' && (!title || !message || !connectsToTju(title,message)))) return null;
  return {...p,id:issue.number,kind,title, author: typeof issue.user?.login === 'string' ? issue.user.login : '访客',
    date:typeof issue.created_at === 'string' ? issue.created_at : '', message, images,
    url:'https://github.com/' + repo + '/issues/' + issue.number, replies:typeof issue.comments === 'number' ? issue.comments : 0};
}
export async function loadPosts(repo: string, signal: AbortSignal): Promise<Post[]> {
  if (!repoName(repo)) return [];
  const posts: Post[] = [];
  for (let page=1;page<=3 && posts.length<100;page++) {
    const url = `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=100&page=${page}`;
    const response = await fetch(url,{signal,headers:{Accept:'application/vnd.github+json'},cache:'no-cache'});
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub 读取次数暂时用完了，请稍后刷新。');
      if (response.status === 404 || response.status === 410) throw new Error('找不到公开留言板。请确认仓库公开并开启 Issues。');
      throw new Error('暂时无法读取校园留言，请稍后重试。');
    }
    const issues: unknown = await response.json();
    if (!Array.isArray(issues)) throw new Error('留言板返回了无法读取的数据。');
    for (const issue of issues) { const post = issueToPost(issue,repo); if(post) posts.push(post); }
    if (issues.length<100) break;
  }
  return posts.slice(0,100);
}
export function findHiddenPost(posts: readonly Post[], p: Point, unlocked: ReadonlySet<number>, radius = 3.7) {
  return posts.filter(post => post.kind === 'meme' && !unlocked.has(post.id) && distance(post,p) <= radius)
    .sort((a,b) => distance(a,p)-distance(b,p))[0];
}
export const DEMO: Post[] = [
  {id:-1,kind:'note',title:'东门',x:1081,z:149,author:'北洋漫梗 · 示例',date:'',message:'从东门沿中轴一路向西，可以把圆楼、三问桥和方形图书馆一次逛完。',images:[],replies:0},
  {id:-2,kind:'note',title:'三问桥',x:634,z:55,author:'北洋漫梗 · 示例',date:'',message:'找星星的时候别走太快，记得往桥边看。',images:[],replies:0},
  {id:-4,kind:'meme',title:'天大圆方联动',x:1079,z:146,author:'北洋漫梗 · 示例',date:'',message:'在东门看到圆形主楼，又在中轴尽头看到方形的郑东图书馆。天大版“梦幻联动”：本来像两个不同画风，沿求是大道走一趟，发现是同一张校园地图的圆和方。',images:[],replies:0},
  {id:-3,kind:'note',title:'青年湖',x:-116,z:186,author:'北洋漫梗 · 示例',date:'',message:'骑到湖边吹风。试试从湖的南岸慢慢绕回中心岛。',images:[],replies:0},
];
