import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'access-control-allow-origin':'https://hvhuser1234.github.io',
  'access-control-allow-headers':'authorization, apikey, content-type',
  'access-control-allow-methods':'GET, OPTIONS',
  'content-type':'application/json; charset=utf-8'
}
const enc=new TextEncoder()
function b64url(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function textB64url(s:string){return b64url(enc.encode(s))}
async function hmac(data:string,secret:string){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(data))))}
async function seal(payload:Record<string,unknown>,secret:string){const body=textB64url(JSON.stringify(payload));return `${body}.${await hmac(body,secret)}`}

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  const url=new URL(req.url)
  if(url.searchParams.get('probe')==='1')return new Response(JSON.stringify({ok:true,version:4}),{headers:cors})
  const supabaseUrl=Deno.env.get('SUPABASE_URL')!
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const siteUrl='https://hvhuser1234.github.io/vyntro/'
  const requested=url.searchParams.get('return_to')||siteUrl
  let returnTo=siteUrl
  try{const u=new URL(requested);if(u.origin==='https://hvhuser1234.github.io'&&u.pathname.startsWith('/vyntro'))returnTo=u.href}catch{}
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})
  const auth=req.headers.get('authorization')||''
  let uid:string|null=null
  if(auth.startsWith('Bearer ')){const {data}=await admin.auth.getUser(auth.slice(7));uid=data.user?.id||null}
  const action=url.searchParams.get('action')||'login'
  if(action==='unlink'){
    if(!uid)return new Response(JSON.stringify({ok:false,error:'auth_required'}),{status:401,headers:cors})
    const got=await admin.auth.admin.getUserById(uid)
    if(got.error||!got.data.user)return new Response(JSON.stringify({ok:false,error:'user_not_found'}),{status:404,headers:cors})
    const app={...(got.data.user.app_metadata||{})};delete app.steam_id64;delete app.steam_verified_at
    const upd=await admin.auth.admin.updateUserById(uid,{app_metadata:app})
    if(upd.error)return new Response(JSON.stringify({ok:false,error:'unlink_failed'}),{status:500,headers:cors})
    return new Response(JSON.stringify({ok:true}),{headers:cors})
  }
  const state=await seal({v:1,mode:uid?'link':'login',uid,returnTo,exp:Math.floor(Date.now()/1000)+600},serviceKey)
  const callback=`${supabaseUrl}/functions/v1/steam-callback?state=${encodeURIComponent(state)}`
  const q=new URLSearchParams({
    'openid.ns':'http://specs.openid.net/auth/2.0',
    'openid.mode':'checkid_setup',
    'openid.return_to':callback,
    'openid.realm':new URL(supabaseUrl).origin,
    'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'
  })
  return new Response(JSON.stringify({ok:true,url:`https://steamcommunity.com/openid/login?${q}`}),{headers:cors})
})