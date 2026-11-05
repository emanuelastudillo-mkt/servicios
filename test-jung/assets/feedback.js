// Lectura orientativa: los ejemplos describen situaciones, no rasgos ni diagnósticos.
const contexts={
  care:{question:'La última vez que alguien necesitó apoyo y vos ya tenías un plan, ¿qué hiciste?',scene:'Pensá en una ocasión reciente de tu vida. Elegí la opción que más se acerque a lo que viviste.',options:[
    ['choice','Cambié mi plan porque quería ayudar y podía hacerlo.'],
    ['guilt','Cambié mi plan porque sentí culpa si no ayudaba.'],
    ['limit','Ofrecí lo que podía y mantuve mi plan.'],
    ['unclear','Pasó otra cosa o no sé qué pesó más.'],
    ['skip','No recuerdo una ocasión / prefiero pasar.']]},
  repair:{question:'Pensá en una situación de esa relación que te dolió. ¿Qué pasó después?',scene:'Elegí un episodio que recuerdes bien. La pregunta se refiere solo a esa ocasión.',options:[
    ['change','Hablamos y el cambio se sostuvo en hechos.'],
    ['repeat','Hubo una disculpa, pero lo mismo volvió a pasar.'],
    ['unspoken','El tema quedó sin hablar.'],
    ['early','No tuve ocasión de ver si algo cambió.'],
    ['skip','No recuerdo una ocasión / prefiero pasar.']]}
};
const relationshipNames={actual:'Mi pareja actual',ex:'Una expareja',none:'Solo mi crianza y mi presente'};
const themes={care:'Cuidado',voice:'Voz propia',autonomy:'Autonomía',worth:'Valoración',distance:'Distancia',steady:'Recursos',unknown:'Información insuficiente'};
const lens=[
  {key:'voice',title:'Dejar que alguien también te acompañe',lead:'Cuando algo te preocupa, tendés a resolverlo por tu cuenta. Así puede pasar que alguien cercano crea que estás bien justo cuando más te serviría compañía.',history:'buscar consuelo y no encontrar compañía',action:'Pensá en una preocupación concreta. ¿Necesitabas una solución, una mano con algo o simplemente que te escucharan?',phrase:'¿Tenés un rato para escucharme? Por ahora no necesito soluciones.',past:'¿Hubo un momento en que pediste apoyo? ¿Qué hizo esa persona con tu pedido?'},
  {key:'voice',title:'Poder contar lo que te dolió',lead:'A veces el esfuerzo no está en entender qué sentiste, sino en decidir si podés contarlo sin que se burlen o te juzguen. Ahí importa tanto tu deseo de hablar como el trato que encontrás al hacerlo.',history:'que restaran importancia a tu tristeza o a tu miedo',action:'Elegí una emoción que pudiste reconocer, aunque no la hayas dicho. ¿Con quién te resultaría sencillo hablar de ella?',phrase:'Lo viví de otra manera. Me gustaría contarte por qué me dolió.',past:'Recordá una vez en que mostraste algo que te dolía. ¿Te escuchó aunque no compartiera tu opinión?'},
  {key:'worth',title:'Qué pasa con el cariño cuando no podés dar más',lead:'Cuando un favor empieza a sentirse como el precio de seguir cerca, cuesta saber si realmente querías hacerlo. Una pista útil es recordar qué pasó la última vez que no pudiste cumplir un pedido.',history:'recibir aprobación sobre todo cuando rendías, obedecías o ayudabas',action:'Recordá un favor que te costó aceptar. Si hubieras tenido la certeza de seguir siendo querido, ¿habrías elegido lo mismo?',phrase:'Esta vez no puedo hacerlo. Me gustaría que encontremos otra manera de compartir el día.',past:'Elegí un momento en que no pudiste hacer un favor. ¿El trato afectuoso siguió ahí?'},
  {key:'distance',title:'Cuando una demora se siente como rechazo',lead:'Podés saber que alguien está ocupado y, aun así, sentir que la distancia significa algo más. Conviene separar dos preguntas: qué información te falta y si había algún acuerdo que la otra persona no cumplió.',history:'pasar de la cercanía al rechazo sin entender qué esperar',action:'Traé a la memoria una demora. ¿Sabías que había cambiado un plan, o estabas tratando de adivinar qué significaba el silencio?',phrase:'Si cambia lo que acordamos, ¿podés avisarme cuando puedas?',past:'¿Qué te inquietaba más: una demora puntual o que los acuerdos de contacto se incumplieran una y otra vez?'},
  {key:'autonomy',title:'Decidir sin tener que pedir permiso',lead:'Consultar una decisión que afecta a ambos puede ser una forma de cuidado. Algo distinto ocurre cuando hasta un plan propio necesita aprobación para que puedas disfrutarlo sin culpa.',history:'tener poco margen para decisiones apropiadas para tu edad',action:'Pensá en una salida con amistades. Separá lo que necesitaba coordinación de lo que era una elección tuya.',phrase:'Ya hice este plan para el sábado. Veamos qué necesitamos coordinar.',past:'¿Qué actividades mantuviste porque eran importantes para vos? ¿Cuáles dejaste por la reacción que esperabas?'},
  {key:'worth',title:'Que una crítica no decida cuánto valés',lead:'Un comentario sobre algo que hiciste puede terminar pesando como un juicio sobre quién sos. Vale la pena separar qué parte de la crítica te sirve y qué parte fue una descalificación que no tenés por qué hacer propia.',history:'sentirte inferior al recibir críticas o comparaciones',action:'Elegí una crítica reciente. ¿Señalaba algo concreto que podías revisar o te dejaba con la sensación de no valer?',phrase:'Puedo hablar de ese error. Me sirve que hablemos de lo que pasó sin descalificarnos.',past:'Cuando esa persona disentía, ¿seguías sintiendo respeto por vos, incluso si te habías equivocado?'},
  {key:'care',title:'Cuidar sin quedar a cargo de todo',lead:'Te importa acompañar cuando alguien está mal. La diferencia que conviene mirar es si podés elegir cuánto dar o si sentís que no tenés derecho a descansar hasta que la otra persona esté bien.',history:'tener que calmar o sostener a una persona adulta siendo chico',action:'Recordá una ocasión en que diste más de lo que tenías disponible. ¿Qué parte de la ayuda sí habrías querido ofrecer?',phrase:'Puedo escucharte un rato hoy. El resto no puedo resolverlo por vos.',past:'¿En qué momentos acompañaste por elección y en cuáles sentiste que su bienestar dependía solo de vos?'},
  {key:'voice',title:'Poder decir que no sin perder tu lugar',lead:'Hay veces en que decir que sí trae alivio inmediato porque evita una discusión. Lo que queda para después es averiguar qué querías vos y si en esa relación había margen para elegir otra cosa.',history:'sentir miedo al disentir por la reacción que podía venir',action:'Pensá en un «sí» que en realidad era un «hoy no». ¿Qué necesitabas cuidar en ese momento?',phrase:'Hoy prefiero que no. Podemos pensar otra opción.',past:'¿Qué ocurría después de un desacuerdo: podías mantener tu decisión o terminabas cediendo para recuperar la calma?'}
];
const shadowRead=[
  {image:'quién cuida a quien suele cuidar',text:'Pedir compañía deja abierta la posibilidad de que el otro diga cuánto puede dar. Culparlo si no resuelve el problema convierte esa ayuda en una obligación.',past:'Cuando no estabas disponible, ¿la otra persona buscaba otras formas de resolver lo que le pasaba?'},
  {image:'lo que queda pendiente después del silencio',text:'Pedir una pausa puede cuidar una conversación. La diferencia aparece después: si nadie vuelve al tema, la necesidad que dio origen a la charla sigue sin tener respuesta.',past:'¿Recordás una conversación que se retomó después de una pausa? ¿Qué pasó con las que siempre quedaron pendientes?'},
  {image:'el espacio que perdés para decidir',text:'El detalle está en quién conserva la última palabra sobre tu tiempo, tus amistades o tu privacidad. Coordinar un plan es distinto de necesitar autorización.',past:'¿Hubo una salida a la que dejaste de ir para evitar presión? ¿Qué te habría permitido conservar esa elección?'},
  {image:'el costo que empieza a tener un «no»',text:'Si el trato cálido vuelve solo cuando cedés, puede resultar difícil distinguir un acuerdo de una concesión para recuperar cariño.',past:'¿El afecto seguía presente cuando mantenías un límite, o volvía recién cuando cambiabas de idea?'},
  {image:'la emoción que queda sin ser escuchada',text:'Aunque dos personas recuerden una escena de manera distinta, ambas pueden hablar de cómo la vivieron. Si la respuesta es una burla, terminás defendiendo tu derecho a sentir en vez de hablar de lo ocurrido.',past:'¿Pudiste terminar de contar lo que te dolía sin tener que defender tu sensibilidad?'},
  {image:'la parte de la discusión que nadie más asume',text:'Si al señalar algo que te lastimó terminás pidiendo perdón por haberlo mencionado, el hecho inicial puede quedar intacto. Una reparación se reconoce en quién asume su parte y qué hace después.',past:'Después de las disculpas, ¿cambió lo que te había lastimado o solo se terminó la discusión?'}
];
const careRead={
  choice:'En el episodio que elegiste, cambiar tu plan fue algo que querías y podías hacer. Es un detalle valioso: esa vez tu ayuda tuvo margen de elección. Podés usarla como referencia para reconocer cuándo ayudar se siente distinto.',
  guilt:'En el episodio que elegiste, la culpa pesó en la decisión de cambiar tu plan. Tal vez querías acompañar, pero no necesariamente del modo ni durante el tiempo que terminaste ofreciendo.',
  limit:'En el episodio que elegiste pudiste ofrecer ayuda y mantener tu plan. Ahí ya hay un recurso tuyo: encontraste una forma de estar presente sin dejar de lado algo que también te importaba.'
};
const repairRead={
  change:'En el episodio que recordaste hubo un cambio que se sostuvo. Eso aporta un dato a favor de la reparación en esa ocasión. No borra lo que dolió ni garantiza que pase igual con otros temas.',
  repeat:'En el episodio que recordaste hubo una disculpa y después volvió a pasar lo mismo. Podés valorar las palabras y, a la vez, tomar la repetición como información para decidir qué necesitás.',
  unspoken:'Ese episodio quedó sin hablar. No sabemos por qué. Queda abierta una pregunta más concreta: ¿lo que necesitabas encontró lugar de alguna otra manera, o siguió pendiente?',
  early:'Todavía no tuviste ocasión de ver qué pasó después. Lo más honesto es dejar esa parte abierta: una promesa y un cambio que pudiste observar son evidencias distintas.'
};
function hasPartner(s){return s.relationship!=='none'&&!s.skip[3];}
function activeContexts(s){
  const p=s.answers[3],partner=hasPartner(s);
  if(partner&&p[9]===1)return [];
  const keys=[];
  if([1,2].includes(s.answers[2][6]))keys.push('care');
  if(partner&&p.slice(0,6).some(v=>v===1||v===2))keys.push('repair');
  return keys;
}
function contextEvidence(s){
  return activeContexts(s).flatMap(id=>{const opt=contexts[id].options.find(([k])=>k===s.context?.[id]);return opt?[{id,value:opt[0],q:contexts[id].question,label:opt[1]}]:[];});
}
function personalFocus(s){
  const v=s.answers[2],p=s.answers[3],known=v.filter(x=>typeof x==='number').length;
  if(known<3)return {key:'unknown',i:null};
  const relevant=i=>hasPartner(s)&&patterns.some((pat,j)=>pat.self===i&&p[j]===2);
  const order=[6,7,4,1,0,2,3,5].filter(i=>v[i]===1||v[i]===2);
  order.sort((a,b)=>v[b]-v[a]||Number(relevant(b))-Number(relevant(a)));
  return order.length?{key:lens[order[0]].key,i:order[0]}:{key:'steady',i:null};
}
function childhood(s,i){
  const labels=['tu madre o figura materna','tu padre o figura paterna'];
  if(i===null){
    const j=lens.findIndex((_,index)=>labels.some((__,b)=>!s.skip[b]&&s.answers[b][index]===2));
    if(j===-1)return '';
    const who=labels.filter((_,b)=>!s.skip[b]&&s.answers[b][j]===2).join(' y ');
    const now=s.answers[2][j];
    return 'Al pensar en '+who+', recordaste '+lens[j].history+'. '+(now===0?'Hoy no reconocés la dificultad correspondiente en tu vida. Ese contraste también cuenta: tu historia no te obliga a repetir lo que viviste.': 'Ese recuerdo merece un lugar propio. Por sí solo no nos dice cómo te vinculás hoy ni qué trato recibís de otra persona.');
  }
  const figures=labels.filter((_,b)=>!s.skip[b]&&s.answers[b][i]===2);
  if(!figures.length)return '';
  const other=labels.find((_,b)=>!s.skip[b]&&s.answers[b][i]===0);
  return 'Al pensar en '+figures.join(' y ')+', recordaste '+lens[i].history+'. '+(other?'Al responder sobre '+other+', señalaste que eso no te pasaba. ':'')+'La coincidencia con lo que te pasa hoy invita a explorar qué necesitabas entonces; no demuestra de dónde viene lo que sentís ahora.';
}
const positiveScenes=[
 ['tener a alguien que te escucha cuando vos necesitás apoyo','escuchar sin que tengas que devolver el favor de inmediato'],
 ['poder mantener un «no» y seguir con tus actividades','respetar una decisión tuya incluso cuando la otra persona preferiría otra cosa'],
 ['ver que un acuerdo se cumple después de una discusión','volver al tema y hacer algo distinto la vez siguiente']
];
function positiveReading(p,hasCases){
 const yes=[0,1,2].filter(i=>p[6+i]===2),no=[0,1,2].filter(i=>p[6+i]===0),sometimes=[0,1,2].filter(i=>p[6+i]===1);
 if(yes.length===3)return 'También reconocés tres cosas concretas: apoyo cuando lo necesitás, respeto por tus límites y cambios después de un conflicto. '+(hasCases?'Es posible valorar esos momentos y tomar en serio las situaciones que te dolieron. Vale la pena distinguir en qué momentos aparece cada trato.':'Esas experiencias te dan referencias para reconocer el cuidado aun cuando haya diferencias.');
 if(yes.length)return 'Una experiencia que sí reconocés con frecuencia es '+positiveScenes[yes[0]][0]+'. '+(no.length?'En cambio, no reconocés '+positiveScenes[no[0]][0]+'. Una experiencia puede estar presente aunque la otra falte.':sometimes.length?'En otros momentos, '+positiveScenes[sometimes[0]][0]+' aparece solo a veces.':'Lo que no pudiste evaluar queda abierto.');
 if(sometimes.length)return 'Algunas veces reconocés '+positiveScenes[sometimes[0]][0]+'. Recordar qué hicieron ambos en uno de esos momentos puede ayudarte a precisar qué te gustaría que fuera más habitual.';
 if(no.length)return 'Entre las señales que pudiste evaluar, no reconocés '+positiveScenes[no[0]][0]+'. Eso merece atención en esa parte concreta del vínculo; no alcanza para describir toda la relación.';
 return 'No hay observaciones suficientes sobre apoyo, límites o reparación. Las señales sanas de abajo son referencias para mirar, no conclusiones sobre esa persona.';
}
function practiceFor(s,focus,dominant,ctx){
 const item=lens[focus],ex=s.relationship==='ex'&&hasPartner(s);
 if(ex)return {title:'Una pregunta para mirar hacia atrás',text:dominant?shadowRead[dominant.index].past:item?item.past:'Recordá un momento en que te sentiste a gusto. ¿Qué hizo cada uno para que eso fuera posible?',cue:ctx.repair==='change'?'¿Qué cambio de aquella ocasión te gustaría volver a encontrar en un vínculo?':ctx.repair==='repeat'?'Podés tomar la repetición como referencia para el futuro, sin pedir otra explicación a tu expareja.':'Podés responder para vos, sin volver a contactar a esa persona.'};
 if(ctx.repair==='repeat')return {title:'Una diferencia para observar',text:'Volvé a esa disculpa. ¿Se habló de qué iba a cambiar? Si hubo un acuerdo, ¿qué pasó la vez siguiente?',cue:'No hace falta exponerte a otra repetición para tomar en serio la que ya viviste.'};
 if(ctx.repair==='change')return {title:'Un cambio que vale la pena reconocer',text:'¿Qué hizo cada persona de manera distinta después de hablar? Nombrá el gesto o la decisión que te permitió notar el cambio.',cue:'Ese hecho te da una referencia para otros desacuerdos, sin obligarte a pasar por alto lo que todavía duele.'};
 if(ctx.repair==='unspoken')return {title:'Darle nombre a lo pendiente',text:'Completá para vos: «De aquella situación, lo que todavía necesito es…». Puede ser que te escuchen, que respeten un límite o entender qué pasó.',cue:'Podés ordenar lo que necesitás sin tener que iniciar una conversación.'};
 if(ctx.repair==='early')return {title:'Dejar una pregunta abierta',text:'¿Qué hecho te permitiría reconocer el cambio, si llega a ocurrir? Elegí algo que se pueda observar sin vigilar ni poner a prueba a nadie.',cue:'No necesitás decidir hoy si una promesa se cumplió.'};
 if(item){
   const action=ctx.care==='limit'&&focus===6?'¿Qué te permitió sostener tu plan esa vez: disponer de tiempo para decidir, ofrecer otra ayuda o contar con que tu límite sería respetado?':ctx.care==='choice'&&focus===6?'Pensá qué hizo posible ese «sí» que elegiste dar. ¿Contabas con tiempo, ganas y libertad para decir que no?':item.action;
   return {title:'Una pregunta para vos',text:action,cue:hasPartner(s)&&(s.answers[3][9]!==0||dominant?.value===2)?'Podés pensarlo por tu cuenta o con alguien de confianza. No hace falta provocar una situación para comprobarlo.':'Si te sirve ponerlo en palabras con alguien de confianza: «'+item.phrase+'»'};
 }
 if(dominant)return {title:'Una escena para mirar con detalle',text:shadowRead[dominant.index].past,cue:'Tomá como referencia algo que pasó, sin intentar adivinar qué quiso hacer la otra persona.'};
 return {title:'Una pregunta para vos',text:'Pensá en una ocasión en la que pudiste ser vos sin calcular qué respuesta se esperaba. ¿Qué hizo la otra persona que te ayudó a sentirte así?',cue:'Si no te viene un ejemplo, podés dejarlo abierto.'};
}
function composeReport(s){
 const v=s.answers[2],p=s.answers[3],partnerAvailable=hasPartner(s),date=new Date().toLocaleString('es-AR');
 const safety=partnerAvailable&&p[9]===1;
 if(safety)return {key:'safety',title:'Tu seguridad merece un lugar central',lead:'Señalaste amenazas, agresiones, presión sexual o miedo por tu seguridad. Alcanza con que haya ocurrido una vez para que merezca atención y apoyo.',paragraphs:['Los momentos de cariño pueden haber sido importantes para vos. No quitan gravedad a lo que pasó. Nada de lo que respondiste sobre tu infancia, tus emociones o tu forma de poner límites te hace responsable del daño.'],practice:null,avoid:['Sentirte en la obligación de confrontar a la otra persona o de conseguir que admita lo sucedido.'],healthy:['Que tu voluntad, tu intimidad y tu seguridad se respeten también cuando decís que no.'],closing:'Podés buscar apoyo a tu ritmo. No tenés que justificar por qué lo necesitás.',cases:[],safety:true,partnerAvailable,date};
 const {key,i}=personalFocus(s),item=lens[i],ctx=Object.fromEntries(contextEvidence(s).map(x=>[x.id,x.value]));
 const cases=partnerAvailable?patterns.map((pat,index)=>({...pat,index,value:p[index]})).filter(c=>c.value===1||c.value===2).sort((a,b)=>b.value-a.value||Number(b.self===i)-Number(a.self===i)||a.index-b.index):[];
 const pairs=partnerAvailable?[[2,3],[0,5],[1,4]].filter(pair=>pair.every(j=>p[j]===2)):[];
 pairs.sort((a,b)=>Number(b.some(j=>patterns[j].self===i))-Number(a.some(j=>patterns[j].self===i)));
 const pairId=pairs[0]?.[0];
 const dominant=pairId===undefined?cases[0]:cases.find(c=>c.index===pairId),paragraphs=[],known=v.filter(x=>typeof x==='number').length;
 let title,lead;
 if(item){title=item.title;lead=item.lead;if(v[i]===1)lead='Lo describís en ocasiones puntuales. '+lead;}
 else if(key==='steady'){title='Qué te gustaría conservar de tus vínculos';lead='En las situaciones sobre vos que respondiste no reconocés esas dificultades. Una buena forma de aprovechar esta lectura es mirar qué trato querés seguir eligiendo, especialmente cuando hay un desacuerdo.';}
 else{title='Lo que todavía queda por conocer';lead='Hay poca información sobre tu presente para identificar un tema personal con fundamento. Si alguna situación te resultó ajena o difícil de recordar, está bien que quede sin respuesta.';}
 if(!item&&dominant){title='Lo que el trato de esa persona te permite ver';lead=(key==='unknown'?'Sabemos poco sobre cómo te sentís habitualmente. ':'')+'Aun así, podés mirar una conducta de esta relación por lo que ocurrió entre ustedes, sin necesitar una explicación sobre tu personalidad.';}
 if(careRead[ctx.care])paragraphs.push(careRead[ctx.care]);
 if(i===6&&[v[0],v[1],v[7]].some(x=>x===1||x===2)){
   const quiet=[[0,'pedir apoyo para vos'],[1,'contar lo que sentís'],[7,'decir que no']].filter(([n])=>v[n]===1||v[n]===2).map(([,label])=>label);
   const named=quiet.length===1?quiet[0]:quiet.slice(0,-1).join(', ')+' y '+quiet.at(-1);
   paragraphs.push(v[7]===2?'Si además te cuesta decir que no, es posible que la otra persona vea tu ayuda y no vea el esfuerzo que te costó darla. Tu disponibilidad por fuera y lo que podés sostener por dentro no siempre coinciden.':'También señalaste que a veces te cuesta '+named+'. Al terminar de cuidar a alguien, ¿queda lugar para contar cómo estás vos?');
 }else if(i===2&&v[5]>0)paragraphs.push('Si una crítica también cambia cómo te valorás, una diferencia de opinión puede sentirse como si estuviera en juego el cariño. Podés revisar lo que hiciste sin tener que demostrar de nuevo lo que valés.');
 else if(i===3&&partnerAvailable&&p[1]===2)paragraphs.push('En este vínculo además describís conversaciones que quedaron sin retomar. Tu inquietud por la distancia y la falta de respuesta a un tema pendiente son dos cosas distintas; merece atención lo que efectivamente quedó sin hablar.');
 else if(item&&[0,1,7].includes(i)&&v[6]===2)paragraphs.push('También describís que solés hacerte cargo del malestar ajeno. En una misma conversación podrías estar atendiendo lo que el otro necesita y dejando para después lo que ibas a decir.');
 const past=childhood(s,i);if(past)paragraphs.push(past);
 if(partnerAvailable){
   const period=s.relationship==='ex'?'En la relación que recordás':'En tu relación actual';
   if(dominant){
     const pair=pairId===2?'la presión sobre tus decisiones se suma a un cariño que parece depender de que cedas. Podrías terminar cambiando tus planes para conservar la cercanía.':pairId===0?'el peso del cuidado y la responsabilidad por los conflictos parecen quedar de tu lado. Resolver el malestar de ambos podría dejar sin revisar qué le toca hacer a la otra persona.':pairId===1?'cuando un tema queda sin hablar y además hay burlas al expresar lo que sentís, puede costar incluso decidir si vale la pena volver a mencionarlo.':'';
     const intro=dominant.value===1?'Aparece en algún episodio; por sí solo no alcanza para llamarlo habitual. ':'Lo describís como algo que se repite. ';
     paragraphs.push(pair?period+', '+pair+' Como posible «sombra», mirá '+shadowRead[dominant.index].image+'.':period+', la posible «sombra» está en '+shadowRead[dominant.index].image+'. '+intro+shadowRead[dominant.index].text);
   }else paragraphs.push(p.slice(0,6).some(x=>x===0)?'De las conductas difíciles sobre las que pudiste responder, no reconocés ninguna. Esto deja espacio para mirar qué funciona y qué sigue sin conocerse.':'Faltan observaciones sobre las conductas difíciles de ese vínculo. No se puede deducir una «sombra» a partir de tu crianza o de tus respuestas personales.');
   if(repairRead[ctx.repair])paragraphs.push(repairRead[ctx.repair]);
   paragraphs.push(positiveReading(p,Boolean(dominant)));
   if(typeof p[9]!=='number')paragraphs.push('La pregunta sobre seguridad quedó abierta. Los demás datos no permiten dar esa parte por resuelta.');
 }else if(!item&&known<3&&!past){paragraphs.push('Un recuerdo de crianza puede ser importante sin explicar cómo te vinculás hoy. Si querés volver sobre este ejercicio, alcanza con empezar por una escena de tu presente.');}
 const avoid=[],healthy=[];
 if(dominant){avoid.push(dominant.avoid);healthy.push(dominant.healthy);}
 if(item&&i!==dominant?.self){avoid.push(dimensions[i].avoid);healthy.push(dimensions[i].healthy);}
 if(ctx.repair==='repeat')avoid.push('Dar un problema por resuelto solo porque hubo una disculpa.');
 if(!avoid.length)avoid.push('Sacar una conclusión sobre todo un vínculo a partir de un único momento.');
 if(!healthy.length)healthy.push('Podés pedir ayuda, disentir y conservar actividades propias sin tener que compensarlo después.');
 if(healthy.length<2){const pos=partnerAvailable?[0,1,2].find(k=>p[6+k]===2):undefined;healthy.push(pos===undefined?'Después de una diferencia, ambos pueden reconocer qué pasó y cumplir lo que acordaron.':'Una señal que ya reconocés: '+positiveScenes[pos][0]+'.');}
 const closing=s.relationship==='ex'&&partnerAvailable?'Podés llevarte este criterio a un vínculo futuro sin retomar el contacto con tu expareja.':key==='care'?'Podés ser alguien con quien contar y también alguien que cuenta con los demás.':key==='unknown'?'Lo que todavía no sabés también puede quedar abierto.':'Quedate con el ejemplo que mejor describe tu experiencia. Es el mejor punto de partida para pensar qué querés cuidar.';
 return {key,title,lead,paragraphs,practice:practiceFor(s,i,dominant,ctx),avoid:[...new Set(avoid)],healthy:[...new Set(healthy)],closing,cases,safety:false,partnerAvailable,date};
}
