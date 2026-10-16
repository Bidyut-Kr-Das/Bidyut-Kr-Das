// Generates assets/stats.svg from the GitHub GraphQL API. Run by .github/workflows/stats.yml.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USER = process.env.GH_USER || 'bidyut-kr-das';
const MONO = "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace";
const ICE = ['#13243D', '#1D4E73', '#2C82AE', '#56C2E6', '#D4F3FF'];
const AURORA = ['#5EEAD4', '#38BDF8', '#818CF8', '#A78BFA', '#7DD3FC', '#CFE8FF'];

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

export function render({ weeks, total, prs, stars, langs }) {
  const { current, longest } = streaks(weeks);
  const W = 1000, H = 410, pitch = 17, cell = 13;
  const x0 = Math.round((W - weeks.length * pitch + (pitch - cell)) / 2), y0 = 168;
  const max = Math.max(1, ...weeks.flat().map(d => d.contributionCount));
  const level = c => (c ? ICE[Math.min(4, 1 + Math.floor((c / max) * 3.999))] : ICE[0]);

  const stats = [
    [num(total), 'contributions'],
    [`${current}d`, 'current streak'],
    [`${longest}d`, 'longest streak'],
    [num(stars), 'stars earned'],
    [num(prs), 'pull requests'],
  ].map(([v, l], i) => {
    const x = 48 + i * 186;
    return `<text x="${x}" y="106" class="big">${esc(v)}</text><text x="${x}" y="128" class="dim">${esc(l)}</text>`;
  }).join('');

  let lastMonth = -1;
  const months = weeks.map((w, i) => {
    const m = new Date(w[0].date).getUTCMonth();
    if (m === lastMonth || i > weeks.length - 3) return '';
    lastMonth = m;
    return `<text x="${x0 + i * pitch}" y="${y0 - 10}" class="dim sm">${MONTHS[m]}</text>`;
  }).join('');

  const grid = weeks.map((w, i) => {
    const rects = w.map(d => {
      const row = new Date(d.date).getUTCDay();
      return `<rect x="${x0 + i * pitch}" y="${y0 + row * pitch}" width="${cell}" height="${cell}" rx="3" fill="${level(d.contributionCount)}"><title>${d.contributionCount} on ${d.date}</title></rect>`;
    }).join('');
    return `<g class="col" style="animation-delay:${i * 22}ms">${rects}</g>`;
  }).join('');

  const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sum = top.reduce((s, [, v]) => s + v, 0) || 1;
  const barW = W - 2 * x0, barY = y0 + 7 * pitch + 46;
  let acc = 0;
  const bar = top.map(([, v], i) => {
    const w = (v / sum) * barW, x = x0 + acc;
    acc += w;
    return `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="10" fill="${AURORA[i]}"/>`;
  }).join('');
  const legend = top.map(([name, v], i) => {
    const x = x0 + i * (barW / 6);
    return `<circle cx="${x + 5}" cy="${barY + 37}" r="5" fill="${AURORA[i]}"/><text x="${x + 16}" y="${barY + 42}" class="txt">${esc(name)} <tspan class="dim">${((v / sum) * 100).toFixed(1)}%</tspan></text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GitHub stats for ${USER}: ${total} contributions in the last year, ${current} day current streak, ${longest} day longest streak, ${stars} stars, ${prs} pull requests.">
<style>
text{font-family:${MONO}}
.big{font-size:30px;font-weight:700;fill:#EAF6FF}
.dim{font-size:13px;fill:#5B7290}
.sm{font-size:12px}
.txt{font-size:13px;fill:#CFE8FF}
.p{font-size:14px;fill:#5EEAD4}
.col{animation:frost .5s ease-out both}
@keyframes frost{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.col{animation:none}}
</style>
<defs><clipPath id="bar"><rect x="${x0}" y="${barY}" width="${barW}" height="10" rx="5"/></clipPath></defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="#0A1628" stroke="#1C3352"/>
<text x="48" y="48" class="p">$ <tspan fill="#CFE8FF">frost stats</tspan> <tspan class="dim" font-size="14">--user ${esc(USER)}</tspan></text>
${stats}
${months}
${grid}
<text x="${x0}" y="${barY - 14}" class="dim">languages by code size</text>
<g clip-path="url(#bar)">${bar}</g>
${legend}
</svg>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('../assets/stats.svg', import.meta.url), render(await fetchData()));
  console.log('wrote assets/stats.svg');
}
