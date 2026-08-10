import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve((req) => {
  const url = new URL(req.url)
  const returnTo = url.searchParams.get('return_to') || Deno.env.get('SITE_URL') || 'https://hvhuser1234.github.io/vyntro/'
  const callback = `${Deno.env.get('SUPABASE_URL')}/functions/v1/steam-callback?return_to=${encodeURIComponent(returnTo)}`
  const params = new URLSearchParams({
    'openid.ns':'http://specs.openid.net/auth/2.0',
    'openid.mode':'checkid_setup',
    'openid.return_to':callback,
    'openid.realm':new URL(returnTo).origin,
    'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'
  })
  return Response.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`,302)
})
