import{c as e,g as t,h as n,s as r}from"./auth.CMFe149Y.js";import{i,n as a,o,t as s}from"./ui.B8jQw2MK.js";var c=new Set(`le.la.les.un.une.des.du.de.au.aux.et.ou.en.dans.sur.pour.par.avec.sans.sous.vers.chez.que.qui.quoi.dont.ce.ces.cet.cette.son.sa.ses.leur.leurs.est.sont.ete.plus.moins.tres.entre.apres.avant.nouveau.nouvelle.nouvelles.france.francais.francaise.annee.mois.semaine.jour`.split(`.`));function l(e){return[...new Set(o(e).split(/[^a-z0-9]+/).filter(e=>e.length>=5&&!c.has(e)))]}function u(e){return new Map(e.map(e=>[e.id,o(e.texte)]))}function d(e,t,n,r=3){let i=(e.mots_cles??[]).map(o).filter(e=>e.length>=3),a=i.length?[]:l(e.titre??``),s=[];for(let e of t){let t=o(e.titre),r=e.tags.map(o),c=0;for(let e of i)r.includes(e)?c+=5:t.includes(e)?c+=3:r.some(t=>t.includes(e)||e.includes(t))&&(c+=2);for(let e of a)r.includes(e)?c+=2:t.includes(e)&&(c+=1);if(c===0&&n){let t=n.get(e.id);if(t)for(let e of i.length?i:a)e.length>=5&&t.includes(e)&&(c+=1)}c>0&&s.push({fiche:e,score:c})}return s.sort((e,t)=>t.score-e.score||e.fiche.titre.localeCompare(t.fiche.titre,`fr`)).slice(0,r)}var f=null;function p(e){f=e}function m(e){if(!e?.length)return``;let t=e.filter(e=>e&&e.nom).map(e=>{let t=s(e.nom);return e.url?`<a href="${s(e.url)}" target="_blank" rel="noopener noreferrer nofollow"
                 class="underline decoration-dotted underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400">${t}</a>`:`<span>${t}</span>`});return t.length?`<p class="texte-secable mt-3 text-xs text-slate-500 dark:text-slate-400">Source${t.length>1?`s`:``} : ${t.join(` · `)}</p>`:``}function h(e,t){let n=t.length?d({titre:e.titre??``,mots_cles:e.mots_cles},t,f):[];if(!e.lien_cours?.trim()&&!n.length)return``;let r=e.lien_cours?.trim()?`<span class="font-medium text-indigo-700 dark:text-indigo-300">Lien avec le programme —</span> ${s(e.lien_cours)}`:`<span class="font-medium text-indigo-700 dark:text-indigo-300">À réviser avec</span>`,a=n.map(({fiche:e})=>`<a href="${i(`/fiche/`)}?id=${encodeURIComponent(e.id)}"
            title="${s(e.matiere)} · ${s(e.fascicule)}"
            class="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-slate-800">
           <span aria-hidden="true">📄</span><span class="texte-secable line-clamp-2 text-left">${s(e.titre)}</span>
         </a>`).join(``);return`<div class="texte-secable mt-3 rounded-lg border-l-2 border-indigo-300 bg-indigo-50/60 px-3 py-2 text-sm text-slate-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-slate-300">
            <p>${r}</p>
            ${a?`<div class="mt-2 flex flex-wrap gap-1.5">${a}</div>`:``}
          </div>`}function g(e){let t=document.createElement(`article`);return t.className=`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700`,t.innerHTML=`
    ${e.entete??``}
    <div class="flex items-baseline justify-between gap-3">
      <p class="etiquette ${e.classeEtiquette}">${s(e.etiquette)}</p>
      ${e.mention?`<span class="shrink-0 text-xs text-slate-400 dark:text-slate-500">${s(e.mention)}</span>`:``}
    </div>
    <h3 class="texte-secable mt-1.5 leading-snug font-semibold text-slate-900 dark:text-white">${s(e.titre)}</h3>
    ${e.corps}`,t}function _(e){let{contenu:t,ouvrir:n,fermer:r,classe:i=``,borner:a=!0}=e;return`<details class="depliant ${i}">
            <summary>
              <span class="depliant-ouvrir">${s(n)}</span>
              <span class="depliant-fermer">${s(r)}</span>
            </summary>
            <div class="${a?`depliant-corps `:``}mt-2">${t}</div>
          </details>`}function v(e,t=180){if(e.length<=t*1.4)return[e,``];let n=e.slice(t).search(/[.!?]\s/);if(n===-1)return[e,``];let r=t+n+1;return[e.slice(0,r).trim(),e.slice(r).trim()]}var y=[{cle:`pib`,libelle:`PIB`},{cle:`dette`,libelle:`Dette publique`},{cle:`dette_pct_pib`,libelle:`Dette en % du PIB`},{cle:`deficit`,libelle:`Déficit public`},{cle:`inflation`,libelle:`Inflation`}];function b(e){if(!e)return``;let t=y.filter(t=>e[t.cle]),n=Object.keys(e).filter(e=>!y.some(t=>t.cle===e)).map(e=>({cle:e,libelle:e.replace(/_/g,` `)})),r=[...t,...n].map(({cle:t,libelle:n})=>{let r=e[t],i=r.source?.nom?r.source.url?`<a href="${s(r.source.url)}" target="_blank" rel="noopener noreferrer nofollow"
              class="underline decoration-dotted underline-offset-2">${s(r.source.nom)}</a>`:s(r.source.nom):``;return`<div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p class="etiquette text-slate-500 dark:text-slate-400">${s(n)}</p>
              <p class="texte-secable mt-1 text-xl font-bold text-slate-900 dark:text-white">${s(r.valeur??`—`)}</p>
              ${r.periode_reference?`<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">${s(r.periode_reference)}</p>`:``}
              ${i?`<p class="texte-secable mt-1 text-[11px] text-slate-400 dark:text-slate-500">${i}</p>`:``}
            </div>`});return r.length?`<div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">${r.join(``)}</div>`:``}var x=3;function S(e,t){if(!e?.length)return``;let n=[...e].sort((e,t)=>(t.date??``).localeCompare(e.date??``)).map(e=>`
      <li class="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
        ${e.date?`<p class="text-xs font-medium text-slate-500 dark:text-slate-400">${s(a(e.date))}</p>`:``}
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${s(e.titre)}</p>
        <p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${s(e.resume)}</p>
        ${h(e,t)}
        ${m(e.sources)}
      </li>`),r=n.slice(0,x),i=n.slice(x),o=`<ol class="mt-3 space-y-4">${r.join(``)}</ol>`;if(!i.length)return o;let c=i.length;return o+_({classe:`mt-3`,ouvrir:`Voir plus (${c} entrée${c>1?`s`:``} plus ancienne${c>1?`s`:``})`,fermer:`Voir moins`,contenu:`<ol class="space-y-4 pr-1">${i.join(``)}</ol>`})}function C(e,t,n){if(!e)return``;let r=`texte-secable ${n} text-sm text-slate-600 dark:text-slate-300`,i=`<p class="${r}">${s(e)}</p>`;return t?i+_({classe:`mt-1`,ouvrir:`Voir plus`,fermer:`Voir moins`,borner:!1,contenu:`<p class="${r.replace(n,`mt-0`)}">${s(t)}</p>`}):i}function w(e,t=[]){let n=e.resume??e.texte_contextuel??``,r=e.texte_contextuel&&e.resume?e.texte_contextuel:``,[i,o]=v(n),[s,c]=v(r),l=g({etiquette:`Suivi permanent`,classeEtiquette:`text-slate-500 dark:text-slate-400`,titre:e.titre,mention:e.derniere_maj?a(e.derniere_maj):void 0,corps:`
      ${b(e.indicateurs)}
      ${C(i,o,`mt-3`)}
      ${C(s,c,`mt-2`)}
      ${S(e.historique,t)}
      ${e.historique?.length?``:h(e,t)}
      ${m(e.sources)}`});return O(l),l}function T(e){let n=document.createElement(`section`);return n.className=`rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30`,n.innerHTML=`
    <p class="etiquette text-indigo-700 dark:text-indigo-300">Tendances de fond</p>
    <div class="mt-2 space-y-3">${e.map(e=>{let n=e.domaine?t(e.domaine):null;return`<div>
        ${n?`<p class="etiquette ${n.classe}">${s(n.libelle)}</p>`:``}
        ${e.titre?`<p class="texte-secable mt-0.5 font-semibold text-slate-900 dark:text-white">${s(e.titre)}</p>`:``}
        <p class="texte-secable mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">${s(e.texte)}</p>
      </div>`}).join(``)}</div>`,n}function E(t){let n=document.createElement(`ul`);return n.className=`flex flex-wrap gap-x-4 gap-y-1.5`,n.innerHTML=e.filter(e=>!t||t.has(e)).map(e=>`<li class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
           <span class="h-2.5 w-2.5 shrink-0 rounded-full ${r[e].pastille}" aria-hidden="true"></span>
           ${s(r[e].libelle)}
         </li>`).join(``),n}function D(e){let n=document.createElement(`ol`);return n.className=`relative ml-1 space-y-4 border-l border-slate-300 pl-5 dark:border-slate-700`,n.innerHTML=e.map(e=>{let n=t(e.domaine);return`<li class="relative">
        <span class="absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full ring-2 ring-white ${`pastille`in n?n.pastille:`bg-slate-400`} dark:ring-slate-900" aria-hidden="true"></span>
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">${s(a(e.date)||e.date)}</p>
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${s(e.libelle)}</p>
        ${e.detail?`<p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${s(e.detail)}</p>`:``}
        <p class="etiquette mt-0.5 ${n.classe}">${s(n.libelle)}</p>
      </li>`}).join(``),n}function O(e){e.dataset.rattachements=String(e.querySelectorAll(`a[href*="/fiche/"]`).length)}function k(e,r=[]){let i=t(n(e)),a=e.image?.url?`<figure class="-mx-4 -mt-4 mb-3 overflow-hidden bg-slate-100 dark:bg-slate-800">
         <img src="${s(e.image.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"
              class="aspect-video w-full max-w-full object-cover" onerror="this.closest('figure').remove()" />
         ${e.image.credit?`<figcaption class="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">${s(e.image.credit)}</figcaption>`:``}
       </figure>`:``,o=g({etiquette:i.libelle,classeEtiquette:i.classe,titre:e.titre??``,entete:a,corps:`
      <p class="texte-secable mt-2 text-sm text-slate-600 dark:text-slate-300">${s(e.resume??``)}</p>
      ${h(e,r)}
      ${m(e.sources)}`});return o.dataset.domaine=n(e),O(o),o}function A(e){let t=document.createElement(`p`);return t.className=`rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400`,t.textContent=e,t}export{D as a,u as c,p as i,w as n,E as o,k as r,A as s,T as t};