// Peercord dedicated server. Pure Node (no browser, no native modules).
// Speaks the same encrypted protocol as the app, over WebSocket.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { WebSocketServer } = require('ws');
const C = require('crypto').webcrypto;

const PORT = +process.env.PEERCORD_PORT || 8787;
const NAME = process.env.PEERCORD_NAME || 'Server';
const DIR = process.env.PEERCORD_DATA || path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'state.json');

const b64 = u => Buffer.from(u).toString('base64url');
const unb64 = s => new Uint8Array(Buffer.from(s, 'base64url'));
const rand = n => C.getRandomValues(new Uint8Array(n));
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const okImg = s => typeof s === 'string' && s.length < 250000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(s);

fs.mkdirSync(DIR, { recursive: true });
let st; try { st = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
st = st || { key: b64(rand(32)), adminKey: b64(rand(16)), channels: [{ id: 'general', name: 'general' }], msgs: { general: [] }, bans: [], owners: {} };
let timer; const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(st, (k, v) => k === 'img' ? undefined : v), () => {}), 500); };
save();

let KEY;
const enc = async o => { const iv = rand(12); const ct = new Uint8Array(await C.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, Buffer.from(JSON.stringify(o)))); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64(out); };
const dec = async s => { const u = unb64(s); return JSON.parse(Buffer.from(await C.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, KEY, u.slice(12))).toString()); };

const members = new Map(); let voice = [];
const pub = () => [{ id: 'server', name: NAME }, ...[...members.values()].map(({ id, name, pk }) => ({ id, name, pk }))];
const slug = s => clean(s, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function bc(o, except) { const e = await enc(o); for (const m of members.values()) if (m.id !== except && m.ws.readyState === 1) m.ws.send(e); }
async function sys(text) { const msg = { id: C.randomUUID(), sys: 1, text, ts: Date.now() }; (st.msgs.general = st.msgs.general || []).push(msg); save(); return bc({ t: 'msg', ch: 'general', msg }); }
function pushBans() { members.forEach(async m => { if (m.admin && m.ws.readyState === 1) m.ws.send(await enc({ t: 'bans', list: st.bans })); }); }
function drop(m) {
  if (members.get(m.id) !== m) return; members.delete(m.id);
  const was = voice.includes(m.id); voice = voice.filter(x => x !== m.id);
  try { m.ws.close(); } catch {}
  bc({ t: 'members', members: pub() }); if (was) bc({ t: 'voice', list: voice }); sys(m.name + ' left');
}
async function reject(ws, ban) { ws.send(await enc({ t: 'kicked', ban })); setTimeout(() => ws.close(), 300); }

async function handle(m, ws) {
  const now = Date.now(); let mem = ws.m;
  if (m.t === 'join') {
    if (mem) return;
    const id = String(m.id || ''), tk = String(m.tok || '').slice(0, 64);
    if (!/^[\w-]{4,40}$/.test(id) || tk.length < 8 || id === 'server') return ws.close();
    if (st.bans.some(b => b.id === id)) return reject(ws, 1);
    if (st.owners[id] && st.owners[id] !== tk) return reject(ws, 0); // id already belongs to someone else
    st.owners[id] = tk; const ks = Object.keys(st.owners); if (ks.length > 5000) delete st.owners[ks[0]]; save();
    const old = members.get(id); if (old) { members.delete(id); try { old.ws.close(); } catch {} }
    const pk = m.pk && m.pk.kty === 'EC' ? { kty: 'EC', crv: 'P-256', x: clean(m.pk.x, 64), y: clean(m.pk.y, 64) } : null;
    mem = { id, name: clean(m.name, 24) || 'anon', ws, last: now, admin: !!m.admin && m.admin === st.adminKey, pk };
    ws.m = mem; members.set(id, mem);
    ws.send(await enc({ t: 'sync', channels: st.channels, msgs: st.msgs, members: pub(), voice, admin: mem.admin, bans: mem.admin ? st.bans : [] }));
    await bc({ t: 'members', members: pub() }, id); return sys(mem.name + ' joined');
  }
  if (!mem) return; mem.last = now; const id = mem.id;
  if (m.t === 'msg') {
    const text = clean(m.text, 2000), ch = st.channels.find(x => x.id === m.ch), img = okImg(m.img) ? m.img : null;
    if ((!text && !img) || !ch) return;
    const msg = { id: C.randomUUID(), from: id, name: mem.name, text, ts: now }; if (img) { msg.img = img; msg.hi = 1; }
    const a = st.msgs[ch.id] = st.msgs[ch.id] || []; a.push(msg); if (a.length > 200) a.shift();
    a.filter(x => x.img).slice(0, -10).forEach(x => delete x.img); save(); return bc({ t: 'msg', ch: ch.id, msg });
  }
  if (m.t === 'chan' && mem.admin) {
    const n = slug(m.name); if (!n || st.channels.length >= 20 || st.channels.some(x => x.id === n)) return;
    st.channels.push({ id: n, name: n }); st.msgs[n] = []; save(); return bc({ t: 'chan', channels: st.channels });
  }
  if (m.t === 'rename' && mem.admin) {
    const n = slug(m.name), c = st.channels.find(x => x.id === m.id);
    if (!c || !n || st.channels.some(x => x.name === n && x !== c)) return; c.name = n; save(); return bc({ t: 'chan', channels: st.channels });
  }
  if ((m.t === 'kick' || m.t === 'ban') && mem.admin) {
    const t = members.get(m.id); if (!t) return;
    if (m.t === 'ban') { st.bans.push({ id: t.id, name: t.name }); save(); pushBans(); }
    try { t.ws.send(await enc({ t: 'kicked', ban: m.t === 'ban' })); } catch {}
    return void setTimeout(() => drop(t), 300);
  }
  if (m.t === 'unban' && mem.admin) { st.bans = st.bans.filter(b => b.id !== m.id); save(); return pushBans(); }
  if (m.t === 'dm') { // relayed as opaque ciphertext; the server cannot read it
    const to = members.get(m.to); if (!to || to === mem || typeof m.d !== 'string' || m.d.length > 400000) return;
    return void to.ws.send(await enc({ t: 'dm', from: id, d: m.d, ts: now }));
  }
  if (m.t === 'vjoin') { const prev = voice.filter(x => x !== id); voice = [...prev, id]; ws.send(await enc({ t: 'vpeers', list: prev })); return bc({ t: 'voice', list: voice }); }
  if (m.t === 'vleave') { voice = voice.filter(x => x !== id); return bc({ t: 'voice', list: voice }); }
}

(async () => {
  KEY = await C.subtle.importKey('raw', unb64(st.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const srv = http.createServer((q, r) => { r.writeHead(200); r.end('Peercord server'); });
  const wss = new WebSocketServer({ server: srv, maxPayload: 600000 });
  wss.on('connection', ws => {
    let n = 0; const rl = setInterval(() => n = 0, 10000);
    ws.on('message', async r => { if (++n > 40) return ws.close(); try { await handle(await dec(r.toString()), ws); } catch { if (!ws.m) ws.close(); } });
    ws.on('close', () => { clearInterval(rl); if (ws.m) drop(ws.m); });
    ws.on('error', () => {});
  });
  setInterval(() => { const t = Date.now() - 35000; members.forEach(m => { if (m.last < t) drop(m); }); }, 10000);
  srv.listen(PORT, () => {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log(`Peercord server "${NAME}" listening on port ${PORT}\nData: ${DIR}\n`);
    for (const ip of ips.length ? ips : ['localhost']) {
      console.log(`Invite:       pcw:${st.key}:-:ws://${ip}:${PORT}`);
      console.log(`Admin invite: pcw:${st.key}:${st.adminKey}:ws://${ip}:${PORT}\n`);
    }
    console.log('Replace the IP with your domain or public address for remote users (use wss:// behind HTTPS).');
  });
})();
process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));
