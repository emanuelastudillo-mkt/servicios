import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'online/package.json'));
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('wrangler/package.json'))]}));
export async function buildTutorialTerrain(copyPublic=true) {
const out=path.join(root,'tutorial/assets/terrain3d');
await mkdir(out,{recursive:true});
const source=path.join(root,'assets/terrain3d');
for(const file of ['sprint-salta.json','sprint-salta.i16','sprint-salta.webp','ATTRIBUTION.md','MAPZEN-SOURCES.md','THREE-LICENSE.txt'])if(existsSync(path.join(source,file)))await cp(path.join(source,file),path.join(out,file));
await build({entryPoints:[path.join(root,'src/terrain-viewer.js')],outfile:path.join(out,'viewer.js'),bundle:true,format:'esm',platform:'browser',minify:true,nodePaths:[path.join(root,'online/node_modules')]});
if(copyPublic)await cp(path.join(root,'tutorial'),path.join(root,'online/public/tutorial'),{recursive:true});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await buildTutorialTerrain();console.log('Tutorial 3D generado y copiado a online/public/tutorial.');
}
