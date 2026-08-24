/** FORTUNE NOIR secure admin/player balance API
 * Cloudflare Worker + D1
 * Required vars: ADMIN_PASSWORD, SESSION_SECRET
 * Required binding: DB (D1)
 */
const json = (data, status=200, extra={}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...extra }
});
const cors = (req) => {
  const origin = req.headers.get('Origin') || '';
  const allow = origin && (origin.endsWith('.github.io') || origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:5500');
  return allow ? {'access-control-allow-origin':origin,'access-control-allow-credentials':'true','vary':'Origin'} : {};
};
async function body(req){ try{return await req.json()}catch{return {}} }
function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256(text){return bytesToHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))}
function token(){const b=new Uint8Array(32);crypto.getRandomValues(b);return bytesToHex(b)}
async function sign(data, secret){return sha256(`${data}.${secret}`)}
async function session(req, env){
  const raw=req.headers.get('Authorization')||''; if(!raw.startsWith('Bearer ')) return null;
  const t=raw.slice(7); if(!t) return null;
  const h=await sha256(t);
  const row=await env.DB.prepare('SELECT token_hash, player_id, role, expires_at FROM sessions WHERE token_hash=?').bind(h).first();
  if(!row || Number(row.expires_at)<Date.now()) return null;
  return row;
}
async function ensurePlayer(env, playerId, name){
  const safe=String(playerId||'').trim();
  if(!/^[a-f0-9-]{20,80}$/i.test(safe)) throw new Error('INVALID_PLAYER_ID');
  await env.DB.prepare(`INSERT INTO players(player_id,name,balance,created_at,updated_at) VALUES(?,?,10000,?,?) ON CONFLICT(player_id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at`).bind(safe,String(name||'PLAYER').slice(0,32),Date.now(),Date.now()).run();
}
export default {
 async fetch(req, env){
  const headers=cors(req); const url=new URL(req.url); const path=url.pathname.replace(/\/+$/,'')||'/';
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type,Authorization'}});
  try{
   if(path==='/health') return json({ok:true,service:'FORTUNE_NOIR_ADMIN_API',version:'1.0.0'},200,headers);
   if(path==='/auth/login' && req.method==='POST'){
    const b=await body(req); if(String(b.username||'')!=='391x' || !env.ADMIN_PASSWORD || String(b.password||'')!==String(env.ADMIN_PASSWORD)) return json({ok:false,error:'INVALID_CREDENTIALS'},401,headers);
    const t=token(), h=await sha256(t), exp=Date.now()+86400000;
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run();
    await env.DB.prepare('INSERT INTO sessions(token_hash,player_id,role,expires_at,created_at) VALUES(?,?,?,?,?)').bind(h,'391x','admin',exp,Date.now()).run();
    return json({ok:true,token:t,role:'admin',playerId:'391x',expiresAt:exp},200,headers);
   }
   if(path==='/auth/logout' && req.method==='POST'){
    const s=await session(req,env); const raw=(req.headers.get('Authorization')||'').slice(7); if(raw) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(raw)).run();
    return json({ok:true},200,headers);
   }
   if(path==='/auth/me' && req.method==='GET'){
    const s=await session(req,env); if(!s)return json({ok:false,authenticated:false},401,headers);
    return json({ok:true,authenticated:true,role:s.role,playerId:s.player_id},200,headers);
   }
   if(path==='/player/session' && req.method==='POST'){
    const b=await body(req); await ensurePlayer(env,b.playerId,b.name);
    const t=token(),h=await sha256(t),exp=Date.now()+30*86400000;
    await env.DB.prepare('INSERT INTO sessions(token_hash,player_id,role,expires_at,created_at) VALUES(?,?,?,?,?)').bind(h,String(b.playerId),'player',exp,Date.now()).run();
    const p=await env.DB.prepare('SELECT balance,name FROM players WHERE player_id=?').bind(String(b.playerId)).first();
    return json({ok:true,token:t,playerId:b.playerId,balance:Number(p.balance),name:p.name,expiresAt:exp},200,headers);
   }
   if(path==='/player/adjust' && req.method==='POST'){
    const s=await session(req,env); if(!s || s.role!=='player')return json({ok:false,error:'UNAUTHORIZED'},401,headers);
    const b=await body(req), delta=Number(b.delta), txId=String(b.txId||'').slice(0,100);
    if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>1000000000||!txId)return json({ok:false,error:'INVALID_ADJUST'},400,headers);
    const old=await env.DB.prepare('SELECT balance FROM players WHERE player_id=?').bind(s.player_id).first(); if(!old)return json({ok:false,error:'PLAYER_NOT_FOUND'},404,headers);
    const dup=await env.DB.prepare('SELECT id,balance_after FROM balance_ledger WHERE tx_id=?').bind(txId).first();
    if(dup)return json({ok:true,balance:Number(dup.balance_after),duplicate:true},200,headers);
    const next=Number(old.balance)+delta; if(next<0)return json({ok:false,error:'INSUFFICIENT_BALANCE'},400,headers);
    await env.DB.batch([
      env.DB.prepare('UPDATE players SET balance=?,updated_at=? WHERE player_id=?').bind(next,Date.now(),s.player_id),
      env.DB.prepare('INSERT INTO balance_ledger(tx_id,player_id,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?)').bind(txId,s.player_id,delta,next,String(b.reason||'GAME').slice(0,80),Date.now())
    ]);
    return json({ok:true,balance:next,delta},200,headers);
   }
   if(path==='/balance' && req.method==='GET'){
    const s=await session(req,env); if(!s)return json({ok:false,error:'UNAUTHORIZED'},401,headers);
    const p=await env.DB.prepare('SELECT player_id,balance,name FROM players WHERE player_id=?').bind(s.player_id).first();
    if(!p)return json({ok:false,error:'PLAYER_NOT_FOUND'},404,headers);
    return json({ok:true,playerId:p.player_id,balance:Number(p.balance),name:p.name},200,headers);
   }
   if(path==='/admin/grant' && req.method==='POST'){
    const s=await session(req,env); if(!s || s.role!=='admin')return json({ok:false,error:'FORBIDDEN'},403,headers);
    const b=await body(req), playerId=String(b.playerId||'').trim(), amount=Number(b.amount);
    if(!/^[a-f0-9-]{20,80}$/i.test(playerId) || !Number.isSafeInteger(amount) || amount===0 || Math.abs(amount)>1000000000) return json({ok:false,error:'INVALID_GRANT'},400,headers);
    const p=await env.DB.prepare('SELECT balance FROM players WHERE player_id=?').bind(playerId).first(); if(!p)return json({ok:false,error:'PLAYER_NOT_FOUND'},404,headers);
    const next=Number(p.balance)+amount; if(next<0)return json({ok:false,error:'INSUFFICIENT_PLAYER_BALANCE'},400,headers);
    await env.DB.batch([
      env.DB.prepare('UPDATE players SET balance=?,updated_at=? WHERE player_id=?').bind(next,Date.now(),playerId),
      env.DB.prepare('INSERT INTO admin_logs(admin_player_id,target_player_id,amount,note,created_at) VALUES(?,?,?,?,?)').bind(s.player_id,playerId,amount,String(b.note||'').slice(0,200),Date.now())
    ]);
    return json({ok:true,playerId,balance:next,amount},200,headers);
   }
   if(path==='/admin/logs' && req.method==='GET'){
    const s=await session(req,env); if(!s || s.role!=='admin')return json({ok:false,error:'FORBIDDEN'},403,headers);
    const rows=await env.DB.prepare('SELECT id,target_player_id,amount,note,created_at FROM admin_logs ORDER BY id DESC LIMIT 100').all();
    return json({ok:true,logs:rows.results||[]},200,headers);
   }
   return json({ok:false,error:'NOT_FOUND'},404,headers);
  }catch(e){return json({ok:false,error:'SERVER_ERROR',detail:String(e&&e.message||e)},500,headers)}
 }
};
