// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/webcleaner
// @version      8.2.4
// @updateURL    https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js
// @downloadURL  https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==
(function () {
  "use strict";

  const HOST  = location.hostname;
  const isFB  = /^(www\.|web\.|m\.)?facebook\.com$/.test(HOST);
  const isYT  = /^(www\.|m\.)?youtube\.com$|^music\.youtube\.com$/.test(HOST);

  const FOCUS = "facebook.com youtube.com instagram.com tiktok.com x.com twitter.com reddit.com snapchat.com threads.net pinterest.com tumblr.com linkedin.com twitch.tv netflix.com hulu.com dailymotion.com news.ycombinator.com cnn.com bbc.com dailymail.co.uk foxnews.com buzzfeed.com 9gag.com imgur.com boredpanda.com amazon.com ebay.com aliexpress.com temu.com shein.com".split(" ");
  const ADULT = "pornhub.com xvideos.com xnxx.com xhamster.com redtube.com youporn.com spankbang.com onlyfans.com chaturbate.com stripchat.com".split(" ");
  const ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  const BOUNDS = {
    snoozeMinutes:[1,1440], desktopWidth:[320,7680], mobileWidth:[240,1080],
    mobileHeight:[400,2400], mobileDpr:[0.5,5], longPressMs:[100,5000],
    feedMaxWidth:[500,3000],
  };

  const DEF = {
    facebook: {
      enabled:true, hideSponsored:true, hideSuggested:true, hidePeopleYouMayKnow:true,
      hideReelsTrays:true, hideComments:false, hideVideoAutoplay:true, hideLikeCounts:false,
      stripTracking:true, showToggleButton:true, hideRightSidebar:true, hideLeftSidebar:true,
      hideComposer:true, hideTopBar:true, skipReelsAds:true, forceMostRecent:true,
      widenFeed:true, feedMaxWidth:1100,
      extraJunkPhrases:[],
      toggleHotkey:{ctrl:false,alt:true,shift:true,key:"f"},
    },
    youtube: {
      enabled:true, skipVideoAds:true, skipShortsAds:true, hideFeedAds:true,
      hideBanners:true, muteAds:true, dismissAntiAdblock:true, hideShorts:false,
      hideEndCards:true, hideInfoCards:true, hideAutoplay:false,
      hideRelated:true, hideComments:false, hideChips:true, hideMerch:true,
      hideLiveChat:false, widenPlayer:true,
      showToggleButton:true,
      toggleHotkey:{ctrl:false,alt:true,shift:true,key:"y"},
    },
    siteBlocker: {
      enabled:true, blockAdult:true, blockFocus:false, scheduleOn:false, snoozeMinutes:5,
      schedule:{days:[1,2,3,4,5],from:"09:00",to:"18:00"},
      custom:[], allow:[],
      toggleHotkey:{ctrl:false,alt:true,shift:true,key:"b"},
    },
    viewMode: {
      newSiteDefault:"auto", showButton:true, spoofUA:true, spoofTouch:true,
      spoofMedia:true, frameOnDesktop:false, longPressMs:500,
      desktopWidth:1280, mobileWidth:412, mobileHeight:915, mobileDpr:2.625,
      mobileUA:"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      desktopUA:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      toggleHotkey:{ctrl:false,alt:true,shift:true,key:"v"},
    },
  };

  const PFX  = "wc7_";
  const gmOk = typeof GM_getValue==="function" && typeof GM_setValue==="function";
  const gGet = (k,d) => { if(gmOk)try{const v=GM_getValue(PFX+k,"__M__");if(v!=="__M__")return v;}catch(_){} try{const r=localStorage.getItem(PFX+k);return r===null?d:JSON.parse(r);}catch(_){return d;} };
  const gSet = (k,v) => { if(gmOk)try{GM_setValue(PFX+k,v);}catch(_){} try{localStorage.setItem(PFX+k,JSON.stringify(v));}catch(_){} };

  function deepMerge(d,o) {
    const r=JSON.parse(JSON.stringify(d));
    if(!o||typeof o!=="object"||Array.isArray(o)) return r;
    for(const k of Object.keys(o)){
      if(k==="__proto__"||k==="constructor"||k==="prototype")continue;
      if(!(k in r))continue;
      const dv=r[k],ov=o[k];
      if(Array.isArray(dv)){ if(Array.isArray(ov))r[k]=ov.filter(x=>typeof x==="string"||typeof x==="number"); continue; }
      if(dv!==null&&typeof dv==="object"){ if(ov!==null&&typeof ov==="object"&&!Array.isArray(ov))r[k]=deepMerge(dv,ov); continue; }
      if(typeof ov===typeof dv)r[k]=ov;
    }
    return r;
  }

  const C={};
  for(const m of Object.keys(DEF)) C[m]=deepMerge(DEF[m],gGet(m,null));
  const save=(m)=>gSet(m,C[m]);

  function exportSettings() {
    const data=JSON.stringify(C,null,2);
    let url,revoke=false;
    try{ url=URL.createObjectURL(new Blob([data],{type:"application/json"})); revoke=true; }
    catch(_){ url="data:application/json;charset=utf-8,"+encodeURIComponent(data); }
    const a=document.createElement("a");
    a.href=url; a.download="webcleaner-settings.json"; a.style.display="none";
    (document.body||document.documentElement).appendChild(a);
    a.click();
    setTimeout(()=>{try{a.remove();if(revoke)URL.revokeObjectURL(url);}catch(_){}} ,1000);
  }

  function importSettings(json) {
    try {
      const data=JSON.parse(json);
      for(const m of Object.keys(DEF)) {
        if(data[m]) { C[m]=deepMerge(DEF[m],data[m]); save(m); }
      }
      location.reload();
    } catch(_) { alert("Invalid settings file"); }
  }

  function resetSettings() {
    for(const m of Object.keys(DEF)) { Object.assign(C[m],JSON.parse(JSON.stringify(DEF[m]))); save(m); }
    location.reload();
  }

  const clamp   = (v,a,b)=>Math.max(a,Math.min(b,v));
  const bare    = ()=>location.hostname.replace(/^www\./,"");
  const norm    = (s)=>String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}]/gu,"");
  const ESC     = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":'&#39;'};
  const esc     = (s)=>String(s).replace(/[&<>"']/g,c=>ESC[c]);
  const q       = (sel,r)=>(r||document).querySelector(sel);
  const qa      = (sel,r)=>Array.from((r||document).querySelectorAll(sel));
  const onReady = (fn)=>document.body?fn():document.addEventListener("DOMContentLoaded",fn);

  const mk=(tag,attrs={},text)=>{
    const e=document.createElement(tag);
    for(const k of Object.keys(attrs)) k==="style"?(e.style.cssText=attrs[k]):e.setAttribute(k,attrs[k]);
    if(text!=null) e.textContent=text;
    return e;
  };

  const addStyle=(id,css,root)=>{
    const p=root||document.head||document.documentElement;
    if(root?root.querySelector?.(`#${id}`):document.getElementById(id)) return;
    const s=mk("style",{id}); s.textContent=css; p.appendChild(s);
  };

  const safeHTML=((pol=null)=>{
    if(typeof trustedTypes!=="undefined") try{pol=trustedTypes.createPolicy("wc7",{createHTML:s=>s});}catch(_){}
    return(el,html)=>{
      try{ el.innerHTML=pol?pol.createHTML(html):html; return true; }
      catch(_){
        try{
          const doc=new DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`,"text/html");
          el.textContent="";
          for(const n of [...doc.head.childNodes,...doc.body.childNodes]) el.appendChild(document.adoptNode(n));
          return true;
        }catch(_2){ return false; }
      }
    };
  })();

  function cleanHost(raw){
    try{const s=String(raw).trim();return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s)?s:"https://"+s).hostname.replace(/^www\./,"").toLowerCase();}
    catch(_){return String(raw).trim().replace(/^[a-z]+:\/\//i,"").replace(/[/:?#].*$/,"").replace(/^www\./,"").toLowerCase();}
  }

  const _hotkeys=[];
  window.addEventListener("keydown",e=>{
    if(e.metaKey) return;
    const t=e.target;
    if(t?.isContentEditable||/^(input|textarea|select)$/i.test(t?.tagName||"")) return;
    for(const [gs,h] of _hotkeys){
      const k=gs();
      if(e.ctrlKey!==!!k.ctrl||e.altKey!==!!k.alt||e.shiftKey!==!!k.shift) continue;
      if((e.key||"").toLowerCase()!==String(k.key||"").toLowerCase()) continue;
      e.preventDefault(); h(); break;
    }
  },true);
  const onHotkey=(gs,h)=>_hotkeys.push([gs,h]);

  let _navWrapped=false;
  const _navCbs=[];
  function interceptNav(cb){ _navCbs.push(cb); if(_navWrapped) return; _navWrapped=true; const fire=()=>_navCbs.forEach(fn=>{try{fn();}catch(_){}}); const w=orig=>function(...a){const r=orig.apply(this,a);fire();return r;}; try{history.pushState=w(history.pushState);}catch(_){} try{history.replaceState=w(history.replaceState);}catch(_){} window.addEventListener("popstate",fire); }

  const defProp=(obj,key,get)=>{try{Object.defineProperty(obj,key,{configurable:true,get});}catch(_){}};

  const SPON_LABELS=new Set(["sponsored","promoted","gesponsert","publicidad","patrocinado","publicité","anuncio","реклама","広告","광고","赞助","贊助"]);
  const Health={miss:0,at:0};
  const healthArmed=()=>(isFB&&C.facebook.enabled&&C.facebook.hideSponsored)||(isYT&&C.youtube.enabled&&C.youtube.hideFeedAds);

  function healthScan(){
    if(!healthArmed()){Health.miss=0;Health.at=Date.now();return 0;}
    const vh=document.documentElement.clientHeight||600;
    let miss=0;
    for(const el of document.querySelectorAll("badge-shape,span,div,p,h3,h4")){
      if(el.children.length)continue;
      const txt=(el.textContent||"").trim().toLowerCase();
      if(!SPON_LABELS.has(txt))continue;
      const r=el.getBoundingClientRect();
      if(r.width>0&&r.height>0&&r.bottom>0&&r.top<vh)miss++;
      if(miss>50)break;
    }
    Health.miss=miss;Health.at=Date.now();
    return miss;
  }

  const REAL_MOBILE=(()=>{
    const ua=navigator.userAgent,tp=navigator.maxTouchPoints;
    return /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)||/iPad/.test(ua)||(/Macintosh/.test(ua)&&tp>1)||(navigator.userAgentData?.mobile===true);
  })();

  function applyVMSpoof(){
    const v=C.viewMode;
    const stored=(()=>{try{return localStorage.getItem(PFX+"vm")||"";}catch(_){return"";}})();
    const mode=stored||v.newSiteDefault;
    if(mode==="auto") return;
    const tm=mode==="mobile";
    if(v.spoofUA){
      const ua=tm?v.mobileUA:v.desktopUA;
      defProp(navigator,"userAgent",()=>ua); defProp(navigator,"appVersion",()=>ua.replace(/^Mozilla\//,""));
      defProp(navigator,"platform",()=>tm?"Linux armv8l":"Win32"); defProp(navigator,"vendor",()=>"Google Inc.");
      try{const br=navigator.userAgentData?.brands??[];defProp(navigator,"userAgentData",()=>({mobile:tm,platform:tm?"Android":"Windows",brands:br,getHighEntropyValues:()=>Promise.resolve({mobile:tm,platform:tm?"Android":"Windows"}),toJSON:()=>({mobile:tm,platform:tm?"Android":"Windows",brands:br})}));}catch(_){}
    }
    if(v.spoofTouch){defProp(navigator,"maxTouchPoints",()=>tm?5:0);try{if(tm&&!("ontouchstart" in window))window.ontouchstart=null;}catch(_){}}
    if(v.spoofMedia){
      const ew=tm?v.mobileWidth:v.desktopWidth,nat=window.matchMedia?.bind(window)??null;
      window.matchMedia=query=>{const s=String(query).toLowerCase();let r=null;const f=val=>{if(r!==false)r=val;};let m;if((m=s.match(/min-width:\s*([\d.]+)px/)))f(ew>=parseFloat(m[1]));if((m=s.match(/max-width:\s*([\d.]+)px/)))f(ew<=parseFloat(m[1]));if(s.includes("pointer: coarse")||s.includes("any-pointer: coarse"))f(tm);if(s.includes("pointer: fine")||s.includes("any-pointer: fine"))f(!tm);if(s.includes("hover: none"))f(tm);if(s.includes("hover: hover"))f(!tm);if(r===null&&nat)return nat(query);return{matches:!!r,media:String(query),onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false;}};};
      if(tm&&!REAL_MOBILE&&v.frameOnDesktop){defProp(window,"innerWidth",()=>v.mobileWidth);defProp(window,"innerHeight",()=>v.mobileHeight);defProp(screen,"width",()=>v.mobileWidth);defProp(screen,"height",()=>v.mobileHeight);defProp(screen,"availWidth",()=>v.mobileWidth);defProp(screen,"availHeight",()=>v.mobileHeight);defProp(window,"devicePixelRatio",()=>v.mobileDpr);}
    }
  }
  applyVMSpoof();

  const sbMatch  =list=>{if(!Array.isArray(list))return false;const h=bare();return list.some(d=>typeof d==="string"&&d&&(h===d||h.endsWith("."+d)));};
  const sbSnoozed=()=>Date.now()<(gGet("snz",0));
  const sbSnooze =m=>gSet("snz",Date.now()+m*60000);

  const hhmm=(s,dflt)=>{
    const m=/^(\d{1,2}):(\d{2})$/.exec(String(s||"").trim());
    if(!m)return dflt;
    const h=+m[1],mi=+m[2];
    return h>23||mi>59?dflt:h*60+mi;
  };

  function sbInSchedule(){
    const{scheduleOn,schedule:sc}=C.siteBlocker;
    if(!scheduleOn||!sc||!Array.isArray(sc.days)||!sc.days.includes(new Date().getDay()))return false;
    const now=new Date(),cur=now.getHours()*60+now.getMinutes();
    const from=hhmm(sc.from,null),to=hhmm(sc.to,null);
    if(from===null||to===null||from===to)return false;
    return from<to?cur>=from&&cur<to:cur>=from||cur<to;
  }

  function blockReason(){
    const s=C.siteBlocker;
    if(!s.enabled||sbSnoozed()) return null;
    if(sbMatch(s.allow)) return null;
    if(sbMatch(s.custom)) return "on your block list";
    if(s.blockAdult&&(sbMatch(ADULT)||ADULT_RE.test(bare()))) return "blocked by adult filter";
    if((s.blockFocus||sbInSchedule())&&sbMatch(FOCUS)) return s.blockFocus?"blocked by focus filter":"blocked during focus hours";
    return null;
  }

  function applyEdit(mod,mutate,affects){
    const before=affects==="block"?!!blockReason():null;
    mutate(); save(mod);
    (affects==="block"?before!==!!blockReason():!!affects)?location.reload():Panel.refresh();
  }

  const vmMode  =(()=>{try{return localStorage.getItem(PFX+"vm")||"";}catch(_){return"";}})()|| C.viewMode.newSiteDefault;
  const vmActive=()=>vmMode!=="auto";
  const setVM   =m=>{try{localStorage.setItem(PFX+"vm",m);}catch(_){}location.reload();};

  function initVM(){
    const v=C.viewMode,useFrame=vmMode==="mobile"&&!REAL_MOBILE&&v.frameOnDesktop;
    let vpLocked=false;
    function applyVP(){if(vmMode==="auto"||vpLocked)return;vpLocked=true;qa('meta[name="viewport"]').forEach(e=>{if(!e.hasAttribute("data-wc"))e.remove();});let m=q('meta[name="viewport"][data-wc]');if(!m){m=mk("meta",{name:"viewport","data-wc":"1"});(document.head||document.documentElement).appendChild(m);}m.setAttribute("content",vmMode==="desktop"?`width=${v.desktopWidth}`:"width=device-width,initial-scale=1,viewport-fit=cover");vpLocked=false;}
    function applyFrame(){if(!useFrame)return;addStyle("vm-frame",`html.vm-f{background:#202124!important;overflow-x:hidden!important}html.vm-f>body{width:${v.mobileWidth}px!important;min-width:${v.mobileWidth}px!important;max-width:${v.mobileWidth}px!important;margin:0 auto!important;min-height:100vh!important;overflow-x:hidden!important;box-shadow:0 0 0 100vmax #202124,0 0 40px rgba(0,0,0,.6)!important}`);document.documentElement.classList.add("vm-f");}
    applyVP();
    if(vmMode!=="auto"){new MutationObserver(()=>{if(!vpLocked)applyVP();}).observe(document.head||document.documentElement,{childList:true,subtree:true});document.addEventListener("DOMContentLoaded",()=>{applyVP();applyFrame();});[200,600,1500,3500].forEach(t=>setTimeout(()=>{applyVP();applyFrame();},t));}
    onHotkey(()=>v.toggleHotkey,()=>setVM(vmMode==="desktop"?"mobile":"desktop"));
  }

  const keyLabel=h=>(h.ctrl?"Ctrl+":"")+(h.alt?"Alt+":"")+(h.shift?"Shift+":"")+String(h.key||"").toUpperCase();
  const sw   =(l,m,k)=>`<div class="r"><span>${esc(l)}</span><label class="sw"><input type="checkbox" data-sw="${m}.${k}"${C[m][k]?" checked":""}><span class="tk"></span></label></div>`;
  const sw2  =(l1,m1,k1,l2,m2,k2)=>`<div class="r2"><span>${esc(l1)}</span><label class="sw"><input type="checkbox" data-sw="${m1}.${k1}"${C[m1][k1]?" checked":""}><span class="tk"></span></label><span style="margin-left:auto">${esc(l2)}</span><label class="sw"><input type="checkbox" data-sw="${m2}.${k2}"${C[m2][k2]?" checked":""}><span class="tk"></span></label></div>`;
  const num2 =(l1,m1,k1,l2,m2,k2)=>`<div class="r2"><span>${esc(l1)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m1}.${k1}" value="${esc(C[m1][k1])}"><span style="margin-left:auto">${esc(l2)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m2}.${k2}" value="${esc(C[m2][k2])}"></div>`;
  const time2=(l1,m,k1,l2,k2)=>`<div class="r2"><span>${esc(l1)}</span><input class="tm" type="time" data-time="${m}.${k1}" value="${esc(C[m].schedule[k1])}"><span style="margin-left:auto">${esc(l2)}</span><input class="tm" type="time" data-time="${m}.${k2}" value="${esc(C[m].schedule[k2])}"></div>`;
  const numR =(l,m,k)=>`<div class="r"><span>${esc(l)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m}.${k}" value="${esc(C[m][k])}"></div>`;
  const txtR =(l,m,k)=>`<div class="fr"><span style="font-size:11px;color:#888">${esc(l)}</span><input class="tx" type="text" autocorrect="off" autocapitalize="none" data-txt="${m}.${k}" value="${esc(C[m][k])}"></div>`;
  const hkR  =m=>`<div class="r"><span>Shortcut</span><button class="hk" data-hk="${m}">${esc(keyLabel(C[m].toggleHotkey))}</button></div>`;
  const swG  =(mod,pairs)=>`<div class="gr">${pairs.map(([l,k])=>sw(l,mod,k)).join("")}</div>`;

  function listBlock(label,mod,key,ph){
    const arr=C[mod][key],path=`${mod}.${key}`;
    const items=arr.length?arr.map(d=>`<div class="it"><span title="${esc(d)}">${esc(d)}</span><button class="dl" data-dl="${path}" data-v="${esc(d)}">✕</button></div>`).join(""):`<div class="em">Empty</div>`;
    return `<div class="sc"><h2>${esc(label)}</h2>${items}<div class="ad"><input type="text" autocorrect="off" autocapitalize="none" data-ai="${path}" placeholder="${esc(ph)}"><button data-ab="${path}">+</button></div></div>`;
  }

  function packHtml(sites){
    return `<div class="pg">${sites.map(d=>{const on=C.siteBlocker.allow.includes(d);return`<button class="pl ${on?"al":"bl"}" data-pk="${esc(d)}">${esc(d)}</button>`;}).join("")}</div>`;
  }

  function focusState(){
    const s=C.siteBlocker;
    const inSched=sbInSchedule();
    const active=s.blockFocus||inSched;
    const why=s.blockFocus?"Focus switch is on"
      :inSched?`inside schedule ${esc(s.schedule.from)}–${esc(s.schedule.to)}`
      :s.scheduleOn?`outside schedule ${esc(s.schedule.from)}–${esc(s.schedule.to)}`
      :"Focus switch off and schedule off";
    const hereBlocked=active&&sbMatch(FOCUS)&&!sbMatch(s.allow);
    const col=active?"#e6b34d":"#7a7a7a";
    return `<div class="cu" style="color:${col};padding:3px 0">${active?"●":"○"} Focus pack ${active?"BLOCKING NOW":"not blocking"} (${why})${hereBlocked?` — <b>${esc(bare())} is blocked</b>`:sbMatch(FOCUS)?` — ${esc(bare())} is in the pack`:""}</div>`;
  }

  const secSB=()=>{const s=C.siteBlocker;return`<details data-s=sb open><summary>⛔ Blocker ${s.enabled?"ON":"OFF"}</summary><div class="r"><div>${esc(HOST)}</div><label class="sw"><input type="checkbox" data-sw="siteBlocker.enabled"${s.enabled?" checked":""}><span class="tk"></span></label></div>${sw2("Adult","siteBlocker","blockAdult","Focus","siteBlocker","blockFocus")}${sw("Schedule ("+esc(s.schedule.from)+"–"+esc(s.schedule.to)+")","siteBlocker","scheduleOn")}${focusState()}${sbSnoozed()?`<div class="cu snz">⏱ Snoozed — tap cancel</div>`:""}${listBlock("Blocked","siteBlocker","custom","example.com")}${listBlock("Allowed","siteBlocker","allow","example.com")}<details data-s=focus><summary>Focus (${FOCUS.length})</summary>${packHtml(FOCUS)}</details><details data-s=adult><summary>Adult (${ADULT.length})</summary>${packHtml(ADULT)}</details><details data-s=sb-adv><summary>Advanced</summary>${time2("From","siteBlocker","from","To","to")}${numR("Snooze min","siteBlocker","snoozeMinutes")}${hkR("siteBlocker")}</details></details>`;};

  const secVM=()=>{const v=C.viewMode,modes=["desktop","mobile","auto"];const seg=(val,attr)=>`<button class="${(attr==="data-vm"?vmMode:v.newSiteDefault)===val?"on":""}" ${attr}="${val}">${val[0].toUpperCase()+val.slice(1)}</button>`;return`<details data-s=vm><summary>🖥 View ${vmMode.toUpperCase()}</summary><div class="r2"><span>Site</span><div class="sg">${modes.map(m=>seg(m,"data-vm")).join("")}</div><span style="margin-left:auto">Def</span><div class="sg">${modes.map(m=>seg(m,"data-df")).join("")}</div></div>${swG("viewMode",[["UA","spoofUA"],["Touch","spoofTouch"],["Media","spoofMedia"],["Frame","frameOnDesktop"],["Button","showButton"]])}<details data-s=vm-adv><summary>Advanced</summary>${num2("DeskW","viewMode","desktopWidth","MobW","viewMode","mobileWidth")}${num2("MobH","viewMode","mobileHeight","DPR","viewMode","mobileDpr")}${numR("Long-press ms","viewMode","longPressMs")}${txtR("Mobile UA","viewMode","mobileUA")}${txtR("Desktop UA","viewMode","desktopUA")}${hkR("viewMode")}</details></details>`;};

  const secFB=()=>`<details data-s=facebook><summary>🧹 FB ${C.facebook.enabled?"ON":"OFF"}</summary>${swG("facebook",[["On","enabled"],["Sponsored","hideSponsored"],["Suggested","hideSuggested"],["People YMKN","hidePeopleYouMayKnow"],["Reels/Stories","hideReelsTrays"],["Comments","hideComments"],["Video autoplay","hideVideoAutoplay"],["Like counts","hideLikeCounts"],["R.sidebar","hideRightSidebar"],["L.sidebar","hideLeftSidebar"],["Composer","hideComposer"],["Top bar","hideTopBar"],["Tracking","stripTracking"],["Reel ads","skipReelsAds"],["Most Recent","forceMostRecent"],["Widen feed","widenFeed"],["Button","showToggleButton"]])}${listBlock("Junk phrases","facebook","extraJunkPhrases","phrase")}<details data-s=fb-adv><summary>Advanced</summary>${numR("Feed max width","facebook","feedMaxWidth")}${hkR("facebook")}</details></details>`;

  const secYT=()=>`<details data-s=youtube><summary>⏭ YT ${C.youtube.enabled?"ON":"OFF"}</summary>${swG("youtube",[["On","enabled"],["Video ads","skipVideoAds"],["Shorts ads","skipShortsAds"],["Feed ads","hideFeedAds"],["Banners","hideBanners"],["Mute ads","muteAds"],["Anti-AB","dismissAntiAdblock"],["Hide Shorts","hideShorts"],["End cards","hideEndCards"],["Info cards","hideInfoCards"],["Autoplay","hideAutoplay"],["Related","hideRelated"],["Comments","hideComments"],["Chips","hideChips"],["Merch/promos","hideMerch"],["Live chat","hideLiveChat"],["Widen player","widenPlayer"],["Button","showToggleButton"]])}<details data-s=yt-adv><summary>Advanced</summary>${hkR("youtube")}</details></details>`;

  const secIO=()=>`<details data-s=io><summary>⚙ Import / Export</summary><div class="r"><span>Export settings</span><button class="hk" data-export>Save file</button></div><div class="fr"><span style="font-size:11px;color:#888">Import settings (paste JSON)</span><textarea class="tx" rows="3" style="resize:vertical" data-import placeholder="Paste exported JSON here…"></textarea><button class="hk" style="margin-top:4px;width:100%" data-importbtn>Import</button></div><div class="r"><span>Reset all to defaults</span><button class="hk" style="color:#f66" data-reset>Reset</button></div></details>`;

  const PCSS=`:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bk{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;-webkit-tap-highlight-color:transparent}.cd{position:fixed;inset:0;margin:auto;width:min(600px,calc(100vw - 16px));height:fit-content;max-height:min(92dvh,900px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#18191c;color:#ddd;border-radius:14px;padding:12px 10px;box-shadow:0 12px 40px rgba(0,0,0,.7);z-index:2147483647;font-size:13px;line-height:1.35}.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}.hd h1{font-size:15px;font-weight:700;margin:0}.x{background:#2a2a2f;border:0;color:#ccc;font-size:14px;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;-webkit-appearance:none}.r{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 0;border-top:1px solid #27282c}.r>span{flex:1;font-size:12px;line-height:1.2}.r2{display:flex;align-items:center;gap:6px;padding:5px 0;border-top:1px solid #27282c;flex-wrap:wrap}.r2>span{font-size:12px}.fr{display:flex;flex-direction:column;gap:3px;padding:5px 0;border-top:1px solid #27282c}.cu{font-size:10px;color:#888;margin-top:1px}.snz{cursor:pointer;text-decoration:underline}.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));column-gap:12px}.gr .r{min-width:0}.gr .r>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc{margin-top:6px}.sc>h2{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#777;margin:0 0 1px}.it{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 0;border-top:1px solid #27282c}.it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px}.dl{background:none;border:0;color:#f66;cursor:pointer;padding:0;width:24px;height:24px;font-size:13px;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;border-radius:50%}.dl:active{background:#2a2a2f}.ad{display:flex;gap:4px;margin-top:4px}.ad input{flex:1;min-width:0;background:#111;border:1px solid #333;color:#ddd;border-radius:8px;padding:6px 8px;font-size:13px;-webkit-appearance:none}.ad input:focus{border-color:#3a7afe;outline:none}.ad button{background:#3a7afe;border:0;color:#fff;border-radius:8px;cursor:pointer;padding:0 12px;font-size:14px;-webkit-appearance:none;font-weight:700}.em{color:#666;font-style:italic;padding:4px 0;border-top:1px solid #27282c;font-size:11px}.sw{position:relative;display:inline-block;width:36px;height:20px;flex:0 0 auto}.sw input{opacity:0;width:0;height:0;position:absolute}.tk{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.15s;cursor:pointer}.tk::before{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}.sw input:checked+.tk{background:#34c759}.sw input:checked+.tk::before{transform:translateX(16px)}details{margin-top:2px}summary{cursor:pointer;padding:5px 0;color:#aaa;border-top:1px solid #27282c;list-style:none;user-select:none;font-weight:600;font-size:12px;display:flex;align-items:center;gap:3px}summary::-webkit-details-marker{display:none}details[open]>summary::after{content:"▲";font-size:7px;color:#666;margin-left:auto}details:not([open])>summary::after{content:"▼";font-size:7px;color:#666;margin-left:auto}.pl{border:0;border-radius:6px;cursor:pointer;padding:2px 7px;font-size:10px;-webkit-appearance:none;font-weight:500}.bl{background:#3a2b2b;color:#f99}.al{background:#1e3020;color:#7e9}.pg{display:flex;flex-wrap:wrap;gap:3px;padding:4px 0}.nm{width:64px;background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 6px;font-size:12px;text-align:right;-webkit-appearance:none}.tm{background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 6px;font-size:12px;-webkit-appearance:none;width:80px}.tx{background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:5px 7px;font-size:11px;width:100%;-webkit-appearance:none}.nm:focus,.tm:focus,.tx:focus{border-color:#3a7afe;outline:none}.hk{background:#2a2a2f;border:0;color:#ddd;border-radius:6px;cursor:pointer;padding:4px 8px;font-size:11px;-webkit-appearance:none}.hk.arm{background:#3a7afe;color:#fff}.sg{display:flex;gap:3px;flex:0 0 auto}.sg button{flex:1;background:#2a2a2f;border:0;color:#bbb;border-radius:6px;cursor:pointer;padding:4px 6px;font-size:11px;-webkit-appearance:none;white-space:nowrap}.sg button.on{background:#3a7afe;color:#fff;font-weight:600}`;

  const Panel=(()=>{
    let root=null,capFn=null,armed=null;
    const affects=m=>m==="siteBlocker"?"block":m==="facebook"?isFB:m==="youtube"?isYT:m==="viewMode"?vmActive():false;
    const edit=(m,fn)=>{armed=null;applyEdit(m,fn,affects(m));};
    const onEsc=e=>{if(!armed&&e.key==="Escape"){e.preventDefault();close();}};

    function degraded(sh){
      sh.textContent="";
      root.style.pointerEvents="none";
      const box=mk("div",{style:"position:fixed;right:12px;bottom:64px;max-width:300px;pointer-events:auto;background:#18191c;color:#ddd;padding:12px 14px;border-radius:12px;font:13px -apple-system,system-ui,sans-serif;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.6)"});
      box.appendChild(mk("div",{style:"font-weight:700;margin-bottom:5px"},"🧼 Web Cleaner"));
      box.appendChild(mk("div",{style:"opacity:.75"},"This site's security policy blocks the settings panel. Use your userscript manager menu or the keyboard shortcuts instead."));
      const b=mk("button",{style:"margin-top:9px;padding:5px 11px;border:0;border-radius:8px;background:#2a2a2f;color:#ddd;cursor:pointer;font-size:12px"},"Close");
      b.addEventListener("click",close);
      box.appendChild(b);
      sh.appendChild(box);
    }

    function render(){
      const sh=root.shadowRoot,om={};
      qa("details[data-s]",sh).forEach(d=>{om[d.getAttribute("data-s")]=d.open;});
      const hm=healthScan();
      const warn=hm>0?`<div class="cu" style="color:#e6b34d;padding:4px 0;border-top:1px solid #27282c">⚠ ${hm} sponsored label${hm>1?"s":""} still visible — this site's markup may have changed. Filtering is degraded, not broken.</div>`:"";
      const ok=safeHTML(sh,`<style>${PCSS}</style><div class="bk" data-x></div><div class="cd" role="dialog"><div class="hd"><h1>🧼 Web Cleaner</h1><button class="x" data-x>✕</button></div>${warn}${secSB()}${secVM()}${isFB?secFB():""}${isYT?secYT():""}${secIO()}</div>`);
      if(!ok){degraded(sh);return;}
      qa("details[data-s]",sh).forEach(d=>{if(om[d.getAttribute("data-s")])d.open=true;});
      wire(sh);
    }

    function wire(sh){
      qa("[data-x]",sh).forEach(e=>e.addEventListener("click",close));
      sh.querySelector(".snz")?.addEventListener("click",()=>{gSet("snz",0);location.reload();});

      qa("[data-sw]",sh).forEach(e=>e.addEventListener("change",()=>{
        const[m,k]=e.getAttribute("data-sw").split(".");
        if(m==="facebook"&&k==="enabled"){toggleFB(e.checked);render();return;}
        if(m==="youtube"&&k==="enabled"){toggleYT(e.checked);render();return;}
        edit(m,()=>{C[m][k]=e.checked;});
      }));

      qa("[data-num]",sh).forEach(e=>e.addEventListener("change",()=>{
        const[m,k]=e.getAttribute("data-num").split(".");
        let v=parseFloat(e.value);if(!isFinite(v)||v<=0){render();return;}
        if(BOUNDS[k])v=clamp(v,BOUNDS[k][0],BOUNDS[k][1]);
        edit(m,()=>{C[m][k]=v;});
      }));

      qa("[data-txt]",sh).forEach(e=>e.addEventListener("change",()=>{
        const[m,k]=e.getAttribute("data-txt").split(".");
        const v=e.value.trim();if(!v){render();return;}
        edit(m,()=>{C[m][k]=v;});
      }));

      qa("[data-time]",sh).forEach(e=>e.addEventListener("change",()=>{
        const k=e.getAttribute("data-time").split(".")[1];
        if(!/^\d{2}:\d{2}$/.test(e.value)){render();return;}
        edit("siteBlocker",()=>{C.siteBlocker.schedule[k]=e.value;});
      }));

      qa("[data-dl]",sh).forEach(e=>e.addEventListener("click",()=>{
        const[m,k]=e.getAttribute("data-dl").split(".");
        edit(m,()=>{C[m][k]=C[m][k].filter(d=>d!==e.getAttribute("data-v"));});
      }));

      qa("[data-ab]",sh).forEach(btn=>{
        const path=btn.getAttribute("data-ab"),[m,k]=path.split(".");
        const inp=sh.querySelector(`[data-ai="${path}"]`);
        const go=()=>{const v=m==="facebook"?inp.value.trim().toLowerCase():cleanHost(inp.value);if(!v)return;inp.value="";edit(m,()=>{if(!C[m][k].includes(v))C[m][k].push(v);if(m==="siteBlocker"){if(k==="custom")C.siteBlocker.allow=C.siteBlocker.allow.filter(d=>d!==v);if(k==="allow")C.siteBlocker.custom=C.siteBlocker.custom.filter(d=>d!==v);}});};
        btn.addEventListener("click",go);
        inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();go();}});
        inp.addEventListener("keyup",e=>{if(e.key==="Enter")go();});
      });

      qa("[data-pk]",sh).forEach(b=>b.addEventListener("click",()=>{
        const v=b.getAttribute("data-pk");
        edit("siteBlocker",()=>{const a=C.siteBlocker.allow;C.siteBlocker.allow=a.includes(v)?a.filter(d=>d!==v):[...a,v];});
      }));

      qa("[data-vm]",sh).forEach(b=>b.addEventListener("click",()=>setVM(b.getAttribute("data-vm"))));
      qa("[data-df]",sh).forEach(b=>b.addEventListener("click",()=>edit("viewMode",()=>{C.viewMode.newSiteDefault=b.getAttribute("data-df");})));

      qa("[data-hk]",sh).forEach(b=>b.addEventListener("click",()=>{
        const m=b.getAttribute("data-hk");armed=m;b.textContent="Press…";b.classList.add("arm");
        if(capFn){window.removeEventListener("keydown",capFn,true);capFn=null;}
        capFn=e=>{e.preventDefault();e.stopPropagation();if(["Shift","Control","Alt","Meta"].includes(e.key))return;window.removeEventListener("keydown",capFn,true);capFn=null;armed=null;if(e.metaKey||!(e.altKey||e.ctrlKey||e.shiftKey)){render();return;}applyEdit(m,()=>{C[m].toggleHotkey={ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,key:e.key.toLowerCase()};},false);};
        window.addEventListener("keydown",capFn,true);
      }));

      sh.querySelector("[data-export]")?.addEventListener("click",exportSettings);

      const importBtn=sh.querySelector("[data-importbtn]");
      const importArea=sh.querySelector("[data-import]");
      importBtn?.addEventListener("click",()=>{if(importArea?.value.trim())importSettings(importArea.value.trim());});

      sh.querySelector("[data-reset]")?.addEventListener("click",()=>{if(confirm("Reset all settings to defaults?"))resetSettings();});
    }

    function open(){if(root){close();return;}if(!document.body)return;root=mk("div",{id:"wc-panel",style:"all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:all"});root.attachShadow({mode:"open"});document.body.appendChild(root);render();document.addEventListener("keydown",onEsc,true);}
    function close(){if(capFn){window.removeEventListener("keydown",capFn,true);capFn=null;}armed=null;root?.remove();root=null;document.removeEventListener("keydown",onEsc,true);}
    return{open,close,refresh:()=>{if(root?.shadowRoot)render();}};
  })();

  const CBTN="width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;font-size:15px;line-height:32px;padding:0;text-align:center;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,.35);transition:transform .1s,opacity .15s;-webkit-appearance:none;";

  function initCluster(){
    if(!document.body||document.getElementById("wc-cl")) return;
    const cl=mk("div",{id:"wc-cl",style:"position:fixed;z-index:2147483647;display:flex;flex-direction:column;gap:3px;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;padding:3px;border-radius:20px;background:rgba(0,0,0,.12)"});
    const saved=(()=>{try{return JSON.parse(localStorage.getItem(PFX+"clpos")||"null");}catch(_){return null;}})();
    if(saved?.l!=null){cl.style.left=clamp(saved.l,0,innerWidth-38)+"px";cl.style.top=clamp(saved.t,0,innerHeight-120)+"px";cl.style.right=cl.style.bottom="auto";}
    else{cl.style.right="6px";cl.style.bottom=`calc(16px + env(safe-area-inset-bottom))`;}

    const addBtn=(icon,bg,color,opacity,id)=>{const b=mk("button",{style:`${CBTN}background:${bg};color:${color};opacity:${opacity}`,"aria-label":icon},icon);if(id)b.id=id;cl.appendChild(b);return b;};
    let sx=0,sy=0,drag=false,aptr=null,dragEndAt=0,lt=null;
    const clearLT=()=>{if(lt){clearTimeout(lt);lt=null;}};
    const tapOk=()=>!drag&&Date.now()-dragEndAt>250;

    cl.addEventListener("pointerdown",e=>{sx=e.clientX;sy=e.clientY;drag=false;aptr=e.pointerId;});
    cl.addEventListener("pointermove",e=>{if(aptr===null)return;if(!drag&&Math.hypot(e.clientX-sx,e.clientY-sy)>6){drag=true;clearLT();try{cl.setPointerCapture(e.pointerId);}catch(_){}}if(drag){e.preventDefault();cl.style.left=clamp(e.clientX-19,0,innerWidth-38)+"px";cl.style.top=clamp(e.clientY-19,0,innerHeight-38)+"px";cl.style.right=cl.style.bottom="auto";}});
    cl.addEventListener("pointerup",e=>{if(drag){dragEndAt=Date.now();try{cl.releasePointerCapture(e.pointerId);}catch(_){}try{localStorage.setItem(PFX+"clpos",JSON.stringify({l:parseInt(cl.style.left),t:parseInt(cl.style.top)}));}catch(_){}}aptr=null;drag=false;clearLT();});
    cl.addEventListener("pointercancel",()=>{aptr=null;drag=false;clearLT();});

    addBtn("🧼","#1c1c2e","#fff",".8","").addEventListener("click",()=>{if(tapOk())Panel.open();});

    if(C.viewMode.showButton){
      const icon=vmMode==="desktop"?"🖥":vmMode==="mobile"?"📱":"🔄";
      const vb=addBtn(icon,"rgba(20,20,34,.8)","#fff",".7","");
      vb.addEventListener("pointerdown",()=>{clearLT();lt=setTimeout(()=>{lt=null;if(!drag)setVM("auto");},clamp(C.viewMode.longPressMs,BOUNDS.longPressMs[0],BOUNDS.longPressMs[1]));});
      vb.addEventListener("pointerup",()=>{const armed=!!lt;clearLT();if(armed&&tapOk())setVM(vmMode==="desktop"?"mobile":"desktop");});
      vb.addEventListener("pointercancel",clearLT);
    }

    if(isFB&&C.facebook.showToggleButton) addBtn("🧹","#fff","#111",C.facebook.enabled?"1":".3","fcf-btn").addEventListener("click",()=>{if(tapOk())toggleFB(!C.facebook.enabled);});
    if(isYT&&C.youtube.showToggleButton)  addBtn("⏭","#fff","#111",C.youtube.enabled?"1":".3","yt-btn").addEventListener("click",()=>{if(tapOk())toggleYT(!C.youtube.enabled);});

    document.body.appendChild(cl);
  }

  function initSB(){
    function showBlock(why){
      try{window.stop();}catch(_){}
      const de=document.documentElement;
      while(de.firstChild)de.removeChild(de.firstChild);
      const hd=document.createElement("head");
      hd.appendChild(mk("meta",{charset:"utf-8"}));
      hd.appendChild(mk("meta",{name:"viewport",content:"width=device-width,initial-scale=1,viewport-fit=cover"}));
      hd.appendChild(mk("title",{},"Blocked"));
      de.appendChild(hd);
      de.appendChild(document.createElement("body"));
      const b=document.body;b.id="wc-blk";
      Object.assign(b.style,{margin:"0",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",textAlign:"center",padding:"24px 20px",fontFamily:"-apple-system,system-ui,sans-serif",background:"#0c0c0e",color:"#ddd"});
      const ab=mk("button",{style:"padding:8px 18px;border:0;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;-webkit-appearance:none;background:#2a2a30;color:#ddd"},`Allow ${C.siteBlocker.snoozeMinutes} min`);
      ab.onclick=()=>{sbSnooze(C.siteBlocker.snoozeMinutes);location.reload();};
      const mb=mk("button",{style:"padding:6px 14px;border:0;border-radius:10px;cursor:pointer;font-size:12px;-webkit-appearance:none;background:#1a1a1e;color:#888"},"⚙ Manage");
      mb.onclick=Panel.open;
      b.append(mk("div",{style:"font-size:40px"},"⛔"),mk("div",{style:"font-size:18px;font-weight:700"},"Blocked"),mk("div",{style:"opacity:.55;max-width:22rem;font-size:13px;line-height:1.4"},`${bare()} — ${why}.`),ab,mb);
    }
    const check=()=>{try{const w=blockReason();if(w&&!document.getElementById("wc-blk"))showBlock(w);}catch(_){}};
    check();setInterval(check,5000);
    onHotkey(()=>C.siteBlocker.toggleHotkey,()=>applyEdit("siteBlocker",()=>{C.siteBlocker.enabled=!C.siteBlocker.enabled;},"block"));
  }

  const toggleFB=on=>{C.facebook.enabled=on;save("facebook");document.documentElement.classList.toggle("fcf-off",!on);const b=document.getElementById("fcf-btn");if(b)b.style.opacity=on?"1":".3";};

  function initFB(){
    const f=C.facebook;if(!f.enabled)document.documentElement.classList.add("fcf-off");
    if(f.forceMostRecent&&(location.pathname==="/"||location.pathname==="/home.php")&&!/[?&]sk=/.test(location.search)){
      let tried=false;
      try{tried=sessionStorage.getItem(PFX+"chr")==="1";}catch(_){}
      if(!tried){
        try{sessionStorage.setItem(PFX+"chr","1");}catch(_){}
        location.replace(location.origin+"/?sk=h_chr");
        return;
      }
    }
    const SPON="sponsored paidpartnership publicidad patrocinado sponsoris commandit gesponsert sponsorizzat gesponsord bersponsor sponsorlu sponsorowan sponsrad sponset sponsoreret ممول ממומן реклама 広告 광고 赞助 贊助 χορηγούμενη".split(" ").map(norm);
    const MARKS=[...(f.hideSponsored?SPON:[]),...(f.hideSuggested?["suggestedforyou","suggestedpost","pagesforyou","pagesyoumaylike","groupsyoumaylike"]:[]),...(f.hidePeopleYouMayKnow?["peopleyoumayknow"]:[]),...f.extraJunkPhrases.map(norm)];
    const EXACT=f.hideReelsTrays?["reels","reelsandshortvideos","stories"]:[];
    const STRIP=/[\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/g;

    (()=>{
      const X="html.fcf-s:not(.fcf-off) ";
      const R=["html:not(.fcf-off) [data-fcf]{display:none!important}"];
      if(f.hideRightSidebar)R.push(`${X}[role="complementary"]{display:none!important}`);
      if(f.hideLeftSidebar)R.push(`${X}[role="navigation"][aria-label="Shortcuts"]{display:none!important}`,`html:not(.fcf-off) [data-fcf-ln]{display:none!important}`);
      if(f.hideComposer)R.push(`${X}[role="region"][aria-label="Create a post"]{display:none!important}`);
      if(f.hideTopBar)R.push(`${X}[role="banner"],${X}[role="navigation"][aria-label="Facebook"],${X}[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}`,`${X}body{padding-top:0!important}`);
      if(f.hideReelsTrays)R.push(`${X}[aria-label="Stories"],${X}[aria-label="Reels"]{display:none!important}`);
      if(f.hideComments)R.push(`${X}[aria-label="Leave a comment"],${X}[aria-label^="Comment"]{display:none!important}`);
      if(f.hideLikeCounts)R.push(`${X}[aria-label^="Like:"],${X}[aria-label*="reaction"],${X}[aria-label*="reacted"]{display:none!important}`);
      if(f.widenFeed){
        const W=clamp(f.feedMaxWidth,BOUNDS.feedMaxWidth[0],BOUNDS.feedMaxWidth[1]);
        R.push(
          `${X}[role="main"]{max-width:none!important;width:100%!important;margin:0 auto!important}`,
          `${X}[data-fcf-w]{width:auto!important;max-width:none!important;min-width:0!important}`,
          `${X}[data-fcf-feed]{width:min(${W}px,97vw)!important;max-width:none!important;min-width:0!important;margin:0 auto!important}`,
          `${X}[data-fcf-feed]>*{width:100%!important;max-width:none!important;min-width:0!important}`
        );
      }else{
        R.push(`${X}[role="main"]{margin-left:auto!important;margin-right:auto!important}`);
      }
      if(f.hideVideoAutoplay)R.push(`html:not(.fcf-off) video{pointer-events:auto}`);
      addStyle("fcf-css",R.join("\n"));
      if(f.hideVideoAutoplay){
        let vsch=false;
        const muteVids=()=>{vsch=false;for(const v of document.querySelectorAll("video:not([data-fcf-muted])")){v.setAttribute("data-fcf-muted","");v.muted=true;v.autoplay=false;try{v.pause();}catch(_){}}};
        const vschedule=()=>{if(!vsch){vsch=true;requestAnimationFrame(muteVids);}};
        onReady(muteVids);new MutationObserver(vschedule).observe(document.documentElement,{childList:true,subtree:true});
      }
    })();

    function readText(scope,bt,bb){
      const g=[];let budget=600;
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,null);let n;
      while((n=walker.nextNode())&&budget-->0){
        const s=n.nodeValue;if(!s?.trim())continue;
        const p=n.parentElement;if(!p||p.closest('[aria-hidden="true"]'))continue;
        const cs=getComputedStyle(p);if(cs.display==="none"||cs.visibility==="hidden"||cs.opacity==="0"||cs.fontSize==="0px")continue;
        const pr=p.getBoundingClientRect();if(!pr.width||!pr.height||pr.right<=0||pr.bottom<bt||pr.top>bb)continue;
        const rng=document.createRange();rng.selectNodeContents(n);const r=rng.getBoundingClientRect();
        if(!r.width||!r.height||r.right<=0||r.top<bt||r.top>bb)continue;
        g.push({c:s.trim(),t:Math.round(r.top),l:Math.round(r.left)});
      }
      const seen=new Set(),kept=[];
      for(const x of g){const k=`${x.t}:${x.l}`;if(!seen.has(k)){seen.add(k);kept.push(x);}}
      kept.sort((a,b)=>(a.t-b.t)||(a.l-b.l));
      return kept.map(x=>x.c).join("").replace(STRIP,"").replace(/\s+/g," ").trim();
    }

    const isJunk=c=>MARKS.some(m=>c.includes(m))||EXACT.includes(c);

    let _feed=null,_skipEl=null,_skipN=0;
    interceptNav(()=>{_feed=null;_skipEl=null;_skipN=0;});

    function tagWiden(fd){
      if(!f.widenFeed||!fd)return;
      if(fd.getAttribute("data-fcf-feed")===null)fd.setAttribute("data-fcf-feed","");
      const main=q('[role="main"]');
      for(let n=fd.parentElement;n&&n!==main;n=n.parentElement)
        if(n.getAttribute("data-fcf-w")===null)n.setAttribute("data-fcf-w","");
    }

    function feedBox(){
      if(_feed?.isConnected&&_feed.children.length>1)return _feed;
      const main=q('[role="main"]');if(!main)return null;
      const lo=Math.min(400,innerWidth*0.5),hi=Math.max(innerWidth*0.99,760);
      let best=null,bn=1;
      for(const d of main.querySelectorAll("div")){
        const kids=d.children,kn=kids.length;
        if(kn<2||kn>80)continue;
        let n=0;
        for(const c of kids){const r=c.getBoundingClientRect();if(r.width>=lo&&r.width<=hi&&r.height>60)n++;}
        if(n>bn){bn=n;best=d;}
      }
      _feed=best;tagWiden(best);return best;
    }

    function recheck(el){
      const s=(el.textContent||"").length;
      if(el._wcSig!==s){el._wcSig=s;el._wcN=0;if(el._wc==="c")el._wc=null;}
      return el._wc!=="c";
    }

    function processDesktop(){
      const fd=feedBox();if(!fd)return;const vh=innerHeight;
      for(const st of fd.children){
        if(st._wc==="h")continue;
        if(!recheck(st))continue;
        const r=st.getBoundingClientRect();
        if(r.height<60||r.bottom<-500||r.top>vh+500)continue;
        const hdr=readText(st,r.top-2,r.top+130);if(!hdr)continue;
        if(isJunk(norm(hdr))||(f.hideReelsTrays&&st.querySelectorAll('a[href*="/reel/"]').length>3)){st.setAttribute("data-fcf","");st._wc="h";}
        else if((st._wcN=(st._wcN||0)+1)>=6)st._wc="c";
      }
    }

    function processCards(){
      const scope=q('[role="main"]');if(!scope)return;
      const vh=innerHeight,lim=Math.min(560,innerWidth*0.55);
      for(const el of scope.querySelectorAll("div,a")){
        if(el._wc)continue;
        const r=el.getBoundingClientRect();
        if(r.width<120||r.width>lim||r.height<80||r.height>620)continue;
        if(r.bottom<-500||r.top>vh+500)continue;
        const raw=norm(el.textContent||"");
        if(!raw||!MARKS.some(m=>raw.includes(m)))continue;
        let tighter=false;
        for(const c of el.children){
          const cr=c.getBoundingClientRect();
          if(cr.width<120||cr.height<80)continue;
          if(MARKS.some(m=>norm(c.textContent||"").includes(m))){tighter=true;break;}
        }
        if(tighter)continue;
        el.setAttribute("data-fcf","");el._wc="h";
      }
    }

    const MOB_CANDIDATES=[
      "[data-tracking-duration-id]",
      "[data-sigil~='m-feed-voice-subtitle']",
      "div[data-testid='story-subtitle']",
      "article[role='article']",
      "div[role='article']",
    ];

    function mobilePostNodes(){
      for(const sel of MOB_CANDIDATES){
        const found=document.querySelectorAll(sel);
        if(found.length>1)return found;
      }
      return [];
    }

    function processMobile(){
      for(const p of mobilePostNodes()){
        if(p._wc==="h")continue;
        if(!recheck(p))continue;
        let junk=false;
        for(const e of p.querySelectorAll('span,a[role="link"],h3,h4,div[role="heading"]')){
          if(junk)break;const raw=(e.textContent||"").trim();if(!raw||raw.length>40)continue;
          const t=norm(raw);if(!t)continue;
          if(MARKS.some(m=>t===m||t.startsWith(m))||EXACT.includes(t))junk=true;
        }
        if(junk){p.setAttribute("data-fcf","");p._wc="h";}
        else if((p._wcN=(p._wcN||0)+1)>=6)p._wc="c";
      }
    }

    function hideLeftNav(){
      if(!f.hideLeftSidebar)return;
      for(const n of document.querySelectorAll('[role="navigation"]:not([data-fcf-ln])')){
        const r=n.getBoundingClientRect();
        if(r.height>350&&r.width>=120&&r.width<=460&&r.left<=24)n.setAttribute("data-fcf-ln","");
      }
    }

    const _reelSt=new WeakMap();let _skipT=0;
    function handleReels(){
      if(!f.skipReelsAds||!/^\/reels?(\/|$)/.test(location.pathname))return;
      const cy=innerHeight/2;let act=null,best=1e9;
      for(const v of document.querySelectorAll("video")){const r=v.getBoundingClientRect();if(r.height<200)continue;const d=Math.abs((r.top+r.bottom)/2-cy);if(d<best){best=d;act=v;}}
      if(!act)return;
      let rl=act;for(let i=0;i<12&&rl.parentElement;i++){rl=rl.parentElement;if(rl.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]'))break;}
      if(!reelSpon(rl,act)){if(act!==_skipEl){_skipEl=null;_skipN=0;}return;}
      if(act!==_skipEl){_skipEl=act;_skipN=0;}
      if(Date.now()-_skipT<600||_skipN>=8)return;_skipN++;_skipT=Date.now();
      const nx=q('[role="button"][aria-label="Next Card"]');if(nx){nx.click();return;}
      const tg=rl.closest("[tabindex]")||rl;
      for(const tp of["keydown","keyup"])tg.dispatchEvent(new KeyboardEvent(tp,{key:"ArrowDown",code:"ArrowDown",keyCode:40,which:40,bubbles:true}));
    }

    function reelSpon(rl,key){
      let st=_reelSt.get(key);if(!st)_reelSt.set(key,(st={s:false,n:0}));
      if(st.s)return true;if(st.n>=8)return false;st.n++;
      const r=rl.getBoundingClientRect(),c=norm(readText(rl,r.top-2,r.bottom+2));
      if(SPON.some(m=>c.includes(m)))st.s=true;return st.s;
    }

    const TKEYS=new Set("fbclid gclid dclid gbraid wbraid msclkid yclid twclid igshid mc_eid mc_cid _openstat vero_id oly_enc_id oly_anon_id wickedid _hsenc _hsmi mkt_tok ref refsrc refid fref hc_ref hc_location ref_src ref_url eav paipv comment_tracking av rdid".split(" "));
    const SHIMS=new Set(["l.facebook.com","lm.facebook.com","l.messenger.com"]);
    const isTK=k=>TKEYS.has(k)||k.startsWith("utm_")||k.startsWith("__");
    function cleanUrl(href){let u;try{u=new URL(href,location.href);}catch(_){return null;}let d=false;if(SHIMS.has(u.hostname)&&u.pathname==="/l.php"){const r=u.searchParams.get("u");if(r)try{const x=new URL(r);if(/^https?:$/.test(x.protocol)){u=x;d=true;}}catch(_){}}for(const k of[...u.searchParams.keys()])if(isTK(k)){u.searchParams.delete(k);d=true;}return d?u.toString():null;}
    function cleanLinks(){const h=cleanUrl(location.href);if(h)history.replaceState(history.state,"",h);for(const a of document.querySelectorAll('a[href^="http"]:not([data-fcf-cl])')){a.setAttribute("data-fcf-cl","");const c=cleanUrl(a.getAttribute("data-lynx-uri")||a.href);if(c)a.href=c;a.removeAttribute("ping");a.removeAttribute("data-lynx-uri");}}

    const isFeed=()=>{const pp=location.pathname;return pp==="/"||pp==="/home.php";};
    const isClean=()=>{const pp=location.pathname.replace(/\/$/,"");return isFeed()||pp==="/groups/feed"||pp==="/watch"||/^\/groups\/[^/]+$/.test(pp);};
    const hasDesktopShell=()=>!!q('[role="main"]');
    function sweep(){
      try{
        if(f.stripTracking)cleanLinks();
        document.documentElement.classList.toggle("fcf-s",isFeed());
        processMobile();
        handleReels();
        if(hasDesktopShell()){hideLeftNav();if(isClean())processDesktop();processCards();}
      }catch(_){}
    }
    let sch=false;const idle=window.requestIdleCallback?.bind(window)??requestAnimationFrame,schedule=()=>{if(!sch){sch=true;idle(()=>{sch=false;sweep();});}};
    document.documentElement.classList.toggle("fcf-s",isFeed());
    onReady(()=>{sweep();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener("scroll",schedule,{passive:true});setInterval(sweep,1200);setInterval(()=>{const b=document.getElementById("fcf-btn");if(b)b.style.boxShadow=healthScan()>0?"0 0 0 2px #e6b34d":"";},6000);});
    onHotkey(()=>f.toggleHotkey,()=>toggleFB(!C.facebook.enabled));
  }

  const toggleYT=on=>{C.youtube.enabled=on;save("youtube");const s=document.getElementById("yt-css");if(s)s.disabled=!on;const b=document.getElementById("yt-btn");if(b)b.style.opacity=on?"1":".3";};

  function initYT(){
    const y=C.youtube;
    const SEL={ban:"#masthead-ad,#player-ads,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,ytm-companion-slot,ytm-companion-ad-renderer,.ytp-ad-overlay-slot,.ytp-ad-overlay-container,.ytp-ad-image-overlay",feed:"ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-video-renderer,ytd-promoted-sparkles-web-renderer,ytd-search-pyv-renderer,ytm-companion-slot,ytm-companion-ad-renderer,ytm-promoted-video-renderer,ytm-search-pyv-renderer,ytm-promoted-sparkles-web-renderer,ad-slot-renderer,ad-disclosure-banner-view-model",wrap:"ytd-rich-item-renderer,ytd-rich-section-renderer,ytd-item-section-renderer,ytm-rich-item-renderer,ytm-rich-section-renderer,ytm-item-section-renderer,ytm-media-item",skip:".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-skip-ad-slot button",clos:".ytp-ad-overlay-close-button,.ytp-ad-overlay-close-container button",adui:".ytp-ad-player-overlay,.ytp-ad-player-overlay-layout,.ytp-ad-player-overlay-instream-info,.ytp-ad-preview-container,.ytp-ad-badge,.ytp-ad-simple-ad-badge,.ytp-ad-duration-remaining,.ytp-ad-persistent-progress-bar"};
    const AD_V=["ad-showing","ad-interrupting"],AD_S=["ad-showing","ad-interrupting","ad-created"];
    const hasC=(el,cl)=>!!el&&cl.some(c=>el.classList.contains(c));
    const pApi=(el,m,d)=>{try{return typeof el?.[m]==="function"?el[m]():d;}catch(_){return d;}};
    const adPresenting=el=>{const t=pApi(el,"getPresentingPlayerType",-1);return t===2||t===3;};

    const rules=[...(y.hideBanners?[SEL.ban]:[]),...(y.hideFeedAds?[SEL.feed,"[data-yt-h]"]:[])];
    if(y.hideShorts)rules.push("ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)","ytd-reel-shelf-renderer","ytd-rich-shelf-renderer[is-shorts]","ytm-reel-shelf-renderer","ytm-shorts-shelf-renderer","ytd-guide-entry-renderer:has(a[href^='/shorts'])","ytd-mini-guide-entry-renderer:has(a[href^='/shorts'])","ytm-pivot-bar-item-renderer:has(a[href^='/shorts'])");
    if(y.hideEndCards)rules.push(".ytp-ce-element",".ytp-endscreen-content");
    if(y.hideInfoCards)rules.push(".ytp-cards-teaser",".ytp-card-content",".ytp-suggested-action");
    if(y.hideAutoplay)rules.push(".ytp-autonav-endscreen");
    if(y.hideRelated)rules.push("#secondary","#related","ytd-watch-next-secondary-results-renderer","ytm-single-column-watch-next-results-renderer","ytm-item-section-renderer:has(ytm-video-with-context-renderer)");
    if(y.hideComments)rules.push("#comments","ytd-comments","ytm-comments-entry-point-header-renderer","ytm-comments-entry-point-teaser-renderer");
    if(y.hideChips)rules.push("ytd-feed-filter-chip-bar-renderer","#chips-wrapper","ytm-feed-filter-chip-bar-renderer","ytm-feed-nudge-renderer");
    if(y.hideMerch)rules.push("ytd-merch-shelf-renderer","ytd-ticket-shelf-renderer","#donation-shelf","ytmusic-mealbar-promo-renderer","ytd-mealbar-promo-renderer","yt-mealbar-promo-renderer");
    if(y.hideLiveChat)rules.push("#chat","ytd-live-chat-frame","#chat-container");
    if(y.hideRelated&&y.widenPlayer)rules.push(
      "ytd-watch-flexy #primary.ytd-watch-flexy{max-width:none!important;width:100%!important}",
      "ytd-watch-flexy #primary-inner.ytd-watch-flexy{max-width:none!important}",
      "ytd-watch-flexy[flexy] #player.ytd-watch-flexy{max-width:none!important}"
    );
    const hideRules=rules.filter(r=>!r.includes("{"));
    const rawRules=rules.filter(r=>r.includes("{"));
    const css=(hideRules.length?hideRules.join(",")+"{display:none!important}\n":"")+rawRules.join("\n");
    if(css.trim())addStyle("yt-css",css);
    if(!y.enabled){const ss=document.getElementById("yt-css");if(ss)ss.disabled=true;}

    if(y.hideAutoplay){
      const disableAP=()=>{const ap=q(".ytp-autonav-toggle-button");if(ap&&ap.getAttribute("aria-checked")==="true")ap.click();};
      const apNudge=()=>[0,600,1800].forEach(t=>setTimeout(disableAP,t));
      onReady(apNudge);interceptNav(apNudge);
    }

    if(y.hideRelated&&y.widenPlayer){
      const relayout=()=>{try{window.dispatchEvent(new Event("resize"));}catch(_){}};
      const nudge=()=>[0,300,900,2000].forEach(t=>setTimeout(relayout,t));
      onReady(nudge);interceptNav(nudge);
    }

    let muted=false,lastShort=0,adTicks=0;
    const _dismissedEnf=new WeakSet();
    interceptNav(()=>{lastShort=0;adTicks=0;});

    function tap(el){
      try{el.click();}catch(_){}
      const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
      const o={bubbles:true,cancelable:true,composed:true,clientX:cx,clientY:cy,view:window};
      const P=(t)=>{try{el.dispatchEvent(new PointerEvent(t,{...o,pointerType:"touch",isPrimary:true,pointerId:1}));}catch(_){}};
      const M=(t)=>{try{el.dispatchEvent(new MouseEvent(t,o));}catch(_){}};
      const T=(t)=>{try{el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true}));}catch(_){}};
      P("pointerdown");T("touchstart");M("mousedown");
      P("pointerup");T("touchend");M("mouseup");M("click");
    }

    function tick(){
      if(!y.enabled)return;
      try{
        if(y.dismissAntiAdblock){
          const enf=q("ytd-enforcement-message-view-model");
          if(enf&&!_dismissedEnf.has(enf)){
            _dismissedEnf.add(enf);
            (enf.closest("tp-yt-paper-dialog")||enf).remove();
            q("tp-yt-iron-overlay-backdrop")?.remove();
            document.body?.style.removeProperty("overflow");
            const vi=q("video");if(vi?.paused)vi.play().catch(()=>{});
          }
        }
        if(y.skipVideoAds){
          const pl=q("#movie_player,.html5-video-player"),v=q(".html5-video-player video")||q("video");
          const adUiPresent=!!q(SEL.skip)||!!q(SEL.adui);
          const adActive=(hasC(pl,AD_V)||adPresenting(pl))&&adUiPresent;
          if(adActive){
            adTicks++;
            const sk=q(SEL.skip);if(sk)tap(sk);
            if(v){
              if(y.muteAds&&!v.muted){v.muted=true;muted=true;}
              if(isFinite(v.duration)&&v.duration>1&&(!sk||adTicks>=3))v.currentTime=v.duration-.1;
            }
            q(SEL.clos)?.click();
          }
          else{adTicks=0;if(v&&muted){v.muted=false;muted=false;}}
        }
        if(y.skipShortsAds&&/^\/shorts/.test(location.pathname)){
          const sp=q("#shorts-player")||q("#movie_player,.html5-video-player");
          const shortsAdUi=!!q('.ytp-ad-player-overlay,.ytp-ad-preview-container,ytd-ad-slot-renderer,ad-slot-renderer');
          const adOn=((hasC(sp,AD_S)||adPresenting(sp))&&shortsAdUi)||!!q("ytd-reel-video-renderer ad-slot-renderer,ytd-reel-video-renderer ytd-ad-slot-renderer,ytd-shorts ytd-ad-slot-renderer,ytd-shorts ad-slot-renderer,ytd-reel-player-renderer ad-slot-renderer");
          if(adOn&&Date.now()-lastShort>700){lastShort=Date.now();const nx=q('#navigation-button-down button,button[aria-label="Next video"],button[aria-label="Next Short"]');nx?nx.click():document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));}
        }
      }catch(_){}
    }

    function hideFeedAds(){if(!y.hideFeedAds)return;for(const ad of document.querySelectorAll(SEL.feed)){const w=ad.closest(SEL.wrap);if(w)w.setAttribute("data-yt-h","");}}
    let sch=false;const schedule=()=>{if(!sch){sch=true;requestAnimationFrame(()=>{sch=false;tick();hideFeedAds();});}};
    onReady(()=>{tick();hideFeedAds();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setInterval(tick,1000);setInterval(()=>{const b=document.getElementById("yt-btn");if(b)b.style.boxShadow=healthScan()>0?"0 0 0 2px #e6b34d":"";},6000);});
    onHotkey(()=>y.toggleHotkey,()=>toggleYT(!C.youtube.enabled));
  }

  function regMenu(){
    if(typeof GM_registerMenuCommand!=="function")return;
    const h=bare();
    GM_registerMenuCommand("⚙ Web Cleaner",Panel.open);
    GM_registerMenuCommand(`${C.siteBlocker.enabled?"⛔ ON":"✅ OFF"} toggle`,()=>applyEdit("siteBlocker",()=>{C.siteBlocker.enabled=!C.siteBlocker.enabled;},"block"));
    GM_registerMenuCommand(`➕ Block ${h}`,()=>applyEdit("siteBlocker",()=>{if(!C.siteBlocker.custom.includes(h))C.siteBlocker.custom.push(h);C.siteBlocker.allow=C.siteBlocker.allow.filter(d=>d!==h);},"block"));
    GM_registerMenuCommand(`➖ Allow ${h}`,()=>applyEdit("siteBlocker",()=>{if(!C.siteBlocker.allow.includes(h))C.siteBlocker.allow.push(h);C.siteBlocker.custom=C.siteBlocker.custom.filter(d=>d!==h);},"block"));
    if(isFB)GM_registerMenuCommand(`🧹 FB ${C.facebook.enabled?"ON":"OFF"}`,()=>toggleFB(!C.facebook.enabled));
    if(isYT)GM_registerMenuCommand(`⏭ YT ${C.youtube.enabled?"ON":"OFF"}`,()=>toggleYT(!C.youtube.enabled));
    GM_registerMenuCommand("🖥 Desktop",()=>setVM("desktop"));
    GM_registerMenuCommand("📱 Mobile",()=>setVM("mobile"));
    GM_registerMenuCommand("↺ Auto",()=>setVM("auto"));
  }

  const run=fn=>{try{fn();}catch(_){}};
  run(initSB);
  run(initVM);
  onReady(initCluster);
  const pageBlocked=(()=>{try{return !!blockReason();}catch(_){return false;}})();
  if(!pageBlocked){
    if(isFB) run(initFB);
    if(isYT) run(initYT);
  }
  regMenu();
})();
