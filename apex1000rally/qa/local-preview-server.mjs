import http from 'node:http';
import path from 'node:path';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(name!==root&&!name.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    let file=name,info=await stat(file);if(info.isDirectory()){file=path.join(file,'index.html');info=await stat(file);}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','content-length':info.size,'cache-control':'no-cache'});
    if(req.method==='HEAD'){res.end();return;}createReadStream(file).pipe(res);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4188,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4188/'));
