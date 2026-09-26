import{i as e,n as t,o as n,t as r}from"./ui.ve_umX8p.js";import{c as i,g as a,h as o,s}from"./auth.B_8ksE2X.js";var c=new Set(`le.la.les.un.une.des.du.de.au.aux.et.ou.en.dans.sur.pour.par.avec.sans.sous.vers.chez.que.qui.quoi.dont.ce.ces.cet.cette.son.sa.ses.leur.leurs.est.sont.ete.plus.moins.tres.entre.apres.avant.nouveau.nouvelle.nouvelles.france.francais.francaise.annee.mois.semaine.jour`.split(`.`));function l(e){return[...new Set(n(e).split(/[^a-z0-9]+/).filter(e=>e.length>=5&&!c.has(e)))]}function u(e){return new Map(e.map(e=>[e.id,n(e.texte)]))}function d(e,t,r,i=3){let a=(e.mots_cles??[]).map(n).filter(e=>e.length>=3),o=a.length?[]:l(e.titre??``),s=[];for(let e of t){let t=n(e.titre),i=e.tags.map(n),c=0;for(let e of a)i.includes(e)?c+=5:t.includes(e)?c+=3:i.some(t=>t.includes(e)||e.includes(t))&&(c+=2);for(let e of o)i.includes(e)?c+=2:t.includes(e)&&(c+=1);if(c===0&&r){let t=r.get(e.id);if(t)for(let e of a.length?a:o)e.length>=5&&t.includes(e)&&(c+=1)}c>0&&s.push({fiche:e,score:c})}return s.sort((e,t)=>t.score-e.score||e.fiche.titre.localeCompare(t.fiche.titre,`fr`)).slice(0,i)}var f=null;function p(e){f=e}function m(e){if(!e?.length)return``;let t=e.filter(e=>e&&e.nom).map(e=>{let t=r(e.nom);return e.url?`<a href="${r(e.url)}" target="_blank" rel="noopener noreferrer nofollow"
                 class="underline decoration-dotted underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400">${t}</a>`:`<span>${t}</span>`});return t.length?`<p class="texte-secable mt-3 text-xs text-slate-500 dark:text-slate-400">Source${t.length>1?`s`:``} : ${t.join(` · `)}</p>`:``}function h(t,n){let i=n.length?d({titre:t.titre??``,mots_cles:t.mots_cles},n,f):[];if(!t.lien_cours?.trim()&&!i.length)return``;let a=t.lien_cours?.trim()?`<span class="font-medium text-indigo-700 dark:text-indigo-300">Lien avec le programme —</span> ${r(t.lien_cours)}`:`<span class="font-medium text-indigo-700 dark:text-indigo-300">À réviser avec</span>`,o=i.map(({fiche:t})=>`<a href="${e(`/fiche/`)}?id=${encodeURIComponent(t.id)}"
            title="${r(t.matiere)} · ${r(t.fascicule)}"
            class="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-slate-800">
           <span aria-hidden="true">📄</span><span class="texte-secable line-clamp-2 text-left">${r(t.titre)}</span>
         </a>`).join(``);return`<div class="texte-secable mt-3 rounded-lg border-l-2 border-indigo-300 bg-indigo-50/60 px-3 py-2 text-sm text-slate-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-slate-300">
            <p>${a}</p>
            ${o?`<div class="mt-2 flex flex-wrap gap-1.5">${o}</div>`:``}
          </div>`}function g(e){let t=document.createElement(`article`);return t.className=`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700`,t.innerHTML=`
    ${e.entete??``}
    <div class="flex items-baseline justify-between gap-3">
      <p class="etiquette ${e.classeEtiquette}">${r(e.etiquette)}</p>
      ${e.mention?`<span class="shrink-0 text-xs text-slate-400 dark:text-slate-500">${r(e.mention)}</span>`:``}
    </div>
    <h3 class="texte-secable mt-1.5 leading-snug font-semibold text-slate-900 dark:text-white">${r(e.titre)}</h3>
    ${e.corps}`,t}function _(e){let{contenu:t,ouvrir:n,fermer:i,classe:a=``,borner:o=!0}=e;return`<details class="depliant ${a}">
            <summary>
              <span class="depliant-ouvrir">${r(n)}</span>
              <span class="depliant-fermer">${r(i)}</span>
            </summary>
            <div class="${o?`depliant-corps `:``}mt-2">${t}</div>
          </details>`}function v(e,t=180){if(e.length<=t*1.4)return[e,``];let n=e.slice(t).search(/[.!?]\s/);if(n===-1)return[e,``];let r=t+n+1;return[e.slice(0,r).trim(),e.slice(r).trim()]}var y=[{cle:`pib`,libelle:`PIB`},{cle:`dette`,libelle:`Dette publique`},{cle:`dette_pct_pib`,libelle:`Dette en % du PIB`},{cle:`deficit`,libelle:`Déficit public`},{cle:`inflation`,libelle:`Inflation`}];function b(e){if(!e)return``;let t=y.filter(t=>e[t.cle]),n=Object.keys(e).filter(e=>!y.some(t=>t.cle===e)).map(e=>({cle:e,libelle:e.replace(/_/g,` `)})),i=[...t,...n].map(({cle:t,libelle:n})=>{let i=e[t],a=i.source?.nom?i.source.url?`<a href="${r(i.source.url)}" target="_blank" rel="noopener noreferrer nofollow"
              class="underline decoration-dotted underline-offset-2">${r(i.source.nom)}</a>`:r(i.source.nom):``;return`<div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p class="etiquette text-slate-500 dark:text-slate-400">${r(n)}</p>
              <p class="texte-secable mt-1 text-xl font-bold text-slate-900 dark:text-white">${r(i.valeur??`—`)}</p>
              ${i.periode_reference?`<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">${r(i.periode_reference)}</p>`:``}
              ${a?`<p class="texte-secable mt-1 text-[11px] text-slate-400 dark:text-slate-500">${a}</p>`:``}
            </div>`});return i.length?`<div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">${i.join(``)}</div>`:``}var x=3;function S(e,n){if(!e?.length)return``;let i=[...e].sort((e,t)=>(t.date??``).localeCompare(e.date??``)).map(e=>`
      <li class="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
        ${e.date?`<p class="text-xs font-medium text-slate-500 dark:text-slate-400">${r(t(e.date))}</p>`:``}
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${r(e.titre)}</p>
        <p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${r(e.resume)}</p>
        ${h(e,n)}
        ${m(e.sources)}
      </li>`),a=i.slice(0,x),o=i.slice(x),s=`<ol class="mt-3 space-y-4">${a.join(``)}</ol>`;if(!o.length)return s;let c=o.length;return s+_({classe:`mt-3`,ouvrir:`Voir plus (${c} entrée${c>1?`s`:``} plus ancienne${c>1?`s`:``})`,fermer:`Voir moins`,contenu:`<ol class="space-y-4 pr-1">${o.join(``)}</ol>`})}function C(e,t,n){if(!e)return``;let i=`texte-secable ${n} text-sm text-slate-600 dark:text-slate-300`,a=`<p class="${i}">${r(e)}</p>`;return t?a+_({classe:`mt-1`,ouvrir:`Voir plus`,fermer:`Voir moins`,borner:!1,contenu:`<p class="${i.replace(n,`mt-0`)}">${r(t)}</p>`}):a}function w(e,n=[]){let r=e.resume??e.texte_contextuel??``,i=e.texte_contextuel&&e.resume?e.texte_contextuel:``,[a,o]=v(r),[s,c]=v(i),l=g({etiquette:`Suivi permanent`,classeEtiquette:`text-slate-500 dark:text-slate-400`,titre:e.titre,mention:e.derniere_maj?t(e.derniere_maj):void 0,corps:`
      ${b(e.indicateurs)}
      ${C(a,o,`mt-3`)}
      ${C(s,c,`mt-2`)}
      ${S(e.historique,n)}
      ${e.historique?.length?``:h(e,n)}
      ${m(e.sources)}`});return O(l),l}function T(e){let t=document.createElement(`section`);return t.className=`rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30`,t.innerHTML=`
    <p class="etiquette text-indigo-700 dark:text-indigo-300">Tendances de fond</p>
    <div class="mt-2 space-y-3">${e.map(e=>{let t=e.domaine?a(e.domaine):null;return`<div>
        ${t?`<p class="etiquette ${t.classe}">${r(t.libelle)}</p>`:``}
        ${e.titre?`<p class="texte-secable mt-0.5 font-semibold text-slate-900 dark:text-white">${r(e.titre)}</p>`:``}
        <p class="texte-secable mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">${r(e.texte)}</p>
      </div>`}).join(``)}</div>`,t}function E(e){let t=document.createElement(`ul`);return t.className=`flex flex-wrap gap-x-4 gap-y-1.5`,t.innerHTML=i.filter(t=>!e||e.has(t)).map(e=>`<li class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
           <span class="h-2.5 w-2.5 shrink-0 rounded-full ${s[e].pastille}" aria-hidden="true"></span>
           ${r(s[e].libelle)}
         </li>`).join(``),t}function D(e){let n=document.createElement(`ol`);return n.className=`relative ml-1 space-y-4 border-l border-slate-300 pl-5 dark:border-slate-700`,n.innerHTML=e.map(e=>{let n=a(e.domaine);return`<li class="relative">
        <span class="absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full ring-2 ring-white ${`pastille`in n?n.pastille:`bg-slate-400`} dark:ring-slate-900" aria-hidden="true"></span>
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">${r(t(e.date)||e.date)}</p>
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${r(e.libelle)}</p>
        ${e.detail?`<p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${r(e.detail)}</p>`:``}
        <p class="etiquette mt-0.5 ${n.classe}">${r(n.libelle)}</p>
      </li>`}).join(``),n}function O(e){e.dataset.rattachements=String(e.querySelectorAll(`a[href*="/fiche/"]`).length)}function k(e,t=[]){let n=a(o(e)),i=e.image?.url?`<figure class="-mx-4 -mt-4 mb-3 overflow-hidden bg-slate-100 dark:bg-slate-800">
         <img src="${r(e.image.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"
              class="aspect-video w-full max-w-full object-cover" onerror="this.closest('figure').remove()" />
         ${e.image.credit?`<figcaption class="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">${r(e.image.credit)}</figcaption>`:``}
       </figure>`:``,s=g({etiquette:n.libelle,classeEtiquette:n.classe,titre:e.titre??``,entete:i,corps:`
      <p class="texte-secable mt-2 text-sm text-slate-600 dark:text-slate-300">${r(e.resume??``)}</p>
      ${h(e,t)}
      ${m(e.sources)}`});return s.dataset.domaine=o(e),O(s),s}function A(e){let t=document.createElement(`p`);return t.className=`rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400`,t.textContent=e,t}export{D as a,u as c,p as i,w as n,E as o,k as r,A as s,T as t};