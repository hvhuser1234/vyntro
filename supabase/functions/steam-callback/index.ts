import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const enc=new TextEncoder(),dec=new TextDecoder()
function fromB64url(s:string){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function verifyState(state:string,secret:string){
  const [body,sig]=state.split('.');if(!body||!sig)return null
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify'])
  const ok=await crypto.subtle.verify('HMAC',key,fromB64url(sig),enc.encode(body));if(!ok)return null
  try{const data=JSON.parse(dec.decode(fromB64url(body)));if(data.exp<Math.floor(Date.now()/1000))return null;return data}catch{return null}
}
function safeReturn(v?:string){try{const u=new URL(v||'');if(u.origin==='https://hvhuser1234.github.io'&&u.pathname.startsWith('/vyntro'))return u.href}catch{}return'https://hvhuser1234.github.io/vyntro/'}

serve(async(req)=>{
  const u=new URL(req.url)
  const supabaseUrl=Deno.env.get('SUPABASE_URL')!
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const state=await verifyState(u.searchParams.get('state')||'',serviceKey)
  const returnTo=safeReturn(state?.returnTo)
  if(!state)return Response.redirect(`${returnTo}?steam_error=state`,302)
  const verify=new URLSearchParams()
  u.searchParams.forEach((v,k)=>{if(k.startsWith('openid.'))verify.set(k,v)})
  verify.set('openid.mode','check_authentication')
  const r=await fetch('https://steamcommunity.com/openid/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:verify})
  const text=await r.text()
  if(!text.includes('is_valid:true'))return Response.redirect(`${returnTo}?steam_error=invalid`,302)
  const claimed=u.searchParams.get('openid.claimed_id')||''
  const steamId=claimed.match(/\/openid\/id\/(\d+)/)?.[1]
  if(!steamId)return Response.redirect(`${returnTo}?steam_error=noid`,302)
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})
  if(state.mode==='link'&&state.uid){
    const got=await admin.auth.admin.getUserById(state.uid)
    if(got.error||!got.data.user)return Response.redirect(`${returnTo}?steam_error=user`,302)
    const app={...(got.data.user.app_metadata||{}),steam_id64:steamId,steam_verified_at:new Date().toISOString()}
    const upd=await admin.auth.admin.updateUserById(state.uid,{app_metadata:app})
    if(upd.error)return Response.redirect(`${returnTo}?steam_error=link`,302)
    return Response.redirect(`${returnTo}?steam_linked=1`,302)
  }
  const syntheticEmail=`steam_${steamId}@vyntro.invalid`
  const created=await admin.auth.admin.createUser({email:syntheticEmail,email_confirm:true,app_metadata:{provider:'steam',steam_id64:steamId,steam_verified_at:new Date().toISOString()},user_metadata:{display_name:'Steam Player',role:'Carry',target_rank:'Legend',mission_history:[]}})
  if(created.error&&!/already|registered|exists/i.test(created.error.message||''))return Response.redirect(`${returnTo}?steam_error=create`,302)
  if(created.data.user){await admin.auth.admin.updateUserById(created.data.user.id,{app_metadata:{...(created.data.user.app_metadata||{}),provider:'steam',steam_id64:steamId,steam_verified_at:new Date().toISOString()}})}
  const link=await admin.auth.admin.generateLink({type:'magiclink',email:syntheticEmail,options:{redirectTo:returnTo}})
  if(link.error||!link.data.properties?.action_link)return Response.redirect(`${returnTo}?steam_error=session`,302)
  return Response.redirect(link.data.properties.action_link,302)
})