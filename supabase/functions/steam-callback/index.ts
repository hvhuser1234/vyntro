import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const u = new URL(req.url)
  const returnTo = u.searchParams.get('return_to') || Deno.env.get('SITE_URL') || 'https://hvhuser1234.github.io/vyntro/'
  const verify = new URLSearchParams()
  u.searchParams.forEach((v,k)=>{ if(k.startsWith('openid.')) verify.set(k,v) })
  verify.set('openid.mode','check_authentication')
  const r = await fetch('https://steamcommunity.com/openid/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:verify})
  const text = await r.text()
  if(!text.includes('is_valid:true')) return Response.redirect(`${returnTo}?steam_error=invalid`,302)
  const claimed = u.searchParams.get('openid.claimed_id') || ''
  const steamId = claimed.match(/\/openid\/id\/(\d+)/)?.[1]
  if(!steamId) return Response.redirect(`${returnTo}?steam_error=noid`,302)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, service, {auth:{autoRefreshToken:false,persistSession:false}})
  const syntheticEmail = `steam_${steamId}@vyntro.invalid`

  let uid:string|undefined
  const list = await admin.auth.admin.listUsers({page:1,perPage:1000})
  uid = list.data.users.find(x=>x.user_metadata?.steam_id64===steamId || x.email===syntheticEmail)?.id
  if(!uid){
    const created = await admin.auth.admin.createUser({email:syntheticEmail,email_confirm:true,user_metadata:{steam_id64:steamId,provider:'steam'}})
    if(created.error || !created.data.user) return Response.redirect(`${returnTo}?steam_error=create`,302)
    uid=created.data.user.id
  }
  await admin.from('profiles').upsert({id:uid,email:syntheticEmail,steam_id64:steamId,updated_at:new Date().toISOString()},{onConflict:'id'})

  const link = await admin.auth.admin.generateLink({type:'magiclink',email:syntheticEmail,options:{redirectTo:returnTo}})
  if(link.error || !link.data.properties?.action_link) return Response.redirect(`${returnTo}?steam_error=session`,302)
  return Response.redirect(link.data.properties.action_link,302)
})
