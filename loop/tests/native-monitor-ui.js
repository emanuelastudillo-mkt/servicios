document.querySelector('#prepare').onclick = async () => {
  const html = await (await fetch('../index.html')).text(), parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...parsed.body.childNodes); const base = document.createElement('base'); base.href = '/loop/'; document.head.prepend(base);
  document.querySelector('#master').value = 0; document.querySelector('#master-value').textContent = '0%';
  localStorage.setItem('seis.interface-mode','advanced');
  const report = document.createElement('pre'); report.id = 'native-monitor-test-result'; report.style.cssText = 'white-space:pre-wrap;padding:15px;background:#172514;color:#e2efc4'; document.body.prepend(report);
  let listener, last, count = 0, failure = false; const requests = [], packets = new Map(), messages = [];
  const assert = (value, label) => { if (!value) throw Error(label); count++; report.textContent += 'OK · ' + label + '\n'; };
  const wait = check => new Promise((resolve,reject) => { const start=performance.now();const timer=setInterval(()=>{if(check()){clearInterval(timer);resolve();}else if(performance.now()-start>7000){clearInterval(timer);reject(Error('Tiempo agotado'));}},20); });
  const change = (selector,value) => { const e=document.querySelector(selector); if(e.type==='checkbox')e.checked=value;else e.value=value;e.dispatchEvent(new Event(e.type==='range'?'input':'change',{bubbles:true})); };
  const Worklet = window.AudioWorkletNode;
  window.AudioWorkletNode = class extends Worklet { constructor(ctx,name,options){super(ctx,name,options);if(name==='seis-looper'){const send=this.port.postMessage.bind(this.port);this.port.postMessage=(data,...rest)=>{messages.push(data);send(data,...rest);};}} };
  window.seisDesktop = {version:'1.8.1'}; window.chrome ||= {};
  window.chrome.webview = {
    addEventListener(type,fn){listener=fn;},
    postMessage({id,action,args}) {
      let result;
      if(action==='sources.list') result={sources:[{id:'in:0:qa',label:'Scarlett simulada · Canal 1',group:'Instrumentos · escucha nativa'}],outputs:[{id:'qa-output',label:'Scarlett simulada'}],capabilities:{nativeMonitor:true,processCapture:true}};
      if(action==='capture.start') {
        const data=new Uint8Array(new Float32Array(480).fill(.2).buffer),samples=btoa(String.fromCharCode(...data));let sequence=0;
        packets.set(args.captureId,setInterval(()=>listener({data:{type:'pcm',captureId:args.captureId,samples,rate:48000,sequence:++sequence}}),10));
        result={label:'Scarlett simulada · Canal 1',rate:48000,physical:true,inputPeriodMs:3,lowLatency:true};
      }
      if(action==='capture.stop'){clearInterval(packets.get(args.captureId));packets.delete(args.captureId);result={stopped:true};}
      if(action==='monitor.configure') {
        requests.push(structuredClone(args));last=args;
        if(failure&&args.active){failure=false;setTimeout(()=>listener({data:{type:'reply',id,error:'Salida desconectada de prueba'}}),20);return;}
        result={active:args.active,captureId:args.captureId,output:'Scarlett simulada',inputPeriodMs:3,outputPeriodMs:3,queueMs:4,underruns:0,lowLatency:true};
      }
      setTimeout(()=>listener({data:{type:'reply',id,result}}),20);
    }
  };
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{throw Error('No se debe abrir el micrófono del navegador');}});
  Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,value:async()=>[]});
  window.addEventListener('pagehide',()=>{for(const timer of packets.values())clearInterval(timer);});
  try {
    await import('../app.js?v=1.8.1'); await wait(()=>document.querySelector('#source-0 option[value="native:in:0:qa"]'));
    change('#source-0','native:in:0:qa'); document.querySelector('.input-connect').click(); await wait(()=>document.querySelector('.input-listen input').disabled===false);
    assert(packets.size===1,'Entrada física nativa conectada sin abrir getUserMedia');
    change('.input-listen input',true); await wait(()=>last?.active);
    assert(messages.filter(m=>m.type==='settings'&&'monitor'in m).at(-1).monitor===false,'La escucha Web Audio queda apagada para evitar duplicación');
    assert(last.master===0&&last.gain===1,'Ganancia y volumen enviados al monitor nativo');
    document.querySelector('.fx-open').click(); await wait(()=>document.querySelector('#effects-dialog').open);
    change('#native-monitor-output','qa-output'); await wait(()=>last?.outputId==='qa-output');
    assert(last.outputId==='qa-output','Salida física explícita');
    change('#fx-add-select','overdrive'); document.querySelector('#fx-add').click(); await wait(()=>last?.effects?.pedals[0]?.type==='overdrive');
    assert(last.effects.pedals[0].enabled,'Pedalera enviada al DSP nativo');
    document.querySelector('#fx-bypass').click(); await wait(()=>last?.effects?.bypass);
    assert(last.effects.bypass,'Bypass de escucha con la misma configuración del loop');
    document.querySelector('#fx-tuner').click(); await wait(()=>last?.muted);
    assert(last.muted,'Afinador silencia la salida nativa'); document.querySelector('#tuner-close').click(); await wait(()=>last?.muted===false);
    assert(!last.muted,'Cerrar afinador recupera la escucha');
    change('#fx-listen',false); await wait(()=>last?.active===false); assert(!last.active,'Desactivar escucha detiene la salida nativa');
    failure=true; change('#fx-listen',true); await wait(()=>last?.active===false&&!document.querySelector('#fx-listen').checked);
    assert(messages.filter(m=>m.type==='settings'&&'monitor'in m).every(m=>!m.monitor),'Fallo de salida no enciende una escucha duplicada por navegador');
    document.querySelector('#fx-close').click(); document.querySelector('.input-disconnect').click(); await wait(()=>packets.size===0);
    assert(packets.size===0,'Desconexión libera la captura');
    report.textContent += `RESULTADO: ${count} comprobaciones correctas. Hardware real no probado.`;
  } catch(error) { report.textContent += 'ERROR: '+(error.stack||error.message); }
  finally { for(const timer of packets.values())clearInterval(timer); }
};
