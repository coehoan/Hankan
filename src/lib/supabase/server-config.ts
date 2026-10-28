import {publicSupabaseConfig} from '@/lib/env';
export function serverSupabaseConfig(){
 const config=publicSupabaseConfig();
 return {...config,url:process.env.SUPABASE_SERVER_URL||config.url,cookieName:'sb-'+new URL(config.url).hostname.split('.')[0]+'-auth-token'};
}
export function browserSupabaseUrl(value:string):string{
 const internal=serverSupabaseConfig().url.replace(/\/$/,''),external=publicSupabaseConfig().url.replace(/\/$/,'');
 return value.startsWith(internal+'/')?external+value.slice(internal.length):value;
}
