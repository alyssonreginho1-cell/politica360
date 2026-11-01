var P360Listen=(function(){
  var synth=window.speechSynthesis,supported=!!synth&&typeof window.SpeechSynthesisUtterance!=='undefined';
  var chunks=[],idx=0,state='idle',rate=1,token=0,ui=null,marked=null;
  var MES={jan:'janeiro',fev:'fevereiro',mar:'março',abr:'abril',mai:'maio',jun:'junho',jul:'julho',ago:'agosto',set:'setembro',out:'outubro',nov:'novembro',dez:'dezembro'};
  function clean(t){
    return String(t)
      .replace(/R\$\s*(\d+(?:[.,]\d+)*)(?:\s+(trilhões|trilhão|bilhões|bilhão|milhões|milhão|mil)\b)?/gi,function(m,n,u){return u?n+' '+u+' de reais':n+' reais';})
      .replace(/(\d)\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi,function(m,d,mes){return d+' de '+MES[mes.toLowerCase()];})
      .replace(/(\d)\s*–\s*(\d)/g,'$1 a $2')
      .replace(/[−]\s*(?=\d)/g,'menos ').replace(/\+\s*(?=\d)/g,'mais ')
      .replace(/%/g,' por cento').replace(/\s\/\s/g,', ').replace(/\s*·\s*/g,', ').replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
  }
  function pieces(t){
    var s=clean(t).replace(/(\d)\.(\d)/g,'$1\u00a7$2');
    var parts=s.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g)||[s],out=[],cur='';
    parts.forEach(function(x){ if(cur&&(cur+x).length>180){out.push(cur.trim());cur=x;}else cur+=x; });
    if(cur.trim())out.push(cur.trim());
    return out.map(function(x){return x.replace(/\u00a7/g,'.');});
  }
  function pickVoice(){
    var v=(synth.getVoices&&synth.getVoices())||[];
    var pt=v.filter(function(x){return /^pt[-_]BR/i.test(x.lang);});
    if(!pt.length)pt=v.filter(function(x){return /^pt/i.test(x.lang);});
    if(!pt.length)return null;
    var pref=pt.filter(function(x){return /natural|online|google|luciana|francisca|antonio|thalita/i.test(x.name);});
    return pref[0]||pt[0];
  }
  function mark(el){
    if(marked&&marked!==el)marked.classList.remove('reading');
    marked=el||null;
    if(el){el.classList.add('reading');
      try{var r=el.getBoundingClientRect();if(r.top<60||r.bottom>(window.innerHeight||800)-40)el.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}}
  }
  function paint(){
    if(!ui)return;
    ui.play.querySelector('span').textContent=state==='playing'?'Pausar':(state==='paused'?'Continuar':'Ouvir notícia');
    ui.play.setAttribute('aria-pressed',state==='playing'?'true':'false');
    ui.stop.hidden=(state==='idle');
  }
  function note(t){if(ui)ui.note.textContent=t||'';}
  function speak(i){
    if(i>=chunks.length){finish();return;}
    idx=i;mark(chunks[i].el);
    var u=new SpeechSynthesisUtterance(chunks[i].text),v=pickVoice(),my=token;
    u.lang='pt-BR';u.rate=rate;if(v){u.voice=v;u.lang=v.lang;}
    u.onend=function(){if(state==='playing'&&my===token)speak(i+1);};
    u.onerror=function(e){if(state==='playing'&&my===token&&e&&e.error!=='interrupted'&&e.error!=='canceled')speak(i+1);};
    synth.speak(u);
  }
  function restart(){
    var my=++token;try{synth.cancel();}catch(e){}
    setTimeout(function(){if(state==='playing'&&my===token)speak(idx);},60);
  }
  function finish(){state='idle';idx=0;mark(null);paint();note('Leitura concluída.');}
  function stop(){token++;state='idle';idx=0;try{if(synth)synth.cancel();}catch(e){}mark(null);paint();note('');}
  function toggle(){
    if(state==='playing'){token++;state='paused';try{synth.cancel();}catch(e){}paint();note('');}
    else{state='playing';note('');
      var v=synth.getVoices&&synth.getVoices();
      if(v&&v.length&&!pickVoice())note('Seu aparelho pode não ter voz em português.');
      paint();restart();}
  }
  function mount(o){
    stop();ui=null;
    if(!supported||!o||!o.before)return;
    var old=document.querySelector('.listen-bar');if(old&&old.parentNode)old.parentNode.removeChild(old);
    chunks=[];
    if(o.title)pieces(o.title.textContent).forEach(function(t){chunks.push({text:t,el:o.title});});
    if(o.intro)pieces(o.intro).forEach(function(t){chunks.push({text:t,el:null});});
    Array.prototype.forEach.call(o.paras||[],function(p){pieces(p.textContent).forEach(function(t){chunks.push({text:t,el:p});});});
    var bar=document.createElement('div');bar.className='listen-bar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Leitura da notícia em voz alta');
    bar.innerHTML='<button type="button" class="ls-btn ls-play" aria-pressed="false"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg><span>Ouvir notícia</span></button><button type="button" class="ls-btn ls-stop" hidden>Parar</button><label class="ls-speed">Velocidade <select aria-label="Velocidade da leitura"><option value="0.85">0,85x</option><option value="1" selected>1x</option><option value="1.25">1,25x</option><option value="1.5">1,5x</option></select></label><span class="ls-note" aria-live="polite"></span>';
    o.before.parentNode.insertBefore(bar,o.before);
    ui={play:bar.querySelector('.ls-play'),stop:bar.querySelector('.ls-stop'),sel:bar.querySelector('select'),note:bar.querySelector('.ls-note')};
    rate=1;
    ui.play.addEventListener('click',toggle);
    ui.stop.addEventListener('click',stop);
    ui.sel.addEventListener('change',function(){rate=parseFloat(ui.sel.value)||1;if(state==='playing')restart();});
    paint();
  }
  function mountStatic(){
    var t=document.querySelector('main h1'),b=document.querySelector('.article-body'),m=document.querySelector('.meta');
    if(!t||!b)return;
    mount({before:b,title:t,intro:m?('Fonte: '+m.textContent):'',paras:b.querySelectorAll('p')});
  }
  window.addEventListener('pagehide',stop);
  return {mount:mount,mountStatic:mountStatic,stop:stop,supported:supported,_clean:clean,_pieces:pieces,_state:function(){return {state:state,idx:idx,n:chunks.length};}};
})();
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',P360Listen.mountStatic);}else{P360Listen.mountStatic();}
