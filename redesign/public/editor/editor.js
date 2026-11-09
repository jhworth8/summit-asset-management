/*
 * Summit on-page editor.
 *
 * Lets a signed-in person click text on the website and change it, like a
 * shared document with suggested edits:
 *
 *   - Editors (e.g. Dad) change wording and click "Send for review". Their
 *     changes are saved to a draft branch ("site-edits") in the GitHub
 *     repository and a pull request is opened, which emails the approver.
 *   - Approvers (listed in editor/settings.json by GitHub username) open the
 *     review screen, see every change side by side with removed words struck
 *     out and new words highlighted, reject any they don't want, and click
 *     "Approve & publish". That merges the draft into main and the normal
 *     deploy puts it on the public site.
 *
 * Text is found by matching the words on the page to the strings in the
 * content files (redesign/src/content/), so anything that comes straight
 * from a content file is editable with no changes to the page templates.
 * Text assembled from several pieces is left alone; it can still be changed
 * in the full editor at /admin.
 *
 * Loaded only for someone who opened a page with ?edit or ?review, or who
 * has signed in on this computer before (see the loader in
 * src/layouts/Base.astro). Plain JavaScript, no build step.
 */
(() => {
  if (window.__summitEditor) return;
  window.__summitEditor = true;

  const CFG = window.SUMMIT_EDITOR || {};
  const BASE = (CFG.base || '/').replace(/\/$/, '');
  const ADMIN_URL = CFG.adminUrl || `${BASE}/admin/`;
  const CONTENT = 'redesign/src/content';
  const LETTERS_PDF = 'redesign/public/letters';
  const MAIN = 'main';
  const DRAFT = 'site-edits';
  const API = 'https://api.github.com';
  const KEY_SESSION = 'summit-editor';
  const KEY_UNSAVED = 'summit-editor-unsaved';
  const KEY_EDITING = 'summit-editor-on';

  // Content keys that never appear as visible text, or that are too risky to
  // change by clicking (the firm's name and address live in many places).
  const SKIP_KEYS = new Set(['image', 'imageAlt', 'alt', 'link', 'href', 'url', 'file', 'seoTitle', 'seoDescription']);
  const SITE_KEYS = new Set(['footerTagline', 'phone', 'fax', 'email']);
  const BIO_KEYS = ['name', 'title', 'credentials', 'shortRole'];

  const PAGES = {
    '/': ['home', 'Homepage'],
    '/our-firm/': ['firm', 'Our Firm'],
    '/our-firm/attributes/': ['attributes', 'Firm Attributes'],
    '/our-firm/history/': ['history', 'Our History'],
    '/our-team/': ['team', 'Our Team'],
    '/services/': ['services', 'Services'],
    '/services/investment-management/': ['investment', 'Investment Management'],
    '/services/financial-planning/': ['planning', 'Financial Planning'],
    '/news/': ['news', 'Views & News'],
    '/contact/': ['contact', 'Contact'],
    '/client-access/': ['client-access', 'Client Access'],
    '/disclosure/': ['legal', 'Disclosures'],
    '/terms-of-service/': ['legal', 'Terms of Service'],
    '/privacy-notice/': ['legal', 'Privacy Notice'],
    '/client-relationship-summary/': ['legal', 'Client Relationship Summary'],
  };

  // Plain names for content field keys, used on the review screen.
  const LABELS = {
    seoTitle: 'Search result title', seoDescription: 'Search result description', kicker: 'Small heading',
    heading: 'Heading', headline: 'Headline', intro: 'Introduction', body: 'Text', title: 'Title',
    caption: 'Text', points: 'Point', items: 'Item', paragraphs: 'Paragraph', hero: 'Top of page',
    facts: 'Fact', value: 'Large text', label: 'Small text', services: 'What we do', audiences: 'Who we serve',
    principles: 'Principles', whySummit: 'Why Summit', team: 'Our people', closing: 'Bottom of page',
    steps: 'Step', lead: 'Main sentence', list: 'Side list', listLabel: 'Side list heading', name: 'Name',
    milestones: 'Timeline', year: 'Year', text: 'Text', sections: 'Section', areas: 'Planning area',
    vehicles: 'Investment', commitments: 'Attribute', directions: 'Directions', footerTagline: 'Footer tagline',
    disclosures: 'Disclosures page', terms: 'Terms page', privacy: 'Privacy page', crs: 'Client Relationship Summary page',
    portal: 'Summit Client Portal', schwab: 'Charles Schwab', disclaimer: 'Schwab disclaimer', keyword: 'Keyword',
    sectionHeading: 'Section heading', leadHeading: 'Approach heading', leadEmphasis: 'Approach first paragraph',
    leadBody: 'Approach second paragraph', processHeading: 'Process heading', ctaHeading: 'Contact panel heading',
    ctaBody: 'Contact panel text', credentials: 'Credentials', shortRole: 'Short role (homepage)',
  };

  // ------------------------------------------------------------------ state
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  const params = new URLSearchParams(location.search);
  let session = store.get(KEY_SESSION, null); // { token, name, login }
  let editing = params.has('edit') || params.has('review') || sessionStorage.getItem(KEY_EDITING) === '1';
  let reviewOpen = params.has('review');
  let unsaved = store.get(KEY_UNSAVED, {}); // { filePath: { key: value } }
  let repo = null;
  let settings = { approvers: [], approverName: 'the approver' };
  let files = {}; // filePath -> { live, draft }
  let nodes = []; // { el, file, key }
  let draft = { exists: false, changed: [], items: [], pr: null };
  let busy = false;
  let message = '';
  let panel = null; // 'menu' | 'letter' | 'discard' | null
  let pasteKey = false; // sign in with a pasted key instead of the password
  const usePassword = () => Boolean(settings.lockedKey) && !pasteKey;
  let confirmPublish = false;
  // Wording a piece of text has shown during this visit (published, draft,
  // just typed). The page can show any of these, so all of them are matched.
  const seenText = new Map(); // "file|key" -> Set of text

  // --------------------------------------------------------------- helpers
  const norm = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const keyOf = (path) => JSON.stringify(path);
  const isApprover = () => Boolean(session?.login && settings.approvers.some((a) => a.toLowerCase() === session.login.toLowerCase()));
  const pagePath = () => {
    let p = location.pathname;
    if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || '/';
    return p.endsWith('/') ? p : `${p}/`;
  };
  const toB64 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const unsavedCount = () => Object.values(unsaved).reduce((n, changes) => n + Object.keys(changes).length, 0);
  const persistUnsaved = () => store.set(KEY_UNSAVED, unsavedCount() ? unsaved : null);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const friendly = (path) => {
    const page = Object.values(PAGES).find(([file]) => path.endsWith(`/pages/${file}.json`));
    if (page) return page[0] === 'legal' ? 'Disclosures & legal pages' : page[1];
    if (path.endsWith('/site.json')) return 'Firm details';
    if (path.includes('/content/team/')) return `Bio: ${path.split('/').pop().replace(/\.md$/, '').replace(/-(cfp|ma|clu-chfc)$/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}`;
    if (path.includes('/content/letters/')) return 'Views & News';
    return path.replace(/^redesign\/(public|src\/content)\//, '');
  };
  const labelFor = (path, file) => {
    if (file.endsWith('.md') && path[0] === 'body') return `Biography paragraph ${path[1] + 1}`;
    return path.map((part) => (typeof part === 'number' ? `${part + 1}` : LABELS[part] || part.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()))).join(' › ');
  };

  async function gh(path, { method = 'GET', body, allow404 = false } = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${session.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404 && allow404) return null;
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const error = new Error(detail.message || `GitHub returned ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res.status === 204 ? null : res.json();
  }

  async function loadSettings() {
    settings = await fetch(`${BASE}/editor/settings.json`).then((r) => r.json()).catch(() => settings);
  }

  // The editing key can be stored scrambled (AES-GCM, key derived from a
  // password with PBKDF2) so a person signs in with just a password.
  // See tools/lock-editor-key.mjs.
  async function unlockKey(password) {
    const k = settings.lockedKey;
    const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(k.salt), iterations: k.iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    try {
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(k.iv) }, key, bytes(k.data)));
    } catch {
      throw new Error('that password is not right. Check it and try again.');
    }
  }

  async function loadConfig() {
    if (!repo) {
      const text = await fetch(`${BASE}/admin/config.yml`).then((r) => r.text());
      repo = text.match(/^\s*repo:\s*["']?([\w.-]+\/[\w.-]+)/m)?.[1];
      if (!repo) throw new Error('Could not find the repository name in admin/config.yml.');
    }
    await loadSettings();
  }

  async function getFile(path, ref) {
    const data = await gh(`/repos/${repo}/contents/${path}?ref=${ref}`, { allow404: true });
    return data ? { text: data.content ? fromB64(data.content) : '', raw: data.content, sha: data.sha } : null;
  }

  async function putFile(path, content64, sha, msg) {
    return gh(`/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      body: { message: msg, content: content64, branch: DRAFT, ...(sha ? { sha } : {}) },
    });
  }

  async function deleteFile(path, sha, msg) {
    return gh(`/repos/${repo}/contents/${path}`, { method: 'DELETE', body: { message: msg, sha, branch: DRAFT } });
  }

  async function ensureDraftBranch() {
    if (await gh(`/repos/${repo}/branches/${DRAFT}`, { allow404: true })) return;
    const main = await gh(`/repos/${repo}/git/ref/heads/${MAIN}`);
    await gh(`/repos/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${DRAFT}`, sha: main.object.sha } });
  }

  async function findPullRequest() {
    const owner = repo.split('/')[0];
    const [pr] = await gh(`/repos/${repo}/pulls?state=open&head=${owner}:${DRAFT}`);
    return pr || null;
  }

  // The pull request body records which saved version was last sent, so any
  // computer can tell whether there is saved progress that hasn't been sent.
  const sentMarker = (sha) => `<!-- sent:${sha} -->`;
  const sentShaOf = (pr) => pr?.body?.match(/<!-- sent:([0-9a-f]+) -->/)?.[1] || null;
  const reviewUrl = () => `${location.origin}${BASE}/?review`;

  async function ensurePullRequest(sha) {
    const existing = await findPullRequest();
    if (existing) return existing;
    return gh(`/repos/${repo}/pulls`, {
      method: 'POST',
      body: {
        title: `Website changes from ${session.name} for review`,
        head: DRAFT,
        base: MAIN,
        body: `${session.name} changed wording on the website.\n\n**Review side by side:** ${reviewUrl()}\n\nNothing is public until it is approved and published.\n\n${sentMarker(sha || '')}`,
      },
    });
  }

  // ------------------------------------------------- content file handling
  function parseMd(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return null;
    const data = {};
    for (const key of BIO_KEYS) {
      const line = m[1].match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
      if (!line) continue;
      const raw = line[1].trim();
      data[key] = raw.startsWith('"') ? JSON.parse(raw) : raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
    }
    data.body = m[2].trim().split(/\r?\n\s*\r?\n/).map(norm).filter(Boolean);
    return { front: m[1], data, orig: { ...data } };
  }

  // Only lines that actually changed are rewritten, so a saved bio differs
  // from the original by exactly the edit.
  function writeMd(front, data, orig = {}) {
    let out = front;
    for (const key of BIO_KEYS) {
      if (key in data && data[key] !== orig[key]) out = out.replace(new RegExp(`^${key}:.*$`, 'm'), () => `${key}: ${JSON.stringify(data[key])}`);
    }
    return `---\n${out}\n---\n\n${data.body.join('\n\n')}\n`;
  }

  function parse(path, text) {
    if (path.endsWith('.md')) return parseMd(text);
    return { data: JSON.parse(text) };
  }

  function serialize(path, parsed) {
    return path.endsWith('.md') ? writeMd(parsed.front, parsed.data, parsed.orig) : `${JSON.stringify(parsed.data, null, 2)}\n`;
  }

  function setAt(obj, path, value) {
    let target = obj;
    for (let i = 0; i < path.length - 1; i += 1) target = target?.[path[i]];
    if (target && path[path.length - 1] in target) target[path[path.length - 1]] = value;
  }

  function getAt(obj, path) {
    return path.reduce((target, part) => target?.[part], obj);
  }

  function leaves(path, data) {
    const out = [];
    const walk = (value, at) => {
      if (typeof value === 'string') {
        if (norm(value)) out.push({ path: at, value: norm(value) });
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, [...at, i]));
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          if (SKIP_KEYS.has(k)) continue;
          if (path.endsWith('/site.json') && at.length === 0 && !SITE_KEYS.has(k)) continue;
          walk(v, [...at, k]);
        }
      }
    };
    walk(data, []);
    return out;
  }

  // Every string that differs between two versions of a content file.
  function diffData(a, b, path = [], out = []) {
    if (typeof a === 'string' || typeof b === 'string' || typeof a === 'number' || typeof b === 'number') {
      if (a !== b) out.push({ path, before: a == null ? '' : String(a), after: b == null ? '' : String(b) });
    } else if (Array.isArray(a) || Array.isArray(b)) {
      const n = Math.max(a?.length || 0, b?.length || 0);
      for (let i = 0; i < n; i += 1) diffData(a?.[i], b?.[i], [...path, i], out);
    } else if ((a && typeof a === 'object') || (b && typeof b === 'object')) {
      for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) diffData(a?.[k], b?.[k], [...path, k], out);
    } else if (a !== b) {
      out.push({ path, before: a == null ? '' : String(a), after: b == null ? '' : String(b) });
    }
    return out;
  }

  // Word-level comparison for the review screen: returns the old text with
  // removed words marked and the new text with added words marked.
  function wordDiff(before, after) {
    const A = before.split(/(\s+)/).filter(Boolean);
    const B = after.split(/(\s+)/).filter(Boolean);
    const n = A.length;
    const m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    const left = [];
    const right = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { left.push(['same', A[i]]); right.push(['same', B[j]]); i += 1; j += 1; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { left.push(['del', A[i]]); i += 1; }
      else { right.push(['ins', B[j]]); j += 1; }
    }
    while (i < n) { left.push(['del', A[i]]); i += 1; }
    while (j < m) { right.push(['ins', B[j]]); j += 1; }
    return { left, right };
  }

  // -------------------------------------------------------- draft & review
  async function refreshDraft() {
    const branch = await gh(`/repos/${repo}/branches/${DRAFT}`, { allow404: true });
    if (!branch) { draft = { exists: false, changed: [], items: [], pr: null }; return; }
    const compare = await gh(`/repos/${repo}/compare/${MAIN}...${DRAFT}`);
    const items = [];
    const changed = [];
    const letterPdfs = new Set();
    for (const f of compare.files) {
      const path = f.filename;
      const isContent = path.startsWith(`${CONTENT}/`) && /\.(json|md)$/.test(path);
      if (!isContent) {
        // Assets (PDFs, photos). Skip ones already identical on the live site.
        const live = await gh(`/repos/${repo}/contents/${path}?ref=${MAIN}`, { allow404: true });
        if (live && live.sha === f.sha) continue;
        if (f.status === 'removed' && !live) continue;
        changed.push(path);
        items.push({ type: 'asset', file: path, page: friendly(path), label: f.status === 'removed' ? 'File removed' : path.endsWith('.pdf') ? 'PDF file' : 'File', after: path.split('/').pop(), status: f.status });
        continue;
      }
      const [live, drafted] = await Promise.all([getFile(path, MAIN), f.status === 'removed' ? null : getFile(path, DRAFT)]);
      if (live && drafted && live.text === drafted.text) continue;
      changed.push(path);
      if (path.includes('/content/letters/') && !live && drafted) {
        const letter = JSON.parse(drafted.text);
        letterPdfs.add(`${LETTERS_PDF}${letter.file.replace(/^\/letters/, '')}`);
        items.push({ type: 'letter', file: path, page: 'Views & News', label: `New ${letter.kind?.toLowerCase() || 'letter'}`, before: '', after: `“${letter.title}” dated ${letter.date}`, pdf: letter.file });
        continue;
      }
      if (!live || !drafted) {
        items.push({ type: 'file', file: path, page: friendly(path), label: drafted ? 'New page content' : 'Removed content', before: '', after: '' });
        continue;
      }
      const a = parse(path, live.text);
      const b = parse(path, drafted.text);
      const diffs = diffData(a?.data, b?.data);
      if (!diffs.length) {
        items.push({ type: 'file', file: path, page: friendly(path), label: 'Formatting or structure (made in the full editor)', before: '', after: '' });
      }
      for (const d of diffs) items.push({ type: 'text', file: path, path: d.path, page: friendly(path), label: labelFor(d.path, path), before: d.before, after: d.after });
    }
    const filtered = items.filter((item) => !(item.type === 'asset' && letterPdfs.has(item.file)));
    const pr = await findPullRequest();
    const headSha = branch.commit?.sha || null;
    // Saved progress that the approver hasn't been sent yet.
    const unsent = filtered.length > 0 && (!pr || sentShaOf(pr) !== headSha);
    draft = { exists: filtered.length > 0, changed, items: filtered, pr, headSha, unsent };
    // A draft branch with nothing left in it (already merged, or every change
    // rejected) is removed so the next edit starts from the live site.
    if (!filtered.length && !pr) {
      await gh(`/repos/${repo}/git/refs/heads/${DRAFT}`, { method: 'DELETE' }).catch(() => {});
      draft = { exists: false, changed: [], items: [], pr: null };
    }
  }

  async function rejectItem(item) {
    const live = item.type === 'asset' || item.type === 'letter'
      ? await gh(`/repos/${repo}/contents/${item.file}?ref=${MAIN}`, { allow404: true })
      : await getFile(item.file, MAIN);
    const current = await gh(`/repos/${repo}/contents/${item.file}?ref=${DRAFT}`, { allow404: true });
    const who = session.name;
    if (item.type === 'text') {
      const drafted = parse(item.file, fromB64(current.content));
      if (item.file.endsWith('.md') && item.path[0] === 'body') drafted.data.body[item.path[1]] = item.before;
      else setAt(drafted.data, item.path, item.before);
      await putFile(item.file, toB64(serialize(item.file, drafted)), current.sha, `Review: put back "${item.label}" on ${item.page} (by ${who})`);
      return;
    }
    if (item.type === 'letter') {
      const letter = JSON.parse(fromB64(current.content));
      const pdfPath = `${LETTERS_PDF}${letter.file.replace(/^\/letters/, '')}`;
      const pdf = await gh(`/repos/${repo}/contents/${pdfPath}?ref=${DRAFT}`, { allow404: true });
      const livePdf = await gh(`/repos/${repo}/contents/${pdfPath}?ref=${MAIN}`, { allow404: true });
      await deleteFile(item.file, current.sha, `Review: remove letter "${letter.title}" (by ${who})`);
      if (pdf && !livePdf) await deleteFile(pdfPath, pdf.sha, `Review: remove letter PDF (by ${who})`);
      return;
    }
    // Whole files: put the live version back, or remove a file that is new.
    if (live && !live.content) throw new Error(`${item.file} is too large to put back here. Reject it on GitHub instead.`);
    if (live && live.content) await putFile(item.file, live.content.replace(/\s/g, ''), current?.sha, `Review: put back ${item.file} (by ${who})`);
    else if (current) await deleteFile(item.file, current.sha, `Review: remove ${item.file} (by ${who})`);
  }

  // ------------------------------------------------------- page ↔ content
  function filesForPage() {
    const p = pagePath();
    const bio = p.match(/^\/our-team\/[^/]+\/([^/]+)\/$/);
    const list = [];
    if (bio) list.push(`${CONTENT}/team/${bio[1]}.md`);
    else if (PAGES[p]) list.push(`${CONTENT}/pages/${PAGES[p][0]}.json`);
    list.push(`${CONTENT}/site.json`);
    return list;
  }

  async function loadPage() {
    files = {};
    for (const path of filesForPage()) {
      const live = await getFile(path, MAIN);
      if (!live) continue;
      const parsed = parse(path, live.text);
      if (!parsed) continue;
      const entry = { live: parsed, draft: null };
      if (draft.changed.includes(path)) {
        const d = await getFile(path, DRAFT);
        if (d) entry.draft = parse(path, d.text);
      }
      files[path] = entry;
    }
  }

  function currentValue(path, key) {
    if (unsaved[path] && key in unsaved[path]) return { value: unsaved[path][key], state: 'changed' };
    const file = files[path];
    const pathArr = JSON.parse(key);
    const live = getAt(file.live.data, pathArr);
    const drafted = file.draft ? getAt(file.draft.data, pathArr) : undefined;
    if (typeof drafted === 'string' && norm(drafted) !== norm(live)) return { value: norm(drafted), state: 'draft' };
    return { value: norm(live), state: '' };
  }

  function remember(file, key, text) {
    const id = `${file}|${key}`;
    if (!seenText.has(id)) seenText.set(id, new Set());
    if (text) seenText.get(id).add(norm(text));
  }

  function mapPage() {
    for (const node of nodes) if (node.el.isConnected) remember(node.file, node.key, node.el.textContent);
    unmapPage();
    const main = document.querySelector('main');
    if (!main) return;
    const index = new Map(); // text -> [{ file, key }]
    for (const [path, file] of Object.entries(files)) {
      // shortRole only appears on the homepage, so it is not matched here.
      const items = path.endsWith('.md')
        ? ['name', 'title', 'credentials'].filter((k) => file.live.data[k]).map((k) => ({ path: [k], value: norm(file.live.data[k]) }))
        : leaves(path, file.live.data);
      for (const item of items) {
        const key = keyOf(item.path);
        remember(path, key, item.value);
        const drafted = file.draft ? getAt(file.draft.data, item.path) : undefined;
        if (typeof drafted === 'string') remember(path, key, drafted);
        if (unsaved[path]?.[key]) remember(path, key, unsaved[path][key]);
        for (const text of seenText.get(`${path}|${key}`)) {
          if (!index.has(text)) index.set(text, []);
          if (!index.get(text).some((t) => t.file === path && t.key === key)) index.get(text).push({ file: path, key });
        }
      }
    }

    // Bio paragraphs are matched by position inside the biography.
    const bioFile = Object.keys(files).find((p) => p.endsWith('.md'));
    const bioRoot = document.querySelector('.biography-flow');
    if (bioFile && bioRoot) {
      bioRoot.querySelectorAll(':scope > p').forEach((el, i) => {
        if (i < files[bioFile].live.data.body.length) nodes.push({ el, file: bioFile, key: keyOf(['body', i]) });
      });
    }

    // Every other piece of text is matched by its exact wording.
    const found = new Map(); // text -> [element]
    const roots = [main, document.querySelector('.site-footer')].filter(Boolean);
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      for (const t of texts) {
        const parent = t.parentElement;
        if (!parent || parent.closest('script, style, [data-summit-ui], .biography-flow')) continue;
        const value = norm(t.nodeValue);
        if (!value || !index.has(value)) continue;
        let el = parent;
        const onlyText = [...parent.childNodes].every((n) => n === t || (n.nodeType === 3 && !norm(n.nodeValue)));
        if (!onlyText) {
          el = document.createElement('span');
          el.dataset.summitWrap = '';
          t.replaceWith(el);
          el.append(t);
        }
        if (!found.has(value)) found.set(value, []);
        found.get(value).push(el);
      }
    }

    for (const [value, els] of found) {
      const targets = index.get(value);
      if (targets.length === 1) {
        els.forEach((el) => nodes.push({ el, ...targets[0] }));
      } else if (targets.length === els.length) {
        els.forEach((el, i) => nodes.push({ el, ...targets[i] }));
      } else {
        els.forEach((el) => { el.dataset.summitLocked = ''; el.title = 'This wording appears more than once here. Change it in the full editor.'; });
      }
    }

    for (const node of nodes) {
      const { el, file, key } = node;
      el.dataset.summitKey = key;
      el.dataset.summitFile = file;
      const { value, state } = currentValue(file, key);
      if (norm(el.textContent) !== value) el.textContent = value;
      el.classList.toggle('summit-changed', state === 'changed');
      el.classList.toggle('summit-draft', state === 'draft');
      if (!el.closest('button, [aria-hidden="true"]')) {
        try { el.contentEditable = 'plaintext-only'; } catch { el.contentEditable = 'true'; }
        if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
        el.spellcheck = true;
        el.dataset.summitEditable = '';
      }
    }
  }

  function unmapPage() {
    document.querySelectorAll('[data-summit-key]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.classList.remove('summit-changed', 'summit-draft');
      delete el.dataset.summitKey;
      delete el.dataset.summitFile;
      delete el.dataset.summitEditable;
    });
    document.querySelectorAll('[data-summit-locked]').forEach((el) => { delete el.dataset.summitLocked; el.removeAttribute('title'); });
    nodes = [];
  }

  function onInput(event) {
    const el = event.target.closest?.('[data-summit-editable]');
    if (!el) return;
    const { summitFile: file, summitKey: key } = el.dataset;
    const value = norm(el.textContent);
    const f = files[file];
    const pathArr = JSON.parse(key);
    const drafted = f.draft ? getAt(f.draft.data, pathArr) : undefined;
    const base = norm(typeof drafted === 'string' ? drafted : getAt(f.live.data, pathArr));
    unsaved[file] = unsaved[file] || {};
    if (value === base || !value) delete unsaved[file][key];
    else unsaved[file][key] = value;
    if (!Object.keys(unsaved[file]).length) delete unsaved[file];
    persistUnsaved();
    for (const node of nodes) {
      if (node.file === file && node.key === key) {
        if (node.el !== el) node.el.textContent = value;
        node.el.classList.toggle('summit-changed', key in (unsaved[file] || {}));
      }
    }
    renderUI();
  }

  // ---------------------------------------------------------------- actions
  async function run(task, doneMessage) {
    if (busy) return;
    busy = true;
    message = '';
    renderUI();
    try {
      await task();
      message = doneMessage || '';
    } catch (error) {
      console.error(error);
      if (error.status === 401) {
        message = 'Your editing key no longer works. Sign in again with a new key.';
        signOut(false);
      } else {
        message = /^that (password|key)/.test(error.message) ? `Sorry, ${error.message}` : `Something went wrong: ${error.message}`;
      }
    } finally {
      busy = false;
      renderUI();
    }
  }

  async function reloadAll() {
    await refreshDraft();
    await loadPage();
    mapPage();
  }

  async function saveDraft() {
    const paths = Object.keys(unsaved);
    if (paths.length) {
      await ensureDraftBranch();
      for (const path of paths) {
        const current = await getFile(path, DRAFT);
        const parsed = parse(path, current.text);
        for (const [key, value] of Object.entries(unsaved[path])) {
          const pathArr = JSON.parse(key);
          if (path.endsWith('.md') && pathArr[0] === 'body') parsed.data.body[pathArr[1]] = value;
          else setAt(parsed.data, pathArr, value);
        }
        const text = serialize(path, parsed);
        if (text !== current.text) {
          const count = Object.keys(unsaved[path]).length;
          await putFile(path, toB64(text), current.sha, `Suggested: ${plural(count, 'wording change')} on ${friendly(path)} (by ${session.name})`);
        }
      }
      unsaved = {};
      persistUnsaved();
    }
    await reloadAll();
  }

  // Editors: save, then ask the approver to review. The first send opens the
  // review request (GitHub emails the approver); later sends add a comment to
  // it, which emails them again.
  async function sendForReview() {
    await saveDraft();
    if (!draft.exists || !draft.unsent) return;
    if (!draft.pr) {
      await ensurePullRequest(draft.headSha);
    } else {
      await gh(`/repos/${repo}/issues/${draft.pr.number}/comments`, {
        method: 'POST',
        body: { body: `${session.name} sent more changes for review.\n\n**Review side by side:** ${reviewUrl()}` },
      });
      const body = (draft.pr.body || '').replace(/<!-- sent:[0-9a-f]* -->/, '').trimEnd();
      await gh(`/repos/${repo}/pulls/${draft.pr.number}`, { method: 'PATCH', body: { body: `${body}\n\n${sentMarker(draft.headSha)}` } });
    }
    await refreshDraft();
  }

  async function publish() {
    if (unsavedCount()) await saveDraft();
    await refreshDraft();
    if (!draft.exists) throw new Error('There are no changes to publish.');
    const pr = draft.pr || await ensurePullRequest();
    try {
      await gh(`/repos/${repo}/pulls/${pr.number}/merge`, {
        method: 'PUT',
        body: { merge_method: 'squash', commit_title: `Publish website changes (approved by ${session.name})` },
      });
    } catch (error) {
      if (error.status === 405 || error.status === 409) {
        throw new Error(`GitHub would not publish these changes (an approval rule, or a conflicting change). Open them here: ${pr.html_url}`);
      }
      throw error;
    }
    await gh(`/repos/${repo}/git/refs/heads/${DRAFT}`, { method: 'DELETE' }).catch(() => {});
    reviewOpen = false;
    await reloadAll();
  }

  async function discardDraft() {
    const pr = draft.pr || await findPullRequest();
    if (pr) await gh(`/repos/${repo}/pulls/${pr.number}`, { method: 'PATCH', body: { state: 'closed' } }).catch(() => {});
    await gh(`/repos/${repo}/git/refs/heads/${DRAFT}`, { method: 'DELETE' }).catch((e) => { if (e.status !== 422) throw e; });
    unsaved = {};
    persistUnsaved();
    reviewOpen = false;
    await reloadAll();
  }

  function undoUnsaved() {
    unsaved = {};
    persistUnsaved();
    mapPage();
    renderUI();
  }

  async function addLetter(form) {
    const title = norm(form.title.value);
    const date = form.date.value; // YYYY-MM-DD
    const kind = form.kind.value;
    const pdf = form.pdf.files[0];
    if (!title || !date || !pdf) throw new Error('please fill in the title and date, and choose the PDF.');
    if (!/\.pdf$/i.test(pdf.name)) throw new Error('the letter must be a PDF file.');
    const [y, m, d] = date.split('-');
    const suffix = kind.startsWith('Proxy') ? 'Proxy_Letter' : kind.startsWith('Special') ? 'Special_Commentary' : 'Client_Letter';
    const pdfName = `${y}_${m}${d}_${suffix}.pdf`;
    const jsonName = `${date}${kind.startsWith('Quarterly') ? '' : kind.startsWith('Proxy') ? '-proxy' : '-special'}.json`;
    const pdf64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('the PDF could not be read.'));
      reader.readAsDataURL(pdf);
    });
    await ensureDraftBranch();
    const pdfPath = `${LETTERS_PDF}/${pdfName}`;
    const existingPdf = await gh(`/repos/${repo}/contents/${pdfPath}?ref=${DRAFT}`, { allow404: true });
    await putFile(pdfPath, pdf64, existingPdf?.sha, `Suggested: letter PDF ${pdfName} (by ${session.name})`);
    const jsonPath = `${CONTENT}/letters/${jsonName}`;
    const existingJson = await getFile(jsonPath, DRAFT);
    const entry = { title, date, kind, file: `/letters/${pdfName}` };
    await putFile(jsonPath, toB64(`${JSON.stringify(entry, null, 2)}\n`), existingJson?.sha, `Suggested: ${kind.toLowerCase()} "${title}" (by ${session.name})`);
    await refreshDraft();
  }

  async function signIn(form) {
    const name = norm(form.name.value);
    let token;
    if (usePassword()) {
      if (!name || !form.password.value) throw new Error('please enter your name and the password.');
      token = (await unlockKey(form.password.value)).trim();
    } else {
      token = form.token.value.trim();
      if (!token || !name) throw new Error('please enter your name and your editing key.');
    }
    session = { token, name };
    try {
      await loadConfig();
      await gh(`/repos/${repo}`);
      const user = await gh('/user');
      session.login = user.login;
    } catch (error) {
      session = null;
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        throw new Error('that key did not work. Check that it was copied completely, or ask Jesse for a new one.');
      }
      throw error;
    }
    store.set(KEY_SESSION, session);
  }

  function signOut(clear = true) {
    if (clear) message = 'Signed out. Editing is turned off on this computer.';
    session = null;
    store.set(KEY_SESSION, null);
    setEditing(false);
  }

  function setEditing(on) {
    editing = on;
    if (!on) reviewOpen = false;
    try { sessionStorage.setItem(KEY_EDITING, on ? '1' : '0'); } catch { /* ignore */ }
    document.documentElement.toggleAttribute('data-summit-editing', on);
    document.dispatchEvent(new CustomEvent('summit:editing', { detail: on }));
    if (!on) unmapPage();
    renderUI();
  }

  async function start() {
    if (!session) { await loadSettings(); renderUI(); return; }
    if (!editing) {
      // Signed in but not editing: check quietly for saved progress so the
      // "Edit this page" button can show that something is waiting.
      renderUI();
      try { await loadConfig(); await refreshDraft(); } catch { /* offline: no reminder */ }
      if (!editing) renderUI();
      return;
    }
    document.documentElement.toggleAttribute('data-summit-editing', true);
    document.dispatchEvent(new CustomEvent('summit:editing', { detail: true }));
    await run(async () => {
      await loadConfig();
      if (!session.login) {
        session.login = (await gh('/user')).login;
        store.set(KEY_SESSION, session);
      }
      await reloadAll();
    });
  }

  // -------------------------------------------------------------------- UI
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const child of children.flat()) if (child != null && child !== false) node.append(child);
    return node;
  }

  function renderUI() {
    document.querySelector('[data-summit-ui]')?.remove();
    document.querySelector('[data-summit-review]')?.remove();
    const ui = el('div', { class: 'summit-ui', 'data-summit-ui': '' });

    if (!session) {
      if (!editing) return;
      ui.append(signInPanel());
      document.body.append(ui);
      return;
    }

    if (!editing) {
      ui.append(el('button', { type: 'button', class: 'summit-pill', onclick: () => { setEditing(true); start(); } },
        '✎ Edit this page',
        draft.exists ? el('span', { class: 'summit-dot', title: draft.unsent && !isApprover() ? 'You have saved changes that are not sent yet' : 'Changes are waiting for review' }) : null));
      if (message) ui.append(el('p', { class: 'summit-msg', role: 'status' }, message));
      document.body.append(ui);
      return;
    }

    const approver = isApprover();
    const count = unsavedCount();
    const waiting = draft.items.length;
    let status;
    if (busy) status = 'Working…';
    else if (count) status = `${plural(count, 'change')} not saved yet`;
    else if (waiting && approver) status = `${plural(waiting, 'change')} waiting for your review`;
    else if (draft.unsent) status = `Progress saved. Not sent to ${settings.approverName} yet.`;
    else if (waiting) status = `Sent to ${settings.approverName} for review. Not on the live site yet.`;
    else status = 'Click any outlined text to change it.';

    const bar = el('div', { class: 'summit-bar', role: 'toolbar', 'aria-label': 'Website editing' },
      el('span', { class: 'summit-badge' }, approver ? 'Editing · Approver' : 'Editing'),
      el('span', { class: 'summit-status', role: 'status' }, status),
      el('div', { class: 'summit-actions' },
        count ? el('button', { type: 'button', class: 'summit-btn ghost', disabled: busy, onclick: undoUnsaved }, 'Undo') : null,
        el('button', { type: 'button', class: 'summit-btn', disabled: busy || !count, onclick: () => run(saveDraft, approver ? 'Saved. Open Review & publish when you are ready.' : 'Progress saved. You can stop and come back any time, on any computer.') }, approver ? 'Save' : 'Save progress'),
        approver ? null : el('button', { type: 'button', class: 'summit-btn primary', disabled: busy || (!count && !draft.unsent), onclick: () => run(sendForReview, `Sent to ${settings.approverName}. Nothing is public until it is approved.`) }, 'Send for review'),
        el('button', { type: 'button', class: `summit-btn ${approver ? 'primary' : 'ghost'}`, disabled: busy || (!waiting && !count), onclick: () => openReview() },
          approver ? `Review & publish${waiting ? ` (${waiting})` : ''}` : `See my changes${waiting ? ` (${waiting})` : ''}`),
        el('button', { type: 'button', class: 'summit-btn ghost', disabled: busy, onclick: () => { panel = panel === 'letter' ? null : 'letter'; renderUI(); } }, 'Add a letter'),
        el('button', { type: 'button', class: 'summit-btn ghost', 'aria-expanded': String(panel === 'menu'), onclick: () => { panel = panel === 'menu' ? null : 'menu'; renderUI(); } }, 'More'),
        el('button', { type: 'button', class: 'summit-btn ghost', onclick: () => { panel = null; setEditing(false); } }, 'Done'),
      ),
    );
    ui.append(bar);
    if (message && !reviewOpen) ui.append(el('p', { class: 'summit-msg', role: 'status' }, message));

    if (panel === 'menu') {
      ui.append(el('div', { class: 'summit-panel' },
        el('p', { class: 'summit-panel-title' }, `Signed in as ${session.name}${approver ? ' (approver)' : ''}`),
        el('p', { class: 'summit-legend' },
          el('span', { class: 'summit-swatch changed' }), 'Changed, not sent yet ',
          el('span', { class: 'summit-swatch draft' }), 'Saved, not on the live site yet'),
        el('div', { class: 'summit-menu' },
          el('a', { href: ADMIN_URL, target: '_blank', rel: 'noopener' }, 'Full editor: photos, bios, documents, search titles ↗'),
          draft.exists ? el('button', { type: 'button', onclick: () => { panel = 'discard'; renderUI(); } }, approver ? 'Reject all waiting changes' : 'Throw away all my saved changes') : null,
          el('button', { type: 'button', onclick: () => { panel = null; signOut(); } }, 'Sign out on this computer'),
        ),
      ));
    }

    if (panel === 'discard') {
      ui.append(el('div', { class: 'summit-panel' },
        el('p', { class: 'summit-panel-title' }, approver ? 'Reject all waiting changes?' : 'Throw away all your saved changes?'),
        el('p', {}, 'The waiting changes are removed. The live site is not affected.'),
        el('div', { class: 'summit-actions' },
          el('button', { type: 'button', class: 'summit-btn danger', onclick: () => { panel = null; run(discardDraft, 'Waiting changes removed.'); } }, 'Yes, remove them'),
          el('button', { type: 'button', class: 'summit-btn ghost', onclick: () => { panel = null; renderUI(); } }, 'Keep them'),
        ),
      ));
    }

    if (panel === 'letter') {
      const form = el('form', { class: 'summit-panel summit-form', onsubmit: (event) => {
        event.preventDefault();
        run(async () => { await addLetter(form); panel = null; },
          isApprover() ? 'Letter added. Open Review & publish to put it on the website.' : 'Letter saved. Click Send for review when you are ready.');
      } },
      el('p', { class: 'summit-panel-title' }, 'Add a quarterly letter'),
      el('label', { for: 'summit-letter-title' }, 'Title, as printed on the letter'),
      el('input', { id: 'summit-letter-title', name: 'title', required: true, placeholder: 'Persistent Uncertainty' }),
      el('label', { for: 'summit-letter-date' }, 'Date on the letter'),
      el('input', { id: 'summit-letter-date', name: 'date', type: 'date', required: true }),
      el('label', { for: 'summit-letter-kind' }, 'Type'),
      el('select', { id: 'summit-letter-kind', name: 'kind' },
        el('option', {}, 'Quarterly commentary letter'),
        el('option', {}, 'Special commentary letter'),
        el('option', {}, 'Proxy voting letter')),
      el('label', { for: 'summit-letter-pdf' }, 'The letter (PDF)'),
      el('input', { id: 'summit-letter-pdf', name: 'pdf', type: 'file', accept: 'application/pdf,.pdf', required: true }),
      el('div', { class: 'summit-actions' },
        el('button', { type: 'submit', class: 'summit-btn primary', disabled: busy }, 'Add letter'),
        el('button', { type: 'button', class: 'summit-btn ghost', onclick: () => { panel = null; renderUI(); } }, 'Cancel')));
      ui.append(form);
    }

    document.body.append(ui);
    if (reviewOpen) document.body.append(reviewScreen());
  }

  function openReview() {
    confirmPublish = false;
    reviewOpen = true;
    if (unsavedCount()) run(saveDraft);
    else renderUI();
  }

  function diffText(parts, kind) {
    return parts.map(([type, text]) => (type === 'same' ? document.createTextNode(text) : el(kind, {}, text)));
  }

  // The side-by-side review, like suggested edits in a shared document.
  function reviewScreen() {
    const approver = isApprover();
    const groups = new Map();
    for (const item of draft.items) {
      if (!groups.has(item.page)) groups.set(item.page, []);
      groups.get(item.page).push(item);
    }
    const close = () => { reviewOpen = false; confirmPublish = false; renderUI(); };
    const sentBy = draft.pr?.user?.login ? ` · sent by ${draft.pr.user.login}` : '';

    const body = draft.items.length
      ? [...groups].map(([page, items]) => el('section', { class: 'summit-review-page' },
        el('h3', {}, page),
        items.map((item) => {
          let compare;
          if (item.type === 'text') {
            const { left, right } = wordDiff(item.before, item.after);
            compare = el('div', { class: 'summit-compare' },
              el('div', { class: 'summit-col before' }, el('span', { class: 'summit-col-label' }, 'On the website now'), el('p', {}, item.before ? diffText(left, 'del') : el('em', {}, '(empty)'))),
              el('div', { class: 'summit-col after' }, el('span', { class: 'summit-col-label' }, 'Suggested'), el('p', {}, item.after ? diffText(right, 'ins') : el('em', {}, '(removed)'))));
          } else if (item.type === 'letter') {
            compare = el('div', { class: 'summit-compare single' },
              el('div', { class: 'summit-col after' }, el('span', { class: 'summit-col-label' }, 'New on Views & News'), el('p', {}, el('ins', {}, item.after)),
                el('a', { href: `https://github.com/${repo}/blob/${DRAFT}/${LETTERS_PDF}${item.pdf.replace(/^\/letters/, '')}`, target: '_blank', rel: 'noopener' }, 'Open the PDF ↗')));
          } else {
            compare = el('div', { class: 'summit-compare single' },
              el('div', { class: 'summit-col after' }, el('span', { class: 'summit-col-label' }, item.label), el('p', {}, item.after || 'Changed in the full editor. '),
                el('a', { href: `https://github.com/${repo}/compare/${MAIN}...${DRAFT}`, target: '_blank', rel: 'noopener' }, 'See the details on GitHub ↗')));
          }
          return el('article', { class: 'summit-change' },
            el('div', { class: 'summit-change-head' },
              el('span', {}, item.label),
              el('button', { type: 'button', class: 'summit-btn small ghost-dark', disabled: busy, onclick: () => run(async () => { await rejectItem(item); await reloadAll(); }, approver ? 'Change rejected.' : 'Change taken back.') }, approver ? 'Reject' : 'Take back')),
            compare);
        })))
      : [el('p', { class: 'summit-empty' }, approver ? 'Nothing is waiting for review.' : 'You have not sent anything for review.')];

    const publishButton = approver && draft.items.length
      ? el('button', { type: 'button', class: 'summit-btn primary', disabled: busy, onclick: () => {
        if (!confirmPublish) { confirmPublish = true; renderUI(); return; }
        confirmPublish = false;
        run(publish, 'Published. The live site will show the changes in about 2 to 3 minutes.');
      } }, confirmPublish ? `Yes, publish ${plural(draft.items.length, 'change')} now` : `Approve & publish ${plural(draft.items.length, 'change')}`)
      : null;

    return el('div', { class: 'summit-review', 'data-summit-review': '', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Review changes' },
      el('div', { class: 'summit-review-inner' },
        el('header', { class: 'summit-review-head' },
          el('div', {},
            el('p', { class: 'summit-review-kicker' }, approver ? `Review${sentBy}` : draft.unsent ? 'Your saved changes' : 'What you sent for review'),
            el('h2', {}, approver ? 'Changes waiting for approval' : draft.unsent ? 'Saved, not sent yet' : `Waiting for ${settings.approverName}`),
            el('p', { class: 'summit-review-legend' }, el('del', {}, 'struck out'), ' = removed   ', el('ins', {}, 'highlighted'), ' = added')),
          el('div', { class: 'summit-actions' },
            publishButton,
            el('button', { type: 'button', class: 'summit-btn ghost-dark', onclick: close }, 'Close'))),
        message ? el('p', { class: 'summit-review-msg', role: 'status' }, message) : null,
        approver && draft.unsent && draft.items.length
          ? el('p', { class: 'summit-review-msg warn' }, draft.pr
            ? 'Some of these were saved after the last time they were sent for review, so they may still be in progress.'
            : 'These have been saved but not sent for review yet, so they may still be in progress.')
          : null,
        confirmPublish ? el('p', { class: 'summit-review-msg warn' }, 'Publishing makes these changes public within about 2 to 3 minutes. Make sure the wording has been approved for compliance.') : null,
        busy ? el('p', { class: 'summit-review-msg' }, 'Working…') : null,
        el('div', { class: 'summit-review-body' }, body)));
  }

  function signInPanel() {
    const form = el('form', { class: 'summit-panel summit-form', onsubmit: (event) => {
      event.preventDefault();
      run(() => signIn(form)).then(() => { if (session) start(); });
    } },
    el('p', { class: 'summit-panel-title' }, 'Sign in to edit the website'),
    el('p', {}, 'You only need to do this once on this computer.'),
    el('label', { for: 'summit-name' }, 'Your name (saved with each change)'),
    el('input', { id: 'summit-name', name: 'name', autocomplete: 'name', required: true }),
    usePassword()
      ? [el('label', { for: 'summit-password' }, 'Password'),
        el('input', { id: 'summit-password', name: 'password', type: 'password', autocomplete: 'current-password', required: true })]
      : [el('label', { for: 'summit-token' }, 'Editing key'),
        el('input', { id: 'summit-token', name: 'token', type: 'password', autocomplete: 'off', required: true })],
    message ? el('p', { class: 'summit-msg inline', role: 'alert' }, message) : null,
    el('div', { class: 'summit-actions' },
      el('button', { type: 'submit', class: 'summit-btn primary', disabled: busy }, busy ? 'Checking…' : 'Sign in'),
      el('button', { type: 'button', class: 'summit-btn ghost', onclick: () => setEditing(false) }, 'Cancel'),
      settings.lockedKey ? el('button', { type: 'button', class: 'summit-btn ghost', onclick: () => { pasteKey = !pasteKey; message = ''; renderUI(); } }, pasteKey ? 'Use the password' : 'Use an editing key instead') : null));
    return form;
  }

  const css = `
    .summit-ui { position: fixed; z-index: 2147483000; left: max(12px, env(safe-area-inset-left, 0px)); bottom: max(12px, env(safe-area-inset-bottom, 0px)); display: grid; gap: 8px; max-width: min(48rem, calc(100vw - 24px)); font: 500 15px/1.4 Karla, "Segoe UI", system-ui, sans-serif; color: #fff; }
    .summit-bar, .summit-panel, .summit-pill, .summit-msg { background: #172f40; border: 1px solid rgb(255 255 255 / 0.14); box-shadow: 0 12px 32px rgb(5 15 22 / 0.35); border-radius: 10px; }
    .summit-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; }
    .summit-badge { padding: 3px 8px; border-radius: 999px; background: #a51d35; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .summit-status { flex: 1 1 12rem; color: #d5dee4; }
    .summit-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .summit-btn { appearance: none; border: 1px solid rgb(255 255 255 / 0.3); background: #fff; color: #172f40; border-radius: 6px; padding: 7px 12px; font: inherit; font-weight: 700; cursor: pointer; }
    .summit-btn.primary { background: #a51d35; border-color: #a51d35; color: #fff; }
    .summit-btn.danger { background: #fff; color: #a51d35; }
    .summit-btn.ghost { background: transparent; color: #fff; }
    .summit-btn.ghost-dark { background: #fff; color: #172f40; border-color: #c9d2d8; }
    .summit-btn.small { padding: 4px 10px; font-size: 13px; }
    .summit-btn:disabled { opacity: .45; cursor: default; }
    .summit-btn:focus-visible, .summit-pill:focus-visible, .summit-menu > *:focus-visible { outline: 3px solid #f0b7c1; outline-offset: 2px; }
    .summit-pill { display: inline-flex; align-items: center; gap: 8px; justify-self: start; padding: 10px 14px; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .summit-dot { width: 9px; height: 9px; border-radius: 50%; background: #f5c451; }
    .summit-msg { margin: 0; padding: 10px 12px; color: #fff; overflow-wrap: anywhere; }
    .summit-msg.inline { background: rgb(255 255 255 / 0.08); box-shadow: none; }
    .summit-panel { display: grid; gap: 8px; padding: 14px; }
    .summit-panel p, .summit-panel ul { margin: 0; color: #d5dee4; }
    .summit-panel-title { color: #fff !important; font-weight: 700; font-size: 16px; }
    .summit-form label { font-size: 13px; color: #d5dee4; margin-top: 4px; }
    .summit-form input, .summit-form select { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid rgb(255 255 255 / 0.3); background: #fff; color: #18242c; font: inherit; }
    .summit-menu { display: grid; gap: 4px; }
    .summit-menu > * { text-align: left; padding: 8px 10px; border-radius: 6px; background: rgb(255 255 255 / 0.06); color: #fff; border: 0; font: inherit; cursor: pointer; text-decoration: none; }
    .summit-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; }
    .summit-swatch { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
    .summit-swatch.changed { background: #f5c451; }
    .summit-swatch.draft { background: #8fbde6; margin-left: 8px; }

    .summit-review { position: fixed; inset: 0; z-index: 2147483001; display: grid; place-items: start center; overflow-y: auto; padding: max(16px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) 96px max(12px, env(safe-area-inset-left, 0px)); background: rgb(9 18 25 / 0.55); font: 400 15px/1.5 Karla, "Segoe UI", system-ui, sans-serif; color: #18242c; }
    .summit-review-inner { width: min(64rem, 100%); background: #fff; border-radius: 12px; box-shadow: 0 24px 60px rgb(5 15 22 / 0.4); overflow: hidden; }
    .summit-review-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 24px; padding: 20px 24px 16px; border-bottom: 1px solid #e3e8eb; background: #f6f8f9; position: sticky; top: 0; z-index: 1; }
    .summit-review-head h2 { margin: 2px 0 4px; font: 400 28px/1.15 "EB Garamond", Garamond, serif; color: #172f40; }
    .summit-review-kicker { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #a51d35; }
    .summit-review-legend { margin: 0; font-size: 13px; color: #5c6a73; white-space: pre-wrap; }
    .summit-review-msg { margin: 0; padding: 10px 24px; background: #eef4f9; color: #2d5b86; font-weight: 600; overflow-wrap: anywhere; }
    .summit-review-msg.warn { background: #fbf1dc; color: #7a5200; }
    .summit-review-body { padding: 8px 24px 28px; display: grid; gap: 22px; }
    .summit-review-page h3 { margin: 18px 0 8px; font: 500 21px/1.2 "EB Garamond", Garamond, serif; color: #172f40; }
    .summit-change { border: 1px solid #e3e8eb; border-radius: 8px; margin-top: 10px; overflow: hidden; }
    .summit-change-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: #f6f8f9; font-size: 13px; font-weight: 700; color: #45525b; }
    .summit-compare { display: grid; grid-template-columns: 1fr 1fr; }
    .summit-compare.single { grid-template-columns: 1fr; }
    .summit-col { padding: 12px 14px; min-width: 0; }
    .summit-col.before { border-right: 1px solid #e3e8eb; }
    .summit-col p { margin: 4px 0 0; overflow-wrap: anywhere; }
    .summit-col a { display: inline-block; margin-top: 6px; color: #a51d35; font-weight: 700; }
    .summit-col-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6a767e; }
    .summit-review del { background: #fde2e4; color: #9b1c2c; text-decoration: line-through; text-decoration-thickness: 1.5px; border-radius: 2px; }
    .summit-review ins { background: #dcf3e3; color: #1e6b3a; text-decoration: none; border-bottom: 2px solid #3a9a5d; border-radius: 2px; }
    .summit-empty { margin: 24px 0; color: #5c6a73; }
    @media (max-width: 40rem) {
      .summit-ui { font-size: 13px; gap: 6px; }
      .summit-bar { padding: 8px; gap: 6px 8px; }
      .summit-btn { padding: 5px 9px; }
      .summit-status { flex-basis: 100%; order: 3; }
      .summit-compare { grid-template-columns: 1fr; }
      .summit-col.before { border-right: 0; border-bottom: 1px solid #e3e8eb; }
      .summit-review-head, .summit-review-body { padding-left: 14px; padding-right: 14px; }
    }

    [data-summit-editing] [data-summit-editable] { outline: 1px dashed rgb(165 29 53 / 0.55); outline-offset: 3px; cursor: text; border-radius: 2px; }
    [data-summit-editing] [data-summit-editable]:hover { outline-style: solid; }
    [data-summit-editing] [data-summit-editable]:focus { outline: 2px solid #a51d35; outline-offset: 3px; background: rgb(255 255 255 / 0.9); color: #18242c; }
    [data-summit-editing] .summit-changed { box-shadow: inset 0 -0.6em 0 rgb(245 196 81 / 0.55); }
    [data-summit-editing] .summit-draft { box-shadow: inset 0 -0.6em 0 rgb(143 189 230 / 0.55); }
    [data-summit-editing] [data-summit-locked] { cursor: not-allowed; }
    @media (prefers-reduced-motion: no-preference) { .summit-bar, .summit-panel { animation: summit-in .18s ease-out; } }
    @keyframes summit-in { from { opacity: 0; transform: translateY(6px); } }
  `;

  // --------------------------------------------------------------- wiring
  document.head.append(Object.assign(document.createElement('style'), { textContent: css }));

  document.addEventListener('input', onInput);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && reviewOpen) { reviewOpen = false; confirmPublish = false; renderUI(); return; }
    if (!event.target.closest?.('[data-summit-editable]')) return;
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      event.target.closest('[data-summit-editable]').blur();
    }
  });
  document.addEventListener('paste', (event) => {
    if (!event.target.closest?.('[data-summit-editable]')) return;
    event.preventDefault();
    const text = norm(event.clipboardData.getData('text/plain'));
    document.execCommand('insertText', false, text);
  });
  // While editing, clicking text inside a link places the cursor instead of
  // leaving the page.
  window.addEventListener('click', (event) => {
    if (!editing) return;
    const editable = event.target.closest?.('[data-summit-editable]');
    if (editable && editable.closest('a')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  window.addEventListener('beforeunload', (event) => {
    if (editing && unsavedCount()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  // Pages swap without a full reload (Astro view transitions): rebuild the
  // toolbar and re-match the new page's text. Unsent edits are kept per file,
  // so they survive moving between pages.
  document.addEventListener('astro:page-load', () => {
    message = '';
    panel = null;
    if (editing && session) start();
    else renderUI();
  });

  if (editing || session) start();
})();
