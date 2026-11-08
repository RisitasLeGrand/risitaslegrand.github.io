import{n as e}from"./ui.fu2Fklbg.js";import{l as t}from"./jour-logique.CeW1yrKs.js";import{t as n}from"./chargement.d-VVZ9KX.js";import{i as r,n as i}from"./profil.N6XNPM4A.js";import{a,c as o,i as s,n as c,o as l,r as u,s as d}from"./registre-usages.I8CXIaRc.js";import{t as f}from"./etat-personne.BUy2Oemi.js";var p={tranche_age:`votre tranche d’âge`,majeur:`si vous êtes majeur(e), sans votre âge`,sexe_physio:`votre sexe`,suivi_cycle:`si le suivi est actif`,statut_hormonal:`votre statut hormonal`},m={actif:{texte:`actif`,classe:`bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200`},coupe:{texte:`coupé`,classe:`bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300`},"inconnu-faute-de-donnee":{texte:`inconnu faute de donnée`,classe:`bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`},"attend-une-source":{texte:`en attente d’une source`,classe:`bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200`}},h=[],g,_=`aucune`,v=()=>_===`sans-age`?d(g):_===`sans-sexe`?o(g):g;function y(t,n,r){let i=s(t.id,n,r,h),a=m[l(t.id,h,i)],o=t.clesLues.map(e=>p[e]).join(`, `),c=t.fondement.type===`source-a-obtenir`?`<p class="mt-2 text-sm text-sky-800 dark:text-sky-300">Attend : ${e(t.fondement.laquelle)}. Tant qu’elle n’est pas vérifiée, rien n’est affiché.</p>`:``;return`
        <li class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800" data-usage="${e(t.id)}">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-slate-900 dark:text-white">${e(t.rubrique)}</p>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">${e(t.but)}</p>
            </div>
            <span class="shrink-0 rounded-full px-2 py-1 text-xs font-medium ${a.classe}">${e(a.texte)}</span>
          </div>
          <dl class="mt-3 space-y-1 text-sm">
            <div><dt class="inline font-medium text-slate-700 dark:text-slate-200">Lit :</dt>
              <dd class="inline text-slate-600 dark:text-slate-300"> ${e(o)}</dd></div>
            <div><dt class="inline font-medium text-slate-700 dark:text-slate-200">Vous verrez :</dt>
              <dd class="inline text-slate-600 dark:text-slate-300"> ${e(t.effetVisible)}</dd></div>
            <div><dt class="inline font-medium text-slate-700 dark:text-slate-200">Si la donnée manque :</dt>
              <dd class="inline text-slate-600 dark:text-slate-300"> ${e(t.siInconnu)}</dd></div>
          </dl>
          ${c}
          <label class="mt-3 flex min-h-11 items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" data-couper="${e(t.id)}" ${h.includes(t.id)?``:`checked`}
              class="size-5 rounded border-slate-400 dark:border-slate-600" />
            Autoriser cet usage
          </label>
        </li>`}function b(){let e=t(new Date),n=v(),i=document.getElementById(`afficher-sensibles`)?.checked,o=u.filter(e=>i||!a(e)),s=document.getElementById(`liste`);s.innerHTML=o.map(t=>y(t,n,e)).join(``);let c=u.length-o.length;c>0&&s.insertAdjacentHTML(`beforeend`,`<li class="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
             ${c===1?`Un usage sensible est replié`:`${c} usages sensibles sont repliés`}. Cochez la case en haut pour les voir.
           </li>`);for(let e of s.querySelectorAll(`[data-couper]`))e.addEventListener(`change`,async()=>{let t=e.dataset.couper;h=e.checked?h.filter(e=>e!==t):[...new Set([...h,t])],await r(`usagesCoupes`,h),b()})}function x(){let e=document.getElementById(`bandeau-simulation`),t=document.getElementById(`fin-simulation`);if(_===`aucune`){e.classList.add(`hidden`),t.classList.add(`hidden`);return}e.textContent=_===`sans-age`?`Simulation : la liste ci-dessus est celle que vous auriez sans votre année de naissance. Rien n’a été modifié.`:`Simulation : la liste ci-dessus est celle que vous auriez sans votre sexe. Rien n’a été modifié.`,e.classList.remove(`hidden`),t.classList.remove(`hidden`)}n(async()=>{g=await f();let t=await i(`usagesCoupes`);h=Array.isArray(t?.valeur)?t.valeur:[],document.getElementById(`non-usages`).innerHTML=c.map(t=>`
          <li>
            <p class="font-medium text-slate-800 dark:text-slate-100">${e(t.rubrique)} — ${e(t.ecarte)}</p>
            <p class="mt-1 text-slate-600 dark:text-slate-300">${e(t.raison)}</p>
          </li>`).join(``),document.getElementById(`afficher-sensibles`).addEventListener(`change`,b),document.getElementById(`sans-age`).addEventListener(`click`,()=>{_=`sans-age`,x(),b()}),document.getElementById(`sans-sexe`).addEventListener(`click`,()=>{_=`sans-sexe`,x(),b()}),document.getElementById(`fin-simulation`).addEventListener(`click`,()=>{_=`aucune`,x(),b()}),b(),document.getElementById(`chargement`).classList.add(`hidden`),document.getElementById(`vue`).classList.remove(`hidden`)});