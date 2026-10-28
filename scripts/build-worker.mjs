import {build} from 'esbuild';
await build({entryPoints:['src/jobs/worker.ts'],bundle:true,platform:'node',target:'node24',format:'cjs',outfile:'dist/worker.cjs',define:{'process.env.HANKAN_WORKER_MAIN':'"1"'},plugins:[{name:'server-only-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:''}))}}]});
console.log('Worker bundled: dist/worker.cjs');
await build({entryPoints:['next.config.ts'],platform:'node',target:'node24',format:'esm',outfile:'dist/next.config.mjs'});
