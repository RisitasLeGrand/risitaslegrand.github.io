import{c as e,g as t,h as n,s as r}from"./auth.CgqHvKGZ.js";import{n as i}from"./courant.mzQL3-EF.js";import{i as a,n as o,o as s,t as c}from"./ui.B8jQw2MK.js";import{t as l,u}from"./fournisseurs.CuV17xhj.js";var d=new Set(`le.la.les.un.une.des.du.de.au.aux.et.ou.en.dans.sur.pour.par.avec.sans.sous.vers.chez.que.qui.quoi.dont.ce.ces.cet.cette.son.sa.ses.leur.leurs.est.sont.ete.plus.moins.tres.entre.apres.avant.nouveau.nouvelle.nouvelles.france.francais.francaise.annee.mois.semaine.jour`.split(`.`));function f(e){return[...new Set(s(e).split(/[^a-z0-9]+/).filter(e=>e.length>=5&&!d.has(e)))]}function p(e){return new Map(e.map(e=>[e.id,s(e.texte)]))}function m(e,t,n,r=3){let i=(e.mots_cles??[]).map(s).filter(e=>e.length>=3),a=i.length?[]:f(e.titre??``),o=[];for(let e of t){let t=s(e.titre),r=e.tags.map(s),c=0;for(let e of i)r.includes(e)?c+=5:t.includes(e)?c+=3:r.some(t=>t.includes(e)||e.includes(t))&&(c+=2);for(let e of a)r.includes(e)?c+=2:t.includes(e)&&(c+=1);if(c===0&&n){let t=n.get(e.id);if(t)for(let e of i.length?i:a)e.length>=5&&t.includes(e)&&(c+=1)}c>0&&o.push({fiche:e,score:c})}return o.sort((e,t)=>t.score-e.score||e.fiche.titre.localeCompare(t.fiche.titre,`fr`)).slice(0,r)}function h(e,t){let n=e.liens_cours?.[t]?.trim();if(n)return n;if(!e.liens_cours&&t===`insp`)return e.lien_cours?.trim()||void 0}var g=null;function _(e){g=e}function v(e){if(!e?.length)return``;let t=e.filter(e=>e&&e.nom).map(e=>{let t=c(e.nom);return e.url?`<a href="${c(e.url)}" target="_blank" rel="noopener noreferrer nofollow"
                 class="underline decoration-dotted underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400">${t}</a>`:`<span>${t}</span>`});return t.length?`<p class="texte-secable mt-3 text-xs text-slate-500 dark:text-slate-400">Source${t.length>1?`s`:``} : ${t.join(` · `)}</p>`:``}function y(e,t){let n=t.length?m({titre:e.titre??``,mots_cles:e.mots_cles},t,g):[],r=h(e,i());if(!r&&!n.length)return``;let o=r?`<span class="font-medium text-indigo-700 dark:text-indigo-300">Lien avec le programme —</span> ${c(r)}`:`<span class="font-medium text-indigo-700 dark:text-indigo-300">À réviser avec</span>`,s=n.map(({fiche:e})=>`<a href="${a(`/fiche/`)}?id=${encodeURIComponent(e.id)}"
            title="${c(e.matiere)} · ${c(e.fascicule)}"
            class="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-slate-800">
           <span aria-hidden="true">📄</span><span class="texte-secable line-clamp-2 text-left">${c(e.titre)}</span>
         </a>`).join(``);return`<div class="texte-secable mt-3 rounded-lg border-l-2 border-indigo-300 bg-indigo-50/60 px-3 py-2 text-sm text-slate-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-slate-300">
            <p>${o}</p>
            ${s?`<div class="mt-2 flex flex-wrap gap-1.5">${s}</div>`:``}
          </div>`}function b(e){let t=document.createElement(`article`);return t.className=`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700`,t.innerHTML=`
    ${e.entete??``}
    <div class="flex items-baseline justify-between gap-3">
      <p class="etiquette ${e.classeEtiquette}">${c(e.etiquette)}</p>
      ${e.mention?`<span class="shrink-0 text-xs text-slate-400 dark:text-slate-500">${c(e.mention)}</span>`:``}
    </div>
    <h3 class="texte-secable mt-1.5 leading-snug font-semibold text-slate-900 dark:text-white">${c(e.titre)}</h3>
    ${e.corps}`,t}function x(e){let{contenu:t,ouvrir:n,fermer:r,classe:i=``,borner:a=!0}=e;return`<details class="depliant ${i}">
            <summary>
              <span class="depliant-ouvrir">${c(n)}</span>
              <span class="depliant-fermer">${c(r)}</span>
            </summary>
            <div class="${a?`depliant-corps `:``}mt-2">${t}</div>
          </details>`}function S(e,t=180){if(e.length<=t*1.4)return[e,``];let n=e.slice(t).search(/[.!?]\s/);if(n===-1)return[e,``];let r=t+n+1;return[e.slice(0,r).trim(),e.slice(r).trim()]}var C=[{cle:`pib`,libelle:`PIB`},{cle:`dette`,libelle:`Dette publique`},{cle:`dette_pct_pib`,libelle:`Dette en % du PIB`},{cle:`deficit`,libelle:`Déficit public`},{cle:`inflation`,libelle:`Inflation`}];function w(e){if(!e)return``;let t=C.filter(t=>e[t.cle]),n=Object.keys(e).filter(e=>!C.some(t=>t.cle===e)).map(e=>({cle:e,libelle:e.replace(/_/g,` `)})),r=[...t,...n].map(({cle:t,libelle:n})=>{let r=e[t],i=r.source?.nom?r.source.url?`<a href="${c(r.source.url)}" target="_blank" rel="noopener noreferrer nofollow"
              class="underline decoration-dotted underline-offset-2">${c(r.source.nom)}</a>`:c(r.source.nom):``;return`<div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p class="etiquette text-slate-500 dark:text-slate-400">${c(n)}</p>
              <p class="texte-secable mt-1 text-xl font-bold text-slate-900 dark:text-white">${c(r.valeur??`—`)}</p>
              ${r.periode_reference?`<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">${c(r.periode_reference)}</p>`:``}
              ${i?`<p class="texte-secable mt-1 text-[11px] text-slate-400 dark:text-slate-500">${i}</p>`:``}
            </div>`});return r.length?`<div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">${r.join(``)}</div>`:``}var T=3;function E(e,t){if(!e?.length)return``;let n=[...e].sort((e,t)=>(t.date??``).localeCompare(e.date??``)).map(e=>`
      <li class="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
        ${e.date?`<p class="text-xs font-medium text-slate-500 dark:text-slate-400">${c(o(e.date))}</p>`:``}
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${c(e.titre)}</p>
        <p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${c(e.resume)}</p>
        ${y(e,t)}
        ${v(e.sources)}
      </li>`),r=n.slice(0,T),i=n.slice(T),a=`<ol class="mt-3 space-y-4">${r.join(``)}</ol>`;if(!i.length)return a;let s=i.length;return a+x({classe:`mt-3`,ouvrir:`Voir plus (${s} entrée${s>1?`s`:``} plus ancienne${s>1?`s`:``})`,fermer:`Voir moins`,contenu:`<ol class="space-y-4 pr-1">${i.join(``)}</ol>`})}function D(e,t,n){if(!e)return``;let r=`texte-secable ${n} text-sm text-slate-600 dark:text-slate-300`,i=`<p class="${r}">${c(e)}</p>`;return t?i+x({classe:`mt-1`,ouvrir:`Voir plus`,fermer:`Voir moins`,borner:!1,contenu:`<p class="${r.replace(n,`mt-0`)}">${c(t)}</p>`}):i}function O(e,t=[]){let n=e.resume??e.texte_contextuel??``,r=e.texte_contextuel&&e.resume?e.texte_contextuel:``,[i,a]=S(n),[s,c]=S(r),l=b({etiquette:`Suivi permanent`,classeEtiquette:`text-slate-500 dark:text-slate-400`,titre:e.titre,mention:e.derniere_maj?o(e.derniere_maj):void 0,corps:`
      ${w(e.indicateurs)}
      ${D(i,a,`mt-3`)}
      ${D(s,c,`mt-2`)}
      ${E(e.historique,t)}
      ${e.historique?.length?``:y(e,t)}
      ${v(e.sources)}`});return M(l),l}function k(e){let n=document.createElement(`section`);return n.className=`rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30`,n.innerHTML=`
    <p class="etiquette text-indigo-700 dark:text-indigo-300">Tendances de fond</p>
    <div class="mt-2 space-y-3">${e.map(e=>{let n=e.domaine?t(e.domaine):null;return`<div>
        ${n?`<p class="etiquette ${n.classe}">${c(n.libelle)}</p>`:``}
        ${e.titre?`<p class="texte-secable mt-0.5 font-semibold text-slate-900 dark:text-white">${c(e.titre)}</p>`:``}
        <p class="texte-secable mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">${c(e.texte)}</p>
      </div>`}).join(``)}</div>`,n}function A(t){let n=document.createElement(`ul`);return n.className=`flex flex-wrap gap-x-4 gap-y-1.5`,n.innerHTML=e.filter(e=>!t||t.has(e)).map(e=>`<li class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
           <span class="h-2.5 w-2.5 shrink-0 rounded-full ${r[e].pastille}" aria-hidden="true"></span>
           ${c(r[e].libelle)}
         </li>`).join(``),n}function j(e){let n=document.createElement(`ol`);return n.className=`relative ml-1 space-y-4 border-l border-slate-300 pl-5 dark:border-slate-700`,n.innerHTML=e.map(e=>{let n=t(e.domaine);return`<li class="relative">
        <span class="absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full ring-2 ring-white ${`pastille`in n?n.pastille:`bg-slate-400`} dark:ring-slate-900" aria-hidden="true"></span>
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">${c(o(e.date)||e.date)}</p>
        <p class="texte-secable font-medium text-slate-900 dark:text-white">${c(e.libelle)}</p>
        ${e.detail?`<p class="texte-secable mt-0.5 text-sm text-slate-600 dark:text-slate-300">${c(e.detail)}</p>`:``}
        <p class="etiquette mt-0.5 ${n.classe}">${c(n.libelle)}</p>
      </li>`}).join(``),n}function M(e){e.dataset.rattachements=String(e.querySelectorAll(`a[href*="/fiche/"]`).length)}function N(e,r=[]){let a=t(n(e)),o=e.image?.url?`<figure class="-mx-4 -mt-4 mb-3 overflow-hidden bg-slate-100 dark:bg-slate-800">
         <img src="${c(e.image.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"
              class="aspect-video w-full max-w-full object-cover" onerror="this.closest('figure').remove()" />
         ${e.image.credit?`<figcaption class="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">${c(e.image.credit)}</figcaption>`:``}
       </figure>`:``,s=b({etiquette:a.libelle,classeEtiquette:a.classe,titre:e.titre??``,entete:o,corps:`
      <p class="texte-secable mt-2 text-sm text-slate-600 dark:text-slate-300">${c(e.resume??``)}</p>
      ${y(e,r)}
      ${v(e.sources)}`});s.dataset.domaine=n(e),M(s);let d=document.createElement(`div`);return d.className=`mt-3`,d.appendChild(u({titre:`Demander à l’IA — actualité`,construireContexte:async()=>l({titre:e.titre??``,resume:e.resume??``,date:e.date??``,domaine:t(n(e)).libelle,sources:(e.sources??[]).map(e=>({nom:e.nom??``,url:e.url})),lienCours:h(e,i()),motsCles:e.mots_cles})},`Demander à l’IA`)),s.appendChild(d),s}function P(e){let t=document.createElement(`p`);return t.className=`rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400`,t.textContent=e,t}export{j as a,p as c,_ as i,O as n,A as o,N as r,P as s,k as t};