import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,[path.join(root,'node_modules/supabase/dist/supabase.js'),...process.argv.slice(2)],{
 cwd:root,
 env:{...process.env,SUPABASE_HOME:path.join(root,'work','supabase-home')},
 stdio:'inherit',
 windowsHide:true,
});
child.on('error',error=>{console.error(error.message);process.exitCode=1});
child.on('exit',code=>{process.exitCode=code??1});
