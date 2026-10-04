import {simulateRace} from './engine.js';
self.onmessage=e=>{try{self.postMessage({ok:true,race:simulateRace(e.data)});}catch(error){self.postMessage({ok:false,error:error.message});}};
