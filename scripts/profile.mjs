// Generates assets/profile.svg: one scene with hero, about, stack and live GitHub stats.
// Run by .github/workflows/profile.yml.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USER = process.env.GH_USER || 'bidyut-kr-das';
const ICE = ['#13243D', '#1D4E73', '#2C82AE', '#56C2E6', '#D4F3FF'];
const AURORA = ['#5EEAD4', '#38BDF8', '#818CF8', '#A78BFA', '#7DD3FC', '#CFE8FF'];
const HIDE_LANGS = new Set(['Jupyter Notebook', 'PHP', 'CSS', 'HTML']);

const ABOUT = [
  ['role', 'Software Engineer'],
  ['focus', 'backend, full-stack, AI integration, DevOps'],
  ['building', 'Next.js, TypeScript, PostgreSQL, Docker, GenAI'],
  ['learning', 'system design, advanced data structures'],
  ['contact', 'bkdas2017.bd@gmail.com'],
  ['uptime', 'always learning, optimizing everything I touch'],
];
const STACK = [
  ['languages', '#5EEAD4', 'ts,js,py,java,cpp,c'],
  ['frontend', '#4FD8E0', 'react,nextjs,vite,tailwind,redux'],
  ['backend', '#38BDF8', 'nodejs,express,django,flask,spring'],
  ['data', '#60A5FA', 'postgres,mongodb,mysql,sqlite,prisma'],
  ['devops', '#818CF8', 'docker,githubactions,vercel,linux,bash,git'],
  ['tools', '#A78BFA', 'postman,vscode,github'],
];
const PILLS = ['RAG systems', 'Google GenAI', 'Django REST Framework', 'Drizzle ORM', 'Playwright'];

// ponytail: first 100 owned repos only, paginate if the account outgrows it
const QUERY = `query($login: String!) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
      nodes { stargazerCount languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } } }
    }
    contributionsCollection {
      totalPullRequestContributions
      contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } }
    }
  }
}`;

async function fetchData() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  const { data, errors } = await res.json();
  if (errors || !data?.user) throw new Error(JSON.stringify(errors ?? data));
  const { repositories, contributionsCollection: cc } = data.user;

  const langs = {};
  for (const r of repositories.nodes)
    for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;

  return {
    weeks: cc.contributionCalendar.weeks.map(w => w.contributionDays),
    total: cc.contributionCalendar.totalContributions,
    prs: cc.totalPullRequestContributions,
    stars: repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    langs,
  };
}

// Icons are inlined as data URIs: an SVG shown via <img> can't load external images.
export async function fetchIcons() {
  const icons = {};
  await Promise.all(STACK.flatMap(s => s[2].split(',')).map(async id => {
    const res = await fetch(`https://skillicons.dev/icons?i=${id}&theme=dark`);
    const svg = await res.text();
    if (!res.ok || !svg.includes('<svg')) throw new Error(`skillicons: no icon for ${id}`);
    icons[id] = Buffer.from(svg).toString('base64');
  }));
  return icons;
}

export function streaks(weeks) {
  const days = weeks.flat();
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
  // Today with no commits yet doesn't break the current streak.
  let i = days.length - 1, current = 0;
  if (i >= 0 && !days[i].contributionCount) i--;
  while (i >= 0 && days[i].contributionCount) { current++; i--; }
  return { current, longest };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = n => n.toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const W = 1000;

function rng(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function sky(H) {
  const r = rng(42);
  const stars = Array.from({ length: 60 }, (_, i) => {
    const y = 250 * r() ** 1.3, x = r() * W, rad = (0.6 + r() * 0.8).toFixed(2);
    const tw = i % 4 === 0 ? ` class="tw" style="animation-delay:-${(r() * 3).toFixed(1)}s"` : '';
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad}"${tw}/>`;
  }).join('');
  const snow = Array.from({ length: 22 }, () => {
    const dur = 24 + r() * 20;
    return `<circle cx="${(r() * (W + 120)).toFixed(0)}" cy="0" r="${(0.9 + r() * 1.1).toFixed(1)}" opacity="${(0.3 + r() * 0.4).toFixed(2)}" class="sn" style="animation-duration:${dur.toFixed(1)}s;animation-delay:-${(r() * dur).toFixed(1)}s"/>`;
  }).join('');
  return { stars, snow };
}

function mountains(oy) {
  const p = pts => pts.replace(/(\d+),(\d+)/g, (_, x, y) => `${x},${+y + oy}`);
  return `<polygon fill="#11284A" points="${p('0,340 0,282 90,246 160,266 250,214 330,256 420,232 520,270 600,228 700,252 790,206 880,250 1000,226 1000,340')}"/>
<polygon fill="#CFE8FF" opacity=".35" points="${p('250,214 232,225 242,224 250,231 258,223 268,225')}"/>
<polygon fill="#CFE8FF" opacity=".35" points="${p('790,206 770,218 781,217 790,225 799,216 810,219')}"/>
<polygon fill="#071122" points="${p('0,340 0,306 120,286 230,310 360,282 470,306 610,290 740,314 860,292 1000,302 1000,340')}"/>`;
}

const prompt = (y, cmd) => `<text x="56" y="${y}" class="p">$ <tspan class="v">${esc(cmd)}</tspan></text>`;

export function render({ weeks, total, prs, stars, langs }, icons) {
  const { current, longest } = streaks(weeks);
  const out = [];

  // About
  let y = 300;
  out.push(prompt(y, 'cat about.md'));
  ABOUT.forEach(([k, v], i) => {
    const ry = y + 40 + i * 28;
    out.push(`<text x="56" y="${ry}" class="k">${k}</text><text x="176" y="${ry}" class="v">${esc(v)}</text>`);
  });

  // Stack: two columns of skillicons, then pills for things without an icon
  y += 40 + ABOUT.length * 28 + 50;
  out.push(prompt(y, 'ls ~/stack'));
  STACK.forEach(([name, color, ids], i) => {
    const cx = i % 2 ? 528 : 56, cy = y + 36 + Math.floor(i / 2) * 88;
    out.push(`<text x="${cx}" y="${cy}" class="s" fill="${color}">${name}/</text>`);
    ids.split(',').forEach((id, j) =>
      out.push(`<image x="${cx + j * 52}" y="${cy + 12}" width="40" height="40" href="data:image/svg+xml;base64,${icons[id]}"><title>${id}</title></image>`));
  });
  y += 36 + 3 * 88;
  out.push(`<text x="56" y="${y}" class="s" fill="#C4B5FD">also/</text>`);
  let px = 56;
  for (const p of PILLS) {
    const w = Math.round(p.length * 7.8 + 28);
    out.push(`<rect x="${px}" y="${y + 12}" width="${w}" height="28" rx="14" fill="#12233D" stroke="#1E3A5F"/><text x="${px + w / 2}" y="${y + 31}" text-anchor="middle" class="pill">${esc(p)}</text>`);
    px += w + 10;
  }

  // Stats
  y += 100;
  out.push(prompt(y, `frost stats --user ${USER}`));
  [
    [num(total), 'contributions'],
    [`${current}d`, 'current streak'],
    [`${longest}d`, 'longest streak'],
    [num(stars), 'stars earned'],
    [num(prs), 'pull requests'],
  ].forEach(([v, l], i) => {
    const x = 56 + i * 184;
    out.push(`<text x="${x}" y="${y + 58}" class="big">${esc(v)}</text><text x="${x}" y="${y + 80}" class="dim">${l}</text>`);
  });

  const pitch = 17, cell = 13;
  const x0 = Math.round((W - weeks.length * pitch + (pitch - cell)) / 2), y0 = y + 128;
  const max = Math.max(1, ...weeks.flat().map(d => d.contributionCount));
  const level = c => (c ? ICE[Math.min(4, 1 + Math.floor((c / max) * 3.999))] : ICE[0]);
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const m = new Date(w[0].date).getUTCMonth();
    if (m !== lastMonth && i < weeks.length - 2) out.push(`<text x="${x0 + i * pitch}" y="${y0 - 10}" class="dim sm">${MONTHS[m]}</text>`);
    lastMonth = m;
    const rects = w.map(d => `<rect x="${x0 + i * pitch}" y="${y0 + new Date(d.date).getUTCDay() * pitch}" width="${cell}" height="${cell}" rx="3" fill="${level(d.contributionCount)}"><title>${d.contributionCount} on ${d.date}</title></rect>`).join('');
    out.push(`<g class="col" style="animation-delay:${i * 22}ms">${rects}</g>`);
  });

  const top = Object.entries(langs).filter(([n]) => !HIDE_LANGS.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sum = top.reduce((s, [, v]) => s + v, 0) || 1;
  const barW = W - 2 * x0, barY = y0 + 7 * pitch + 46;
  out.push(`<text x="${x0}" y="${barY - 14}" class="dim">languages by code size</text>`);
  let acc = 0;
  const bar = top.map(([, v], i) => {
    const w = (v / sum) * barW, x = x0 + acc;
    acc += w;
    return `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="10" fill="${AURORA[i]}"/>`;
  }).join('');
  out.push(`<g clip-path="url(#bar)">${bar}</g>`);
  top.forEach(([name, v], i) => {
    const x = x0 + i * (barW / 6);
    out.push(`<circle cx="${x + 5}" cy="${barY + 37}" r="5" fill="${AURORA[i]}"/><text x="${x + 16}" y="${barY + 42}" class="pill">${esc(name)} <tspan class="dim">${((v / sum) * 100).toFixed(1)}%</tspan></text>`);
  });

  const H = barY + 200;
  const { stars: starDots, snow } = sky(H);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">Bidyut Kr. Das, aka ShadowFrost. Software engineer building scalable backends and AI tools. ${total} contributions in the last year, ${current} day streak, ${stars} stars.</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#030812"/><stop offset=".5" stop-color="#081427"/><stop offset="1" stop-color="#091830"/>
  </linearGradient>
  <linearGradient id="aurA" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#5EEAD4" stop-opacity="0"/><stop offset=".35" stop-color="#5EEAD4"/><stop offset=".7" stop-color="#38BDF8"/><stop offset="1" stop-color="#38BDF8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="aurB" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#818CF8" stop-opacity="0"/><stop offset=".5" stop-color="#A78BFA"/><stop offset="1" stop-color="#5EEAD4" stop-opacity="0"/>
  </linearGradient>
  <filter id="glow" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>
  <clipPath id="type"><rect x="56" y="178" width="900" height="34"><animate attributeName="width" values="0;0;900" keyTimes="0;.15;1" dur="3s" fill="freeze"/></rect></clipPath>
  <clipPath id="bar"><rect x="${x0}" y="${barY}" width="${barW}" height="10" rx="5"/></clipPath>
</defs>
<style>
text{font-family:ui-monospace,SFMono-Regular,'JetBrains Mono',Menlo,Consolas,monospace;font-size:15px}
.name{font-size:68px;font-weight:700;fill:#EAF6FF;letter-spacing:-1px}
.typed{font-size:18px;fill:#CFE8FF}
.p{fill:#5EEAD4;font-size:16px}
.v{fill:#CFE8FF}
.k{fill:#7DD3FC}
.s{font-size:14px}
.big{font-size:30px;font-weight:700;fill:#EAF6FF}
.dim{font-size:13px;fill:#5B7290}
.sm{font-size:12px}
.pill{font-size:13px;fill:#CFE8FF}
.a1{animation:drift 13s ease-in-out infinite alternate;transform-origin:500px 90px}
.a2{animation:drift 17s ease-in-out -7s infinite alternate-reverse;transform-origin:620px 60px}
@keyframes drift{from{transform:translateX(-50px) scaleY(.8)}to{transform:translateX(50px) scaleY(1.2)}}
.tw{animation:tw 2.8s ease-in-out infinite alternate}
@keyframes tw{from{opacity:.15}to{opacity:.9}}
.sn{animation:fall linear infinite}
@keyframes fall{from{transform:translate(0,-30px)}to{transform:translate(-80px,${H + 30}px)}}
.cur{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.col{animation:frost .5s ease-out both}
@keyframes frost{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g fill="#CFE8FF">${starDots}</g>
<g filter="url(#glow)" opacity=".8">
  <path class="a1" fill="url(#aurA)" d="M-60 120 C 180 30, 380 150, 640 60 S 940 20, 1060 80 L 1060 112 C 900 70, 780 130, 640 104 S 240 100, -60 160 Z"/>
  <path class="a2" fill="url(#aurB)" d="M200 60 C 400 0, 560 90, 760 30 S 980 10, 1080 40 L 1080 64 C 960 40, 860 80, 760 64 S 420 40, 200 92 Z"/>
</g>
<text x="56" y="150" class="name">Bidyut Kr. Das</text>
<g clip-path="url(#type)">
  <text x="56" y="202" class="typed"><tspan fill="#5EEAD4">shadowfrost</tspan><tspan fill="#5B7290">@</tspan><tspan fill="#7DD3FC">dev</tspan><tspan fill="#5B7290">:~$</tspan> building scalable backends &amp; AI tools <tspan class="cur" fill="#7DD3FC">&#9612;</tspan></text>
</g>
${out.join('\n')}
${mountains(H - 340)}
<g fill="#EAF6FF">${snow}</g>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="#1C3352"/>
</svg>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [data, icons] = await Promise.all([fetchData(), fetchIcons()]);
  mkdirSync(new URL('../assets/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../assets/profile.svg', import.meta.url), render(data, icons));
  console.log('wrote assets/profile.svg');
}
