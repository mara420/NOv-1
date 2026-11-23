/* Scene choreography adapted from NOv-1/TScene.vue, Prismic (Apache-2.0).
 * Modified: native scroll control, custom garden modes, complete motion pause,
 * mobile composition and locally prepared email instead of commerce. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let motionEnabled = !reduced.matches;
  let manualMode = null;
  let manualSection = null;
  let activeMode = 'intro';
  let raf = 0;
  let sceneReady = false;
  let lastRotation = 0;
  const shell = $('.scene-shell');
  const controls = $('.scene-controls');
  const sections = $$('.scene-section');
  const copy = {intro:'Živý prostor. Promyšlený do detailu.',water:'Voda přesně tam, kde má být.',life:'Zelený základ každého dne.',light:'Atmosféra, která pokračuje po setmění.'};

  function syncMotion() {
    const button = $('#motion-toggle');
    button.disabled = reduced.matches;
    button.setAttribute('aria-pressed', String(!motionEnabled));
    button.setAttribute('aria-label', reduced.matches ? 'Animace jsou omezené nastavením zařízení' : motionEnabled ? 'Pozastavit animace' : 'Spustit animace');
    button.innerHTML = motionEnabled ? '<span class="pause-bars" aria-hidden="true"></span>' : '<span class="play-mark" aria-hidden="true"></span>';
    document.body.classList.toggle('motion-paused', !motionEnabled);
    window.gardenScene?.setMotion(motionEnabled);
    requestUpdate();
  }
  function syncMode(mode) {
    const display = mode === 'intro' ? 'water' : mode;
    activeMode = mode;
    $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === display)));
    $('#scene-caption').textContent = copy[mode] || copy.intro;
  }
  function update() {
    raf = 0;
    const height = innerHeight;
    const mobile = innerWidth <= 780;
    const position = mobile ? height * .27 : height * .5;
    let active = sections[0];
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= position && rect.bottom > position) { active = section; break; }
      if (rect.top <= position) active = section;
    }
    if (manualSection && manualSection !== active) { manualMode = null; manualSection = null; }
    let mode = manualMode || active.dataset.sceneModel || 'light';
    const rect = active.getBoundingClientRect();
    const progress = clamp((height*.5 - rect.top) / (rect.height + height*.15));
    let visibility = active.dataset.scenePosition === 'top' ? 0 : 1;
    // The wide pictures take over the stage as in the source template.
    if (!mobile && visibility) {
      const next = active.nextElementSibling;
      if (next?.dataset.scenePosition === 'top') visibility = clamp((next.getBoundingClientRect().top - height*.2) / (height*.55));
    }
    shell.style.opacity = visibility;
    const copyTop = active.querySelector('.bounded')?.getBoundingClientRect().top ?? -Infinity;
    const controlVisible = visibility > .55 && (!mobile || copyTop > 72 + height * .40);
    controls.classList.toggle('is-hidden', !controlVisible);
    controls.inert = !controlVisible;
    controls.setAttribute('aria-hidden', String(!controlVisible));
    if (motionEnabled) lastRotation = active.dataset.sceneRotate ? progress * Math.PI * 2 : 0;
    const rotation = lastRotation;
    window.gardenScene?.setState({mode,rotation,visibility});
    if (activeMode !== mode) syncMode(mode);
    document.body.classList.toggle('scrolled', scrollY > 20);
    $$('.desktop-nav a[href^="#"]').forEach(a => {
      if (a.getAttribute('href') === '#'+active.id) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current');
    });
  }
  function requestUpdate(){if(!raf) raf=requestAnimationFrame(update);}
  addEventListener('scroll',requestUpdate,{passive:true});
  addEventListener('resize',requestUpdate,{passive:true});
  addEventListener('garden-ready',()=>{sceneReady=true;syncMotion();requestUpdate();});
  reduced.addEventListener('change',e=>{motionEnabled=!e.matches;syncMotion();});
  $('#motion-toggle').addEventListener('click',()=>{motionEnabled=!motionEnabled;syncMotion();});
  $$('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    manualMode=button.dataset.mode;
    manualSection=sections.find(s=>{const r=s.getBoundingClientRect();const p=innerHeight*(innerWidth<=780?.27:.5);return r.top<=p&&r.bottom>p;}) || sections[0];
    syncMode(manualMode);requestUpdate();
  }));

  const observer = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}}),{threshold:.08});
  $$('.reveal').forEach(el=>observer.observe(el));
  document.body.classList.add('js-ready');
  syncMotion();update();
  // Keep the photograph fallback if WebGL is unavailable. The rest of the site remains usable.
  const fallbackTimer=setTimeout(()=>{if(!sceneReady){$('#scene-stage').dataset.error='true';controls.hidden=true;}},12000);
  addEventListener('garden-ready',()=>{clearTimeout(fallbackTimer);controls.hidden=false;},{once:true});

  const menuButton=$('.menu-toggle');
  const mobileMenu=$('#mobile-menu');
  function setMenu(open){menuButton.setAttribute('aria-expanded',String(open));mobileMenu.hidden=!open;document.body.classList.toggle('menu-open',open);$('main').inert=open;$('.site-footer').inert=open;controls.inert=open||controls.classList.contains('is-hidden');if(!open)requestUpdate();}
  menuButton.addEventListener('click',()=>setMenu(menuButton.getAttribute('aria-expanded')!=='true'));
  $$('#mobile-menu a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobileMenu.hidden){setMenu(false);menuButton.focus();}});
  mobileMenu.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=[menuButton,...mobileMenu.querySelectorAll('a')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  menuButton.addEventListener('keydown',e=>{if(e.key==='Tab'&&e.shiftKey&&!mobileMenu.hidden){e.preventDefault();mobileMenu.querySelector('a:last-child').focus();}});
  matchMedia('(max-width:780px)').addEventListener('change',e=>{if(!e.matches)setMenu(false);});

  function invalidateDraft(){ $('#form-result').hidden=true; }
  $('#contact-form').addEventListener('input',invalidateDraft);
  $$('[data-service]').forEach(a=>a.addEventListener('click',()=>{
    $$('input[name=service]').forEach(i=>{if(i.value===a.dataset.service)i.checked=true;});
    invalidateDraft();
  }));
  let draftText='';
  $('#contact-form').addEventListener('submit',event=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const services=data.getAll('service').join(', ') || 'Rád/a bych se poradil/a';
    const name=String(data.get('name')||'').trim();
    const email=String(data.get('email')||'').trim();
    const place=String(data.get('location')||'').trim();
    const message=String(data.get('message')||'').trim();
    if(!name||!email||!message)return;
    draftText=`Dobrý den,\n\nrád/a bych s vámi probral/a svou zahradu.\n\nZájem: ${services}\nMísto: ${place||'Upřesním při domluvě'}\n\n${message}\n\n${name}\n${email}`;
    $('#message-preview').textContent=draftText;
    $('#email-draft').href=`mailto:info@zafis.cz?subject=${encodeURIComponent('Poptávka Zafis — '+services)}&body=${encodeURIComponent(draftText)}`;
    $('#form-result').hidden=false;
    $('#copy-status').textContent='';
    $('#form-result').focus({preventScroll:true});
    $('#form-result').scrollIntoView({behavior:motionEnabled?'smooth':'auto',block:'center'});
  });
  $('#copy-message').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(draftText);$('#copy-status').textContent='Text je zkopírovaný. Vložte jej do zprávy na info@zafis.cz.';}
    catch{$('#copy-status').textContent='Automatické kopírování není dostupné. Označte a zkopírujte text zprávy výše.';const r=document.createRange();r.selectNodeContents($('#message-preview'));const s=getSelection();s.removeAllRanges();s.addRange(r);}
  });
  $('#year').textContent=new Date().getFullYear();
})();
