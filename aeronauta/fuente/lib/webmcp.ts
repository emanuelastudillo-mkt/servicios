import { flushSync } from 'react-dom';
import { AIRCRAFT } from './catalog';
import { buyPlane, configureRoute, advanceQuarter, totals, quarterLabel, type Game } from './engine';
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
export function registerGameTools(read:()=>Game,commit:(s:Game)=>void,report:()=>void){
 const context=(document as Document&{modelContext?:{registerTool:(t:Tool,o:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();const snapshot=()=>{const s=read();return{name:s.name,hub:s.hub,quarter:quarterLabel(s.turn),cash:s.cash,fleet:s.fleet,routes:s.routes,forecast:totals(s),bankrupt:s.bankrupt};};
 const validate=(input:unknown,keys:string[])=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw Error('Parámetros inválidos.');return input as Record<string,unknown>;};
 const empty={type:'object',properties:{},additionalProperties:false};
 const tools:Tool[]=[
 {name:'aeronauta_read_game',title:'Consultar aerolínea',description:'Lee la partida y su proyección trimestral.',inputSchema:empty,annotations:{readOnlyHint:true,untrustedContentHint:true},execute:i=>{validate(i,[]);return snapshot();}},
 {name:'aeronauta_buy_aircraft',title:'Comprar avión',description:'Compra un avión con el capital del juego y lo agrega a la flota.',inputSchema:{type:'object',properties:{model:{type:'string',enum:AIRCRAFT.map(a=>a.id)}},required:['model'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:i=>{const p=validate(i,['model']);if(typeof p.model!=='string')throw Error('Modelo requerido.');const next=buyPlane(read(),p.model);flushSync(()=>commit(next));return snapshot();}},
 {name:'aeronauta_configure_route',title:'Abrir o ajustar ruta',description:'Abre una ruta desde la base, pagando su apertura, o ajusta una existente. Requiere avión disponible.',inputSchema:{type:'object',properties:{destination:{type:'string'},plane:{type:'string'},fare:{type:'number',minimum:50,maximum:2500},frequency:{type:'integer',minimum:1,maximum:35}},required:['destination','plane','fare','frequency'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:i=>{const p=validate(i,['destination','plane','fare','frequency']);if(typeof p.destination!=='string'||typeof p.plane!=='string'||typeof p.fare!=='number'||typeof p.frequency!=='number')throw Error('Datos inválidos.');const s=read();const next=configureRoute(s,{to:p.destination,plane:p.plane,fare:p.fare,frequency:p.frequency},s.routes.find(r=>r.to===p.destination)?.id);flushSync(()=>commit(next));return snapshot();}},
 {name:'aeronauta_advance_quarter',title:'Avanzar trimestre',description:'Liquida ingresos y costos, avanza el calendario y muestra el informe.',inputSchema:empty,annotations:{readOnlyHint:false,untrustedContentHint:false},execute:i=>{validate(i,[]);const next=advanceQuarter(read());flushSync(()=>{commit(next);report();});return snapshot();}}
 ];for(const tool of tools)try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
 return()=>lifecycle.abort();
}
