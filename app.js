const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DEFAULT_CAT_COLORS={'alimentação':'#f87171','transporte':'#fbbf24','moradia':'#60a5fa','saúde':'#3ecf8e','lazer':'#c084fc','educação':'#fb923c','salário':'#34d399','mercado':'#38bdf8','assinaturas':'#a78bfa','viagens':'#22d3ee','beleza':'#f9a8d4','contas':'#64748b','outras receitas':'#10b981','compras':'#e879f9','pet shop':'#f59e0b','veterinário':'#84cc16','outros':'#94a3b8'};
const DEFAULT_CAT_ICONS={'alimentação':'🍽','transporte':'🚗','moradia':'🏠','saúde':'💊','lazer':'🎮','educação':'📚','salário':'💼','mercado':'🛒','assinaturas':'📺','viagens':'✈️','beleza':'💅','contas':'📄','outras receitas':'💰','compras':'🛍','pet shop':'🐶','veterinário':'🐾','outros':'📦'};
const DEFAULT_CAT_KEYS=new Set(Object.keys(DEFAULT_CAT_ICONS));
let CAT_COLORS={...DEFAULT_CAT_COLORS};
let CAT_ICONS={...DEFAULT_CAT_ICONS};
let customCategories=[]; // [{key,name,icon,color}]
function applyCustomCategories(){
  CAT_COLORS={...DEFAULT_CAT_COLORS};
  CAT_ICONS={...DEFAULT_CAT_ICONS};
  customCategories.forEach(c=>{CAT_COLORS[c.key]=c.color;CAT_ICONS[c.key]=c.icon;});
}
function isCustomCategory(key){return customCategories.some(c=>c.key===key);}
function catLabel(key){return (CAT_ICONS[key]||'📦')+' '+(key.charAt(0).toUpperCase()+key.slice(1));}
function allCategoryKeys(){return Object.keys(CAT_ICONS);}
const RESP_PALETTE=['#7c6ff7','#3ecf8e','#f87171','#fbbf24','#60a5fa','#c084fc','#fb923c','#34d399'];

// ── MONEY INPUT FORMATTER ──
function formatMoneyInput(value){
  const digits=value.replace(/\D/g,'');
  if(!digits) return '';
  const num=parseInt(digits,10);
  const reais=Math.floor(num/100);
  const cents=String(num%100).padStart(2,'0');
  return 'R$ '+reais.toLocaleString('pt-BR')+','+cents;
}
function parseMoneyInput(str){
  const digits=str.replace(/\D/g,'');
  if(!digits) return 0;
  return parseInt(digits,10)/100;
}
function setMoneyValue(el,num){
  if(!num&&num!==0){el.value='';return;}
  const cents=Math.round(num*100);
  const reais=Math.floor(cents/100);
  const c=String(cents%100).padStart(2,'0');
  el.value='R$ '+reais.toLocaleString('pt-BR')+','+c;
}
function initMoneyInputs(){
  document.querySelectorAll('.money-input').forEach(el=>{
    if(el._moneyBound) return;
    el._moneyBound=true;
    el.addEventListener('input',function(){
      const pos=this.value.length;
      this.value=formatMoneyInput(this.value);
      this.dispatchEvent(new Event('moneychange'));
    });
  });
}

let now=new Date(), currentYear=now.getFullYear(), currentMonth=now.getMonth();
let formType='expense', isRecurringForm=false, selectedResp=null, editingRecurId=null;
let recurType='none'; // 'none' | 'infinite' | 'installment'
let currentFileName='montra.json';
let transactions=[], recurring=[], responsibles=[], paidMonths=[], closedMonths=[], budgets={}, investments=[];
let settings={closeDay:null,dueDay:null,autoClose:false};
let charts={};
let pendingDeleteId=null;
let annualYear=new Date().getFullYear();

const LS_KEY='montra_data';
const LS_THEME='montra_theme';
const LS_LAST_EXPORT='montra_last_export';

function applyTheme(theme){
  if(theme==='light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  const ic=document.getElementById('theme-icon');
  const lb=document.getElementById('theme-label');
  if(ic) ic.textContent=theme==='light'?'☀️':'🌙';
  if(lb) lb.textContent=theme==='light'?'Tema escuro':'Tema claro';
  // Repintar charts se na aba ativa
  const chartsPage=document.getElementById('page-charts');
  if(chartsPage&&chartsPage.classList.contains('active')) renderCharts();
}
function toggleTheme(){
  const cur=localStorage.getItem(LS_THEME)==='light'?'light':'dark';
  const nxt=cur==='light'?'dark':'light';
  localStorage.setItem(LS_THEME,nxt);
  applyTheme(nxt);
}
// Aplicar tema imediatamente no carregamento (antes do DOM completo)
(function(){try{applyTheme(localStorage.getItem(LS_THEME)||'dark');}catch(e){}})();
function saveToLS(){
  try{localStorage.setItem(LS_KEY,JSON.stringify({version:'1.0',savedAt:new Date().toISOString(),transactions,recurring,responsibles,paidMonths,closedMonths,budgets,investments,settings,customCategories}));}catch(e){}
}

function buildFileName(){
  const d=new Date();
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yyyy=d.getFullYear();
  const hh=String(d.getHours()).padStart(2,'0');
  const min=String(d.getMinutes()).padStart(2,'0');
  return `DB${dd}${mm}${yyyy}T${hh}${min}.json`;
}
let editsSinceExport=0;
function markUnsaved(){
  saveToLS();
  editsSinceExport++;
  updateSaveBtnBadge();
  maybeShowBackupBanner();
}
function markSaved(){
  editsSinceExport=0;
  localStorage.setItem(LS_LAST_EXPORT,Date.now().toString());
  updateSaveBtnBadge();
  const b=document.getElementById('backup-banner');
  if(b) b.style.display='none';
}
function updateSaveBtnBadge(){
  const btn=document.getElementById('save-btn');
  if(!btn) return;
  if(editsSinceExport>0){
    btn.classList.add('unsaved');
    btn.title=`${editsSinceExport} alteração(ões) não exportadas`;
  } else {
    btn.classList.remove('unsaved');
    btn.title='Exportar backup';
  }
}
function maybeShowBackupBanner(){
  const b=document.getElementById('backup-banner');
  if(!b) return;
  const lastExp=parseInt(localStorage.getItem(LS_LAST_EXPORT)||'0');
  const days=(Date.now()-lastExp)/(1000*60*60*24);
  const neverExported=!lastExp;
  if(editsSinceExport>=15 || (lastExp && days>=7 && editsSinceExport>0) || (neverExported && editsSinceExport>=5)){
    let msg;
    if(neverExported) msg=`Você tem ${editsSinceExport} alteração(ões) sem backup. Exporte para não perder dados.`;
    else if(days>=7) msg=`Última exportação há ${Math.floor(days)} dias · ${editsSinceExport} alteração(ões) pendentes.`;
    else msg=`${editsSinceExport} alterações sem backup — considere exportar.`;
    b.innerHTML=`<span>💾 ${msg}</span><button class="backup-banner-btn" onclick="saveToFile()">Exportar agora</button><button class="backup-banner-close" onclick="document.getElementById('backup-banner').style.display='none'" title="Dispensar">✕</button>`;
    b.style.display='flex';
  } else {
    b.style.display='none';
  }
}

// ── WELCOME ──
function continueFromLS(){startApp('dados salvos');}
function triggerFileInput(){document.getElementById('file-input').click();}

function loadFromFile(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      transactions=data.transactions||[];
      recurring=data.recurring||[];
      responsibles=data.responsibles||[];
      paidMonths=data.paidMonths||[];
      closedMonths=data.closedMonths||[];
      budgets=data.budgets||{};
      investments=data.investments||[];
      settings=Object.assign({closeDay:null,dueDay:null,autoClose:false},data.settings||{});
      currentFileName=file.name;
      migrateInvoiceKeys();
      saveToLS();
      startApp(file.name);
    }catch(err){alert('Arquivo JSON inválido. Verifique o arquivo e tente novamente.');}
  };
  reader.readAsText(file);
  e.target.value='';
}

function createNew(){
  transactions=[]; recurring=[]; responsibles=[]; paidMonths=[]; closedMonths=[]; budgets={}; investments=[]; settings={closeDay:null,dueDay:null,autoClose:false};
  currentFileName='montra.json';
  startApp('novo arquivo');
}

function startApp(label){
  saveToLS();
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('app-screen').style.display='block';
  document.getElementById('session-name-label').textContent=label;
  currentYear=now.getFullYear(); currentMonth=now.getMonth();
  runAutoClose();
  applyRecurrences();
  render();
  document.querySelectorAll('.tab').forEach((t,i)=>{t.classList.toggle('active',i===0);});
  document.querySelectorAll('.page').forEach((p,i)=>{p.classList.toggle('active',i===0);});
  applyTheme(localStorage.getItem(LS_THEME)||'dark');
  updateSaveBtnBadge();
  maybeShowBackupBanner();
  maybeShowDueBanner();
}

function closeSession(){
  document.getElementById('app-screen').style.display='none';
  document.getElementById('welcome-screen').classList.remove('hidden');
  Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}});
  charts={};
}

// ── SAVE TO FILE ──
function saveToFile(){
  const data={version:'1.0',savedAt:new Date().toISOString(),transactions,recurring,responsibles,paidMonths,closedMonths,budgets,investments,settings};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=buildFileName();
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  markSaved(); showToast();
}

function showToast(){
  const t=document.getElementById('toast');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}
function showRollToast(msg){
  const t=document.getElementById('toast');
  const prev=t.textContent;
  t.textContent='ℹ️ '+msg;
  t.classList.add('show');
  setTimeout(()=>{t.classList.remove('show');t.textContent=prev;},3000);
}

// ── DATA HELPERS ──
function monthKey(y,m){return `${y}-${String(m+1).padStart(2,'0')}`}
function isMonthPaid(y,m){return paidMonths.includes(monthKey(y,m))}
function isMonthClosed(y,m){return closedMonths.includes(monthKey(y,m))}
function isMonthLocked(y,m){return isMonthPaid(y,m)||isMonthClosed(y,m)}
function currentKey(){return monthKey(currentYear,currentMonth)}
function isCurrentPaid(){return isMonthPaid(currentYear,currentMonth)}
function isCurrentClosed(){return isMonthClosed(currentYear,currentMonth)}
function isCurrentLocked(){return isMonthLocked(currentYear,currentMonth)}
function getTxInvoiceKey(t){return t.invoiceKey||t.date.slice(0,7)}
function nextOpenInvoiceKey(y,m){let yy=y,mm=m;for(let i=0;i<240;i++){if(!isMonthLocked(yy,mm))return monthKey(yy,mm);mm++;if(mm>11){mm=0;yy++;}}return monthKey(y,m);}
function resolveInvoiceForDate(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  let y=d.getFullYear(), m=d.getMonth();
  // Se há dia de fechamento configurado e a data ultrapassou esse dia, fatura é do mês seguinte
  if(settings.closeDay&&d.getDate()>settings.closeDay){
    m++;
    if(m>11){m=0;y++;}
  }
  return nextOpenInvoiceKey(y,m);
}
function migrateInvoiceKeys(){let changed=false;transactions.forEach(t=>{if(!t.invoiceKey&&t.date){t.invoiceKey=t.date.slice(0,7);changed=true;}});if(changed) saveToLS();}
function getRespColor(id){const idx=responsibles.findIndex(r=>r.id===id);return idx>=0?RESP_PALETTE[idx%RESP_PALETTE.length]:'#94a3b8';}
function getRespName(id){const r=responsibles.find(x=>x.id===id);return r?r.name:'—';}
function getRespInitials(id){const n=getRespName(id);return n==='—'?'?':n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function fmt(v){return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function getCurrentTxs(){const k=currentKey();return transactions.filter(t=>getTxInvoiceKey(t)===k).sort((a,b)=>b.date.localeCompare(a.date));}
function getMonthTxs(y,m){const k=monthKey(y,m);return transactions.filter(t=>getTxInvoiceKey(t)===k);}

// Count how many installments of a recurring have been applied (only closed months)
function getInstallmentCount(recurId){
  return transactions.filter(t=>t.recurId===recurId).length;
}
function getPaidInstallmentCount(recurId){
  return transactions.filter(t=>{
    if(t.recurId!==recurId) return false;
    const d=new Date(t.date+'T12:00:00');
    return isMonthPaid(d.getFullYear(),d.getMonth());
  }).length;
}

function applyRecurrences(){
  if(isCurrentLocked()) return;
  const curKey=currentKey();
  const m=String(currentMonth+1).padStart(2,'0');
  let changed=false;
  recurring.forEach(r=>{
    if(r.manualOnly) return;
    if(r.isInstallment){
      let sYear=r.startYear, sMonth=r.startMonth;
      if(sYear==null||sMonth==null){
        const firstTx=transactions.filter(t=>t.recurId===r.id).sort((a,b)=>a.date.localeCompare(b.date))[0];
        if(!firstTx) return;
        const d=new Date(firstTx.date+'T12:00:00');
        sYear=d.getFullYear(); sMonth=d.getMonth();
        r.startYear=sYear; r.startMonth=sMonth;
      }
      const curOffset=(currentYear-sYear)*12+(currentMonth-sMonth);
      if(curOffset<0) return;
      const existing=new Set(transactions.filter(t=>t.recurId===r.id).map(t=>t.installmentNum));
      for(let o=0;o<=curOffset&&o<r.totalInstallments;o++){
        const num=o+1;
        if(existing.has(num)) continue;
        let ty=sYear, tm=sMonth+o;
        while(tm>11){tm-=12;ty++;}
        const ownKey=monthKey(ty,tm);
        // Only land here if this month is the invoice destination for that theoretical month
        if(ownKey!==curKey && !isMonthLocked(ty,tm)) continue;
        if(isMonthLocked(ty,tm) && nextOpenInvoiceKey(ty,tm)!==curKey) continue;
        const theoreticalM=String(tm+1).padStart(2,'0');
        transactions.push({
          id:'r'+Date.now()+Math.random(),
          desc:r.desc,amount:r.amount,type:r.type,category:r.category,
          date:`${ty}-${theoreticalM}-01`,
          invoiceKey:curKey,
          recurId:r.id,respId:r.respId||null,
          installmentNum:num,
          totalInstallments:r.totalInstallments
        });
        changed=true;
      }
    } else {
      const firstTx=transactions.filter(t=>t.recurId===r.id).sort((a,b)=>a.date.localeCompare(b.date))[0];
      if(!firstTx) return;
      if(`${currentYear}-${m}`<firstTx.date.slice(0,7)) return;
      const already=transactions.some(t=>t.recurId===r.id&&getTxInvoiceKey(t)===curKey);
      if(already) return;
      transactions.push({
        id:'r'+Date.now()+Math.random(),
        desc:r.desc,amount:r.amount,type:r.type,category:r.category,
        date:`${currentYear}-${m}-01`,
        invoiceKey:curKey,
        recurId:r.id,respId:r.respId||null
      });
      changed=true;
    }
  });
  if(changed) saveToLS();
}

// ── RENDER ──
function render(){
  document.getElementById('month-label').textContent=MONTHS[currentMonth]+' '+currentYear;
  const paid=isCurrentPaid();
  const closed=isCurrentClosed();
  const banner=document.getElementById('lock-banner-area');
  const closeBtn=document.getElementById('pay-month-btn');
  const payBtn=document.getElementById('pay-invoice-btn');
  const badgeArea=document.getElementById('paid-badge-area');
  const addBtn=document.getElementById('add-tx-btn');
  if(paid){
    banner.innerHTML=`<div class="lock-banner"><div class="lock-banner-left"><span style="font-size:20px">🔒</span><div><div class="lock-title">Fatura paga — somente leitura</div><div class="lock-sub">${MONTHS[currentMonth]} ${currentYear}</div></div></div><button class="unlock-btn" onclick="openUnlockModal()">🔓 Reabrir</button></div>`;
    badgeArea.innerHTML=`<span class="paid-badge"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Pago</span>`;
    closeBtn.style.display='none'; if(payBtn) payBtn.style.display='none'; addBtn.disabled=true;
  } else if(closed){
    banner.innerHTML=`<div class="lock-banner"><div class="lock-banner-left"><span style="font-size:20px">📋</span><div><div class="lock-title">Fatura fechada</div><div class="lock-sub">Novos lançamentos vão para a próxima fatura aberta</div></div></div><button class="unlock-btn" onclick="openUnlockModal()">🔓 Reabrir</button></div>`;
    badgeArea.innerHTML=`<span class="paid-badge" style="background:var(--surface2);color:var(--text2)">📋 Fechada</span>`;
    closeBtn.style.display='none'; if(payBtn) payBtn.style.display='flex'; addBtn.disabled=false;
  } else {
    banner.innerHTML=''; badgeArea.innerHTML=''; closeBtn.style.display='flex'; if(payBtn) payBtn.style.display='none'; addBtn.disabled=false;
  }
  renderMonthHeatmap();
  const txs=getCurrentTxs();
  const income=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  document.getElementById('total-income').textContent=fmt(income);
  document.getElementById('total-expense').textContent=fmt(expense);
  document.getElementById('total-balance').textContent=fmt(balance);
  document.getElementById('income-count').textContent=txs.filter(t=>t.type==='income').length+' transações';
  document.getElementById('expense-count').textContent=txs.filter(t=>t.type==='expense').length+' transações';
  document.getElementById('balance-label').textContent=balance>=0?'saldo positivo ↑':'saldo negativo ↓';
  document.getElementById('total-balance').style.color=balance>=0?'var(--green)':'var(--red)';

  // Próxima fatura aberta (após a atual)
  let ny=currentYear, nm=currentMonth+1;
  if(nm>11){nm=0;ny++;}
  const nextKey=nextOpenInvoiceKey(ny,nm);
  const nextTxs=transactions.filter(t=>getTxInvoiceKey(t)===nextKey);
  const nextExp=nextTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const [nextYr,nextMo]=nextKey.split('-');
  document.getElementById('next-invoice-value').textContent=fmt(nextExp);
  document.getElementById('next-invoice-sub').textContent=`${MONTHS_SHORT[parseInt(nextMo)-1]}/${nextYr} · ${nextTxs.length} lançamento${nextTxs.length!==1?'s':''}`;

  // Orçamento do mês
  const budgetCard=document.getElementById('budget-summary-card');
  const totalBudget=Object.values(budgets).reduce((s,v)=>s+v,0);
  if(totalBudget>0){
    const pct=Math.round(expense/totalBudget*100);
    budgetCard.style.display='';
    const valEl=document.getElementById('budget-summary-value');
    valEl.textContent=`${pct}%`;
    valEl.style.color=pct>100?'var(--red)':pct>80?'var(--amber)':'var(--green)';
    document.getElementById('budget-summary-sub').textContent=`${fmt(expense)} / ${fmt(totalBudget)}`;
  } else {
    budgetCard.style.display='none';
  }

  // Populate filter dropdowns
  const catSelect=document.getElementById('tx-filter-cat');
  const currentCatVal=catSelect.value;
  catSelect.innerHTML='<option value="">Todas categorias</option>'+Object.keys(CAT_ICONS).map(c=>`<option value="${c}"${c===currentCatVal?' selected':''}>${CAT_ICONS[c]} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('');
  const respSelect=document.getElementById('tx-filter-resp');
  const currentRespVal=respSelect.value;
  respSelect.innerHTML='<option value="">Todos responsáveis</option>'+responsibles.map(r=>`<option value="${r.id}"${r.id===currentRespVal?' selected':''}>${r.name}</option>`).join('');

  // Apply search, filters, sort
  const searchTerm=(document.getElementById('tx-search').value||'').toLowerCase();
  const filterType=document.getElementById('tx-filter-type').value;
  const filterCat=catSelect.value;
  const filterResp=respSelect.value;
  const sortMode=document.getElementById('tx-sort').value;

  let filtered=txs.filter(t=>{
    if(searchTerm&&!t.desc.toLowerCase().includes(searchTerm)&&!(t.note&&t.note.toLowerCase().includes(searchTerm))) return false;
    if(filterType&&t.type!==filterType) return false;
    if(filterCat&&t.category!==filterCat) return false;
    if(filterResp&&t.respId!==filterResp) return false;
    return true;
  });

  if(sortMode==='date-asc') filtered.sort((a,b)=>a.date.localeCompare(b.date));
  else if(sortMode==='date-desc') filtered.sort((a,b)=>b.date.localeCompare(a.date));
  else if(sortMode==='amount-desc') filtered.sort((a,b)=>b.amount-a.amount);
  else if(sortMode==='amount-asc') filtered.sort((a,b)=>a.amount-b.amount);
  else if(sortMode==='cat') filtered.sort((a,b)=>a.category.localeCompare(b.category));


  // Installment alerts
  const alertArea=document.getElementById('installment-alert-area');
  const activeInstalls=recurring.filter(r=>{
    if(!r.isInstallment) return false;
    const has=transactions.some(t=>t.recurId===r.id&&t.date.startsWith(`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`));
    return has&&getInstallmentCount(r.id)<r.totalInstallments;
  });
  if(activeInstalls.length&&!paid){
    alertArea.innerHTML=`<div class="alert-banner"><span class="alert-banner-icon">📋</span><div class="alert-banner-text"><strong>${activeInstalls.length} parcela${activeInstalls.length>1?'s':''}</strong> neste mês: ${activeInstalls.map(r=>`${r.desc} (${fmt(r.amount)})`).join(', ')}</div></div>`;
  } else { alertArea.innerHTML=''; }

  const list=document.getElementById('tx-list');
  if(!filtered.length){
    list.innerHTML=`<div class="empty"><div class="empty-icon">${txs.length?'🔍':'📭'}</div><div>${txs.length?'Nenhuma transação encontrada com esses filtros':'Nenhuma transação neste mês'}</div></div>`;
  } else {
    list.innerHTML=filtered.map(t=>{
      const color=getRespColor(t.respId),initials=getRespInitials(t.respId),name=getRespName(t.respId);
      const sid=String(t.id);

      // Badge: rolled from closed invoice
      const txMonthKey=t.date.slice(0,7);
      const invKey=getTxInvoiceKey(t);
      const rolledBadge=(invKey!==txMonthKey)?`<span class="install-badge" title="Realizada em ${txMonthKey.slice(5)}/${txMonthKey.slice(0,4)}" style="background:#fbbf2422;color:#d97706">🔄</span>`:'';
      // Badge: installment or recurring
      let badge='';
      if(t.recurId){
        if(t.installmentNum){
          const installTxs=transactions.filter(tx=>tx.recurId===t.recurId).sort((a,b)=>a.date.localeCompare(b.date));
          const actualNum=installTxs.findIndex(tx=>tx.id===t.id)+1;
          badge=`<span class="install-badge">${actualNum}/${t.totalInstallments}</span>`;
        } else {
          badge='<span class="recur-badge">↻</span>';
        }
      } else if(t.installmentNum&&t.totalInstallments){
        badge=`<span class="install-badge">${t.installmentNum}/${t.totalInstallments}</span>`;
      }

      return `<div class="tx-item${paid?' locked':''}${t.paid?' tx-checked':''}" data-txid="${sid}">
        ${paid?'<div class="tx-paid-dot"></div>':`<button class="tx-check${t.paid?' checked':''}" data-check="${sid}" title="${t.paid?'Desmarcar':'Marcar como pago'}"></button>`}
        <div class="tx-icon" style="background:${CAT_COLORS[t.category]||'#94a3b8'}22">${CAT_ICONS[t.category]||'📦'}</div>
        <div class="tx-info">
          <div class="tx-name">${escHtml(t.desc)}${badge}${rolledBadge}</div>
          <div class="tx-meta"><span style="color:var(--text3)">${t.category}</span>${t.respId?`<span class="resp-chip" style="background:${color}22;color:${color}"><span style="width:14px;height:14px;border-radius:50%;background:${color};display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff">${initials}</span>${name}</span>`:''}</div>
          ${t.note?`<div class="tx-note">📝 ${escHtml(t.note)}</div>`:''}
        </div>
        <div class="tx-date">${t.date.slice(8,10)}/${t.date.slice(5,7)}</div>
        <div class="tx-amount ${t.type==='income'?'pos':'neg'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
        ${paid?'':'<button class="tx-del" data-del="'+sid+'">✕</button>'}
      </div>`;
    }).join('');
  }

  const expTxs=txs.filter(t=>t.type==='expense');
  const totalExp=expTxs.reduce((s,t)=>s+t.amount,0);
  const catTotals={};expTxs.forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+t.amount;});
  document.getElementById('cat-list').innerHTML=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
    const pct=totalExp>0?Math.round(amt/totalExp*100):0;
    return `<div class="cat-item"><div class="cat-dot" style="background:${CAT_COLORS[cat]||'#94a3b8'}"></div><div class="cat-name">${CAT_ICONS[cat]||'📦'} ${cat.charAt(0).toUpperCase()+cat.slice(1)}</div><div class="cat-amount" style="color:${CAT_COLORS[cat]||'#94a3b8'};font-size:12px">${fmt(amt)}</div><div class="cat-pct">${pct}%</div></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${CAT_COLORS[cat]||'#94a3b8'}"></div></div>`;
  }).join('')||'<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Sem despesas</div>';

  // Budget rendering
  const budgetList=document.getElementById('budget-list');
  const allCats=Object.keys(CAT_ICONS);
  const catsWithBudget=allCats.filter(c=>budgets[c]&&budgets[c]>0);
  const catsWithout=allCats.filter(c=>!budgets[c]||budgets[c]<=0);
  if(catsWithBudget.length){
    budgetList.innerHTML=catsWithBudget.map(cat=>{
      const limit=budgets[cat];
      const spent=catTotals[cat]||0;
      const pctB=Math.min(100,Math.round(spent/limit*100));
      const over=spent>limit;
      const barColor=over?'var(--red)':pctB>80?'var(--amber)':'var(--green)';
      return `<div class="budget-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px">${CAT_ICONS[cat]} ${cat.charAt(0).toUpperCase()+cat.slice(1)}</span>
          <button class="budget-edit" onclick="openBudgetModal('${cat}')">editar</button>
        </div>
        <div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pctB}%;background:${barColor}"></div></div>
        <div class="budget-info">
          <span style="color:${over?'var(--red)':'var(--text3)'}">${fmt(spent)} / ${fmt(limit)}</span>
          <span style="color:${barColor};font-weight:600">${pctB}%</span>
        </div>
        ${over?`<div style="font-size:11px;color:var(--red);margin-top:2px">Estourou ${fmt(spent-limit)}</div>`:''}
      </div>`;
    }).join('')+(catsWithout.length?`<div style="padding:8px 18px"><button class="budget-edit" onclick="openBudgetModal('${catsWithout[0]}')" style="font-size:12px">+ Definir mais orçamentos</button></div>`:'');
  } else {
    budgetList.innerHTML=`<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Sem orçamentos definidos<br><button class="budget-edit" onclick="openBudgetModal('alimentação')" style="font-size:12px;margin-top:6px">+ Definir orçamento</button></div>`;
  }

  const respTotals={};expTxs.forEach(t=>{if(t.respId){respTotals[t.respId]=(respTotals[t.respId]||0)+t.amount;}});
  document.getElementById('resp-list').innerHTML=Object.entries(respTotals).sort((a,b)=>b[1]-a[1]).map(([rid,amt])=>{
    const pct=totalExp>0?Math.round(amt/totalExp*100):0;
    const color=getRespColor(rid),name=getRespName(rid),initials=getRespInitials(rid);
    return `<div class="cat-item"><div style="width:20px;height:20px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0">${initials}</div><div class="cat-name">${name}</div><div class="cat-amount" style="color:${color};font-size:12px">${fmt(amt)}</div><div class="cat-pct">${pct}%</div></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  }).join('')||'<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Sem despesas</div>';
}

function changeMonth(d){
  currentMonth+=d;
  if(currentMonth>11){currentMonth=0;currentYear++;}
  if(currentMonth<0){currentMonth=11;currentYear--;}
  applyRecurrences(); render();
}

function renderMonthHeatmap(){
  const hm=document.getElementById('month-heatmap');
  if(!hm) return;
  hm.innerHTML=`<div class="hm-year">${currentYear}</div>`+MONTHS_SHORT.map((lbl,i)=>{
    const paid=isMonthPaid(currentYear,i);
    const closed=isMonthClosed(currentYear,i);
    const txs=getMonthTxs(currentYear,i);
    const active=(i===currentMonth);
    let state='open-empty';
    if(paid) state='paid';
    else if(closed) state='closed';
    else if(txs.length) state='open-has';
    return `<button class="hm-cell hm-${state}${active?' hm-active':''}" title="${MONTHS[i]} ${currentYear}${paid?' · Paga':closed?' · Fechada':txs.length?' · '+txs.length+' lançamentos':' · Aberta'}" onclick="goToMonth(${currentYear},${i})">${lbl}</button>`;
  }).join('');
}


// ── CLOSE INVOICE (bloqueia novos lançamentos) ──
function openPayModal(){
  const txs=getCurrentTxs();
  const income=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  document.getElementById('pay-modal-title').textContent=`Fechar fatura de ${MONTHS[currentMonth]}?`;
  document.getElementById('pay-modal-sub').innerHTML=`<strong style="color:var(--text)">${MONTHS[currentMonth]} ${currentYear}</strong><br>Receitas: <span style="color:var(--green)">${fmt(income)}</span> · Despesas: <span style="color:var(--red)">${fmt(expense)}</span><br>Saldo: <span style="color:${income-expense>=0?'var(--green)':'var(--red)'}">${fmt(income-expense)}</span>`;
  document.getElementById('pay-modal').classList.remove('hidden');
}
function closePayModal(){document.getElementById('pay-modal').classList.add('hidden');}
function confirmPayMonth(){
  // "Fechar fatura" agora apenas fecha (bloqueia novos lançamentos)
  const k=currentKey();
  if(!closedMonths.includes(k)) closedMonths.push(k);
  markUnsaved();closePayModal();render();
}

// ── MARK INVOICE AS PAID ──
function openPayInvoiceModal(){
  const txs=getCurrentTxs();
  const expense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  document.getElementById('pay-invoice-modal-sub').innerHTML=`<strong style="color:var(--text)">${MONTHS[currentMonth]} ${currentYear}</strong><br>Total da fatura: <span style="color:var(--red)">${fmt(expense)}</span>`;
  document.getElementById('pay-invoice-modal').classList.remove('hidden');
}
function closePayInvoiceModal(){document.getElementById('pay-invoice-modal').classList.add('hidden');}
function confirmPayInvoice(){
  const k=currentKey();
  if(!paidMonths.includes(k)) paidMonths.push(k);
  // Uma fatura paga também está fechada
  if(!closedMonths.includes(k)) closedMonths.push(k);
  markUnsaved();closePayInvoiceModal();render();
}

function openUnlockModal(){
  const paid=isCurrentPaid();
  const msg=paid
    ?`Reabrir fatura paga de ${MONTHS[currentMonth]} ${currentYear}? Ela voltará ao estado "fechada" (não-paga).`
    :`Reabrir fatura de ${MONTHS[currentMonth]} ${currentYear}? Novos lançamentos voltarão a ser aceitos.`;
  document.getElementById('unlock-modal-sub').textContent=msg;
  document.getElementById('unlock-modal').classList.remove('hidden');
}
function closeUnlockModal(){document.getElementById('unlock-modal').classList.add('hidden');}
function confirmUnlock(){
  const k=currentKey();
  if(isCurrentPaid()){
    // Pago → fechada (não-paga)
    paidMonths=paidMonths.filter(x=>x!==k);
  } else {
    // Fechada → aberta
    closedMonths=closedMonths.filter(x=>x!==k);
  }
  markUnsaved();closeUnlockModal();render();
}

// ── PAGES ──
function showPage(name,el,bnav){
  if(name==='more'){openMoreMenu();return;}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if(el) el.classList.add('active');
  // Update bottom nav active state
  document.querySelectorAll('.bottom-nav-btn').forEach(b=>b.classList.remove('active'));
  const navBtn=bnav||document.querySelector(`.bottom-nav-btn[data-page="${name}"]`);
  if(navBtn) navBtn.classList.add('active');
  // For pages in "more" menu, highlight the more button
  if(name==='people'||name==='history'){
    const moreBtn=document.querySelector('.bottom-nav-btn[data-page="more"]');
    if(moreBtn) moreBtn.classList.add('active');
  }
  if(name==='charts') renderCharts();
  if(name==='recurring') renderRecurring();
  if(name==='people') renderPeople();
  if(name==='history') renderHistory();
  if(name==='annual') renderAnnual();
  if(name==='investments') renderInvestments();
  if(name==='categories') renderCategories();
  if(name==='categories'){
    const moreBtn=document.querySelector('.bottom-nav-btn[data-page="more"]');
    if(moreBtn) moreBtn.classList.add('active');
  }
}

// ── CATEGORIES ──
function slugifyCatKey(name){
  const base=name.toLowerCase().trim().replace(/\s+/g,' ');
  let key=base; let i=2;
  while(CAT_ICONS[key]) key=base+' '+(i++);
  return key;
}
function renderCategories(){
  const listEl=document.getElementById('cat-manage-list');
  if(!listEl) return;
  const keys=allCategoryKeys();
  const usage={};
  transactions.forEach(t=>{usage[t.category]=(usage[t.category]||0)+1;});
  recurring.forEach(r=>{usage[r.category]=(usage[r.category]||0)+1;});
  listEl.innerHTML=keys.map(k=>{
    const isCustom=isCustomCategory(k);
    const count=usage[k]||0;
    const color=CAT_COLORS[k]||'#94a3b8';
    const icon=CAT_ICONS[k]||'📦';
    const label=k.charAt(0).toUpperCase()+k.slice(1);
    return `<div class="cat-row" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;margin-bottom:8px">
      <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${color}22;border:1px solid ${color}44;flex:none">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${isCustom?'Personalizada':'Padrão'} · ${count} lançamento${count===1?'':'s'}</div>
      </div>
      ${isCustom?`<button class="btn-cancel" style="padding:6px 10px;font-size:12px;flex:none" onclick="removeCategory('${k.replace(/'/g,"\\'")}')">Excluir</button>`:''}
    </div>`;
  }).join('');
}
function addCategory(){
  const nameEl=document.getElementById('new-cat-name');
  const iconEl=document.getElementById('new-cat-icon');
  const colorEl=document.getElementById('new-cat-color');
  const name=nameEl.value.trim();
  const icon=(iconEl.value||'').trim()||'🏷️';
  const color=colorEl.value||'#94a3b8';
  if(!name){alert('Informe um nome.');return;}
  const existing=allCategoryKeys().find(k=>k.toLowerCase()===name.toLowerCase());
  if(existing){alert('Já existe uma categoria com esse nome.');return;}
  const key=slugifyCatKey(name);
  customCategories.push({key,name,icon,color});
  applyCustomCategories();
  nameEl.value='';iconEl.value='';
  markUnsaved();
  renderCategories();
  render();
}
function removeCategory(key){
  if(!isCustomCategory(key)){alert('Só é possível excluir categorias personalizadas.');return;}
  const inUse=transactions.some(t=>t.category===key)||recurring.some(r=>r.category===key);
  if(inUse){openCatMigrateModal(key);return;}
  customCategories=customCategories.filter(c=>c.key!==key);
  applyCustomCategories();
  markUnsaved();
  renderCategories();
  render();
}
let pendingCatDelete=null;
function openCatMigrateModal(key){
  pendingCatDelete=key;
  const sel=document.getElementById('cat-migrate-target');
  sel.innerHTML=allCategoryKeys().filter(k=>k!==key).map(k=>`<option value="${k}">${CAT_ICONS[k]||'📦'} ${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('');
  document.getElementById('cat-migrate-source').textContent=catLabel(key);
  document.getElementById('cat-migrate-modal').classList.remove('hidden');
}
function closeCatMigrateModal(){
  pendingCatDelete=null;
  document.getElementById('cat-migrate-modal').classList.add('hidden');
}
function confirmCatMigrate(){
  if(!pendingCatDelete) return;
  const target=document.getElementById('cat-migrate-target').value;
  if(!target||target===pendingCatDelete){alert('Selecione um destino válido.');return;}
  transactions=transactions.map(t=>t.category===pendingCatDelete?{...t,category:target}:t);
  recurring=recurring.map(r=>r.category===pendingCatDelete?{...r,category:target}:r);
  if(budgets[pendingCatDelete]!=null){delete budgets[pendingCatDelete];}
  customCategories=customCategories.filter(c=>c.key!==pendingCatDelete);
  applyCustomCategories();
  pendingCatDelete=null;
  document.getElementById('cat-migrate-modal').classList.add('hidden');
  markUnsaved();
  renderCategories();
  render();
}
function openMoreMenu(){document.getElementById('more-menu-overlay').classList.remove('hidden');}
function closeMoreMenu(){document.getElementById('more-menu-overlay').classList.add('hidden');}

// ── HISTORY ──
function renderHistory(){
  const grid=document.getElementById('history-grid');
  // Collect all months that have transactions or are paid
  const monthSet=new Set();
  transactions.forEach(t=>{const d=new Date(t.date+'T12:00:00');monthSet.add(d.getFullYear()+'-'+d.getMonth());});
  paidMonths.forEach(k=>{const p=k.split('-');monthSet.add(parseInt(p[0])+'-'+(parseInt(p[1])-1));});
  closedMonths.forEach(k=>{const p=k.split('-');monthSet.add(parseInt(p[0])+'-'+(parseInt(p[1])-1));});
  // Also include current viewed month
  monthSet.add(currentYear+'-'+currentMonth);
  const entries=[];
  monthSet.forEach(key=>{
    const [y,m]=[parseInt(key.split('-')[0]),parseInt(key.split('-')[1])];
    const txs=getMonthTxs(y,m);
    if(!txs.length&&!isMonthPaid(y,m)&&!isMonthClosed(y,m)) return;
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    entries.push({y,m,inc,exp,bal:inc-exp,paid:isMonthPaid(y,m),closed:isMonthClosed(y,m),txCount:txs.length});
  });
  entries.sort((a,b)=>(b.y*12+b.m)-(a.y*12+a.m));
  if(!entries.length){grid.innerHTML='<div class="empty"><div class="empty-icon">📅</div><div>Nenhum histórico ainda</div></div>';return;}
  grid.innerHTML=entries.map(e=>`
    <div class="hist-card${e.paid?' paid-card':''}" onclick="goToMonth(${e.y},${e.m})">
      <div class="hist-month"><span>${MONTHS_SHORT[e.m]} ${e.y}</span>${e.paid?`<span class="paid-badge" style="font-size:11px;padding:3px 8px"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Pago</span>`:e.closed?`<span style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:20px;padding:3px 8px">📋 Fechada</span>`:`<span style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:20px;padding:3px 8px">Aberta</span>`}</div>
      <div class="hist-row"><span class="hist-label">Receitas</span><span style="color:var(--green);font-family:var(--font-heading)">${fmt(e.inc)}</span></div>
      <div class="hist-row"><span class="hist-label">Despesas</span><span style="color:var(--red);font-family:var(--font-heading)">${fmt(e.exp)}</span></div>
      <div style="height:1px;background:var(--border);margin:8px 0"></div>
      <div class="hist-row"><span class="hist-label">Saldo</span><span style="color:${e.bal>=0?'var(--green)':'var(--red)'};font-family:var(--font-heading);font-weight:700">${fmt(e.bal)}</span></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">${e.txCount} transações</div>
    </div>`).join('');
}
function goToMonth(y,m){currentYear=y;currentMonth=m;applyRecurrences();showPage('transactions',document.querySelector('.tab'));render();}

// ── RECURRING + INSTALLMENTS ──
function renderRecurring(){
  const infiniteExp=recurring.filter(r=>!r.isInstallment&&r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const infiniteInc=recurring.filter(r=>!r.isInstallment&&r.type==='income').reduce((s,r)=>s+r.amount,0);

  // Active installments (not yet liquidated)
  const activeInstallments=recurring.filter(r=>r.isInstallment&&!isInstallmentLiquidated(r));
  const installmentMonthly=activeInstallments.reduce((s,r)=>s+(r.type==='expense'?r.amount:-r.amount),0);

  document.getElementById('recur-summary').innerHTML=`
    <div class="card" style="flex:1"><div class="card-label">Receitas fixas</div><div class="card-value" style="color:var(--green);font-size:20px">${fmt(infiniteInc)}</div></div>
    <div class="card" style="flex:1"><div class="card-label">Despesas fixas</div><div class="card-value" style="color:var(--red);font-size:20px">${fmt(infiniteExp)}</div></div>
    <div class="card" style="flex:1"><div class="card-label">Parcelas/mês</div><div class="card-value" style="font-size:20px;color:${installmentMonthly<=0?'var(--red)':'var(--text)'}">${fmt(Math.abs(installmentMonthly))}</div><div class="card-sub">${activeInstallments.length} parcelamento${activeInstallments.length!==1?'s':''} ativo${activeInstallments.length!==1?'s':''}</div></div>
  `;

  const rl=document.getElementById('recur-list');
  if(!recurring.length){rl.innerHTML='<div class="empty"><div class="empty-icon">🔄</div><div>Nenhuma transação recorrente ou parcelamento</div></div>';return;}

  // A parcelamento is "liquidated" only when all installments are in closed months
  function isInstallmentLiquidated(r){
    if(getInstallmentCount(r.id)<r.totalInstallments) return false;
    return transactions.filter(t=>t.recurId===r.id).every(t=>{
      const d=new Date(t.date+'T12:00:00');
      return isMonthPaid(d.getFullYear(),d.getMonth());
    });
  }

  // Separate: infinite recurring first, then installments (active first, liquidated last)
  const infinites=recurring.filter(r=>!r.isInstallment);
  const installmentsActive=recurring.filter(r=>r.isInstallment&&!isInstallmentLiquidated(r));
  const installmentsDone=recurring.filter(r=>r.isInstallment&&isInstallmentLiquidated(r));
  const ordered=[...infinites,...installmentsActive,...installmentsDone];

  rl.innerHTML=`<div class="recur-grid">${ordered.map(r=>{
    const color=getRespColor(r.respId),initials=getRespInitials(r.respId),name=getRespName(r.respId);
    const sid=String(r.id);

    if(r.isInstallment){
      const paidCount=getPaidInstallmentCount(r.id);
      const completed=isInstallmentLiquidated(r);
      const pct=Math.min(100,Math.round(paidCount/r.totalInstallments*100));
      const remaining=r.totalInstallments-paidCount;
      const totalPaid=paidCount*r.amount;
      const totalRemaining=remaining*r.amount;

      return `<div class="recur-card${completed?' completed-card':''}">
        <div class="recur-top">
          <div style="font-size:22px">${CAT_ICONS[r.category]||'📦'}</div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <span class="recur-type installment">Parcelado</span>
            ${completed?'<span style="background:var(--greenbg);color:var(--green);font-size:10px;padding:2px 7px;border-radius:5px;font-weight:600;border:1px solid #1a4a30">✓ Quitado</span>':''}
          </div>
        </div>
        <div class="recur-name">${escHtml(r.desc)}</div>
        <div class="recur-info">${r.category}</div>
        ${r.respId?`<div style="display:flex;align-items:center;gap:5px;margin-top:4px"><div style="width:16px;height:16px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff">${initials}</div><span style="font-size:12px;color:${color}">${name}</span></div>`:''}
        <div class="recur-amount ${r.type==='income'?'pos':'neg'}">${r.type==='income'?'+':'-'}${fmt(r.amount)}<span style="font-size:12px;font-weight:400;color:var(--text3)"> /parcela</span></div>
        <div class="install-progress">
          <div class="install-progress-bar">
            <div class="install-progress-fill" style="width:${pct}%;background:${completed?'var(--green)':'var(--accent)'}"></div>
          </div>
          <div class="install-progress-label">
            <span>${paidCount} de ${r.totalInstallments} parcelas</span>
            <span>${pct}%</span>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px;display:flex;justify-content:space-between">
            <span>Pago: ${fmt(totalPaid)}</span>
            ${!completed?`<span>Restante: ${fmt(totalRemaining)}</span>`:''}
          </div>
          ${!completed?`<div style="font-size:11px;color:var(--amber);margin-top:3px">↓ Próxima: ${paidCount+1}ª parcela</div>`:''}
        </div>
        <div class="recur-actions">
          ${!completed?`<button class="recur-btn" data-edit-recur="${sid}">Editar</button>`:''}
          <button class="recur-btn del" data-del-recur="${sid}">${completed?'Remover':'Cancelar'}</button>
        </div>
      </div>`;
    } else {
      // Regular infinite recurring
      return `<div class="recur-card">
        <div class="recur-top"><div style="font-size:22px">${CAT_ICONS[r.category]||'📦'}</div><span class="recur-type ${r.type}">${r.type==='expense'?'Despesa':'Receita'}</span></div>
        <div class="recur-name">${escHtml(r.desc)}</div><div class="recur-info">${r.category} · todo dia 1°</div>
        ${r.respId?`<div style="display:flex;align-items:center;gap:5px;margin-top:6px"><div style="width:16px;height:16px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff">${initials}</div><span style="font-size:12px;color:${color}">${name}</span></div>`:''}
        <div class="recur-amount ${r.type==='income'?'pos':'neg'}">${r.type==='income'?'+':'-'}${fmt(r.amount)}</div>
        <div class="recur-actions">
          <button class="recur-btn" data-edit-recur="${sid}">Editar</button>
          <button class="recur-btn del" data-del-recur="${sid}">Remover</button>
        </div>
      </div>`;
    }
  }).join('')}</div>`;
}

// ── PEOPLE ──
function renderRespTags(){
  document.getElementById('resp-tags').innerHTML=responsibles.map(r=>`<div class="resp-tag" style="color:${getRespColor(r.id)};border-color:${getRespColor(r.id)}44;background:${getRespColor(r.id)}11; margin-bottom: 5px;"><span>${r.name}</span><button class="resp-tag-del" onclick="removeResponsible('${r.id}')" style="color:${getRespColor(r.id)}">✕</button></div>`).join('');
}
function addResponsible(){
  const inp=document.getElementById('new-resp-input'),name=inp.value.trim();
  if(!name)return;
  if(responsibles.find(r=>r.name.toLowerCase()===name.toLowerCase())){alert('Já existe!');return;}
  responsibles.push({id:'r'+Date.now(),name});inp.value='';markUnsaved();renderRespTags();renderPeople();render();
}
function removeResponsible(id){
  if(!confirm('Remover este responsável?'))return;
  responsibles=responsibles.filter(r=>r.id!==id);
  transactions=transactions.map(t=>t.respId===id?{...t,respId:null}:t);
  recurring=recurring.map(r=>r.respId===id?{...r,respId:null}:r);
  markUnsaved();renderRespTags();renderPeople();render();
}
function renderPeople(){
  renderRespTags();
  const txs=getCurrentTxs(),detail=document.getElementById('people-detail');
  if(!responsibles.length){detail.innerHTML='<div class="empty"><div class="empty-icon">👤</div><div>Nenhum responsável cadastrado</div></div>';return;}
  detail.innerHTML='<div style="padding:12px 18px;display:flex;flex-direction:column;gap:14px">'+responsibles.map(r=>{
    const color=getRespColor(r.id),initials=getRespInitials(r.id);
    const rtxs=txs.filter(t=>t.respId===r.id);
    const inc=rtxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=rtxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    return `<div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--surface2);border-radius:12px;border:1px solid var(--border)">
      <div style="width:42px;height:42px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0">${initials}</div>
      <div style="flex:1"><div style="font-weight:500;font-size:15px;margin-bottom:6px">${r.name}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Receitas</div><div style="font-family:var(--font-heading);font-size:16px;color:var(--green)">${fmt(inc)}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Despesas</div><div style="font-family:var(--font-heading);font-size:16px;color:var(--red)">${fmt(exp)}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Saldo</div><div style="font-family:var(--font-heading);font-size:16px;color:${inc-exp>=0?'var(--green)':'var(--red)'}">${fmt(inc-exp)}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Transações</div><div style="font-family:var(--font-heading);font-size:16px">${rtxs.length}</div></div>
      </div></div></div>`;
  }).join('')+'</div>';
}

// ── CHARTS ──
function renderCharts(){
  const cssVar=(n)=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  Chart.defaults.color=cssVar('--text2')||'#9b99b0';Chart.defaults.font={family:"'DM Sans',sans-serif",size:12};

  const labels=[],incData=[],expData=[];
  for(let i=5;i>=0;i--){let m=currentMonth-i,y=currentYear;if(m<0){m+=12;y--;}labels.push(MONTHS_SHORT[m]);const txs=getMonthTxs(y,m);incData.push(txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));expData.push(txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));}
  if(charts.bar)charts.bar.destroy();
  charts.bar=new Chart(document.getElementById('chart-bar'),{type:'bar',data:{labels,datasets:[{label:'Receitas',data:incData,backgroundColor:'#3ecf8e44',borderColor:'#3ecf8e',borderWidth:2,borderRadius:6},{label:'Despesas',data:expData,backgroundColor:'#f8717144',borderColor:'#f87171',borderWidth:2,borderRadius:6}]},options:{responsive:true,plugins:{legend:{position:'top'}},scales:{x:{grid:{color:'#2a2a38'}},y:{grid:{color:'#2a2a38'},ticks:{callback:v=>'R$'+Math.round(v/1000)+'k'}}}}});

  const closedKeys=paidMonths.slice().sort();
  const accumLabels=[],accumInc=[],accumExp=[],accumBal=[];
  let totalInc=0,totalExp=0;
  closedKeys.forEach(key=>{
    const parts=key.split('-');
    const ky=parseInt(parts[0]),km=parseInt(parts[1])-1;
    const txs=getMonthTxs(ky,km);
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    totalInc+=inc; totalExp+=exp;
    accumLabels.push(ky!==currentYear?MONTHS_SHORT[km]+'/'+String(ky).slice(2):MONTHS_SHORT[km]);
    accumInc.push(Math.round(totalInc*100)/100);
    accumExp.push(Math.round(totalExp*100)/100);
    accumBal.push(Math.round((totalInc-totalExp)*100)/100);
  });
  if(charts.accum)charts.accum.destroy();
  if(accumLabels.length){
    const firstParts=closedKeys[0].split('-'),lastParts=closedKeys[closedKeys.length-1].split('-');
    const fy=parseInt(firstParts[0]),fm=parseInt(firstParts[1])-1;
    const ly=parseInt(lastParts[0]),lm=parseInt(lastParts[1])-1;
    document.getElementById('chart-accum-title').textContent=`Patrimônio acumulado — ${MONTHS[fm]} ${fy} → ${MONTHS[lm]} ${ly}`;
    const lastBal=accumBal[accumBal.length-1]||0;
    const lastInc=accumInc[accumInc.length-1]||0;
    const lastExp=accumExp[accumExp.length-1]||0;
    const savingsRate=lastInc>0?Math.round((lastBal/lastInc)*100):0;
    charts.accum=new Chart(document.getElementById('chart-accum'),{
      type:'line',
      data:{labels:accumLabels,datasets:[
        {label:'Receita acumulada',data:accumInc,borderColor:'#3ecf8e',backgroundColor:'transparent',fill:false,tension:0.35,pointBackgroundColor:'#3ecf8e',pointRadius:4,pointHoverRadius:6,borderWidth:2.5},
        {label:'Despesa acumulada',data:accumExp,borderColor:'#f87171',backgroundColor:'transparent',fill:false,tension:0.35,pointBackgroundColor:'#f87171',pointRadius:4,pointHoverRadius:6,borderWidth:2.5},
        {label:'Saldo acumulado',data:accumBal,borderColor:'#7c6ff7',backgroundColor:'transparent',fill:false,tension:0.35,pointBackgroundColor:'#7c6ff7',pointRadius:4,pointHoverRadius:6,borderWidth:2.5}
      ]},
      options:{
        responsive:true,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{display:true,position:'top',labels:{boxWidth:12,padding:20,usePointStyle:true,pointStyleWidth:12}},
          tooltip:{callbacks:{label:ctx=>' '+ctx.dataset.label+': '+fmt(ctx.parsed.y)}}
        },
        scales:{
          x:{grid:{color:'#2a2a38'},ticks:{color:'#9b99b0'}},
          y:{grid:{color:'#2a2a38'},ticks:{color:'#9b99b0',callback:v=>{const a=Math.abs(v);return (v<0?'-':'')+'R$'+(a>=1000?(Math.round(a/1000*10)/10)+'k':Math.round(a));}}}
        }
      }
    });
    document.getElementById('chart-accum-stats').innerHTML=`
      <div class="card" style="flex:1;min-width:140px"><div class="card-label">Receita acumulada</div><div class="card-value" style="color:var(--green);font-size:20px">${fmt(lastInc)}</div><div class="card-sub">${closedKeys.length} ${closedKeys.length===1?'mês fechado':'meses fechados'}</div></div>
      <div class="card" style="flex:1;min-width:140px"><div class="card-label">Despesa acumulada</div><div class="card-value" style="color:var(--red);font-size:20px">${fmt(lastExp)}</div><div class="card-sub">no mesmo período</div></div>
      <div class="card" style="flex:1;min-width:140px"><div class="card-label">Saldo acumulado</div><div class="card-value" style="color:${lastBal>=0?'var(--green)':'var(--red)'};font-size:20px">${fmt(lastBal)}</div><div class="card-sub">patrimônio líquido</div></div>
      <div class="card" style="flex:1;min-width:140px"><div class="card-label">Taxa de poupança</div><div class="card-value" style="color:var(--accent);font-size:20px">${savingsRate}%</div><div class="card-sub">do total recebido</div></div>`;
  } else {
    document.getElementById('chart-accum-title').textContent='Patrimônio acumulado';
    document.getElementById('chart-accum-stats').innerHTML=`<div style="color:var(--text3);font-size:13px;padding:8px 0">Feche pelo menos um mês para ver o patrimônio acumulado.</div>`;
  }

  const txs=getCurrentTxs().filter(t=>t.type==='expense'),catT={};txs.forEach(t=>{catT[t.category]=(catT[t.category]||0)+t.amount;});
  const cats=Object.keys(catT);
  if(charts.pie)charts.pie.destroy();
  if(cats.length)charts.pie=new Chart(document.getElementById('chart-pie'),{type:'doughnut',data:{labels:cats.map(c=>c.charAt(0).toUpperCase()+c.slice(1)),datasets:[{data:cats.map(c=>catT[c]),backgroundColor:cats.map(c=>(CAT_COLORS[c]||'#94a3b8')+'cc'),borderColor:'#18181f',borderWidth:2,hoverOffset:6}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{padding:14,boxWidth:10}}}}});

  const respT={};txs.forEach(t=>{if(t.respId){respT[t.respId]=(respT[t.respId]||0)+t.amount;}});
  const rids=Object.keys(respT);
  if(charts.resp)charts.resp.destroy();
  if(rids.length)charts.resp=new Chart(document.getElementById('chart-resp'),{type:'doughnut',data:{labels:rids.map(id=>getRespName(id)),datasets:[{data:rids.map(id=>respT[id]),backgroundColor:rids.map(id=>getRespColor(id)+'cc'),borderColor:'#18181f',borderWidth:2,hoverOffset:6}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{padding:14,boxWidth:10}}}}});
}

// ── FORM ──
function buildRespSelector(selectedId){
  const sel=document.getElementById('f-resp-selector');
  sel.innerHTML=`<div class="resp-opt ${!selectedId?'selected':''}" style="${!selectedId?'background:var(--surface3);border-color:var(--accent);color:var(--text)':''}" onclick="selectResp(null,this)">Nenhum</div>`+
  responsibles.map(r=>{const color=getRespColor(r.id),initials=getRespInitials(r.id),active=r.id===selectedId;return `<div class="resp-opt ${active?'selected':''}" style="${active?`background:${color}22;border-color:${color};color:${color}`:''}" onclick="selectResp('${r.id}',this)" data-id="${r.id}"><span style="width:20px;height:20px;border-radius:50%;background:${color};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff">${initials}</span>${r.name}</div>`;}).join('');
  selectedResp=selectedId||null;
}
function selectResp(id,el){
  selectedResp=id;
  document.querySelectorAll('.resp-opt').forEach(o=>{const oid=o.dataset.id||null,active=oid===id;o.classList.toggle('selected',active);if(active&&id){const c=getRespColor(id);o.style.cssText=`background:${c}22;border-color:${c};color:${c}`;}else if(active){o.style.cssText='background:var(--surface3);border-color:var(--accent);color:var(--text)';}else{o.style.cssText='';}});
}

// ── RECUR TYPE SELECTOR ──
function setRecurType(type){
  recurType=type;
  ['none','infinite','installment'].forEach(t=>{
    const btn=document.getElementById('btn-rt-'+t);
    if(btn) btn.className='type-btn'+(t===type?' active-recur':'');
  });
  const pr=document.getElementById('f-parcelas-row');
  if(pr) pr.style.display=type==='installment'?'block':'none';
  if(type==='installment') updateParcelaHint();
}

function updateParcelaHint(){
  const amount=parseMoneyInput(document.getElementById('f-amount').value)||0;
  const parcelas=parseInt(document.getElementById('f-parcelas').value)||0;
  const hint=document.getElementById('f-parcela-hint');
  if(!hint) return;
  if(parcelas>=2&&amount>0){
    const total=amount*parcelas;
    hint.textContent=`${parcelas}× de ${fmt(amount)} = ${fmt(total)} no total`;
  } else if(parcelas>=2){
    hint.textContent=`${parcelas} parcelas — informe o valor para ver o total`;
  } else {
    hint.textContent='Informe o número de parcelas (mínimo 2)';
  }
}

function openForm(tx,recurMode=false,recurTx=null){
  if(!recurMode&&isCurrentPaid()){alert('Esta fatura está paga. Reabra para adicionar transações.');return;}
  if(!recurMode&&isCurrentClosed()){
    const nxt=nextOpenInvoiceKey(currentYear,currentMonth);
    const [ny,nm]=nxt.split('-');
    showRollToast(`Fatura fechada — lançamento irá para ${MONTHS_SHORT[parseInt(nm)-1]}/${ny}`);
  }
  isRecurringForm=recurMode; editingRecurId=recurTx?recurTx.id:null;
  document.getElementById('form-title').textContent=recurMode?'Transação recorrente':'Nova transação';
  document.getElementById('f-date-group').style.display=recurMode?'none':'block';

  // Show recur type only for new (non-edit, non-recurMode) transactions
  const isEdit=!!(tx&&tx.id);
  document.getElementById('f-recur-group').style.display=(recurMode||isEdit)?'none':'block';

  const src=tx||recurTx;
  document.getElementById('f-desc').value=src?src.desc:'';
  if(src) setMoneyValue(document.getElementById('f-amount'),src.amount); else document.getElementById('f-amount').value='';
  document.getElementById('f-date').value=src?src.date:new Date().toISOString().split('T')[0];
  const fcat=document.getElementById('f-category');
  const curCat=src?src.category:'alimentação';
  fcat.innerHTML=allCategoryKeys().map(k=>`<option value="${k}">${CAT_ICONS[k]||'📦'} ${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('');
  fcat.value=allCategoryKeys().includes(curCat)?curCat:allCategoryKeys()[0];
  document.getElementById('f-note').value=src?src.note||'':'';
  document.getElementById('f-note-group').style.display=recurMode?'none':'block';

  // Reset recur type for new transactions
  if(!recurMode&&!isEdit) setRecurType('none');

  // For editing a recurring installment — pre-populate parcelas field  
  if(recurMode&&recurTx&&recurTx.isInstallment){
    // show parcelas info (read-only context)
    document.getElementById('f-recur-group').style.display='block';
    setRecurType('installment');
    document.getElementById('f-parcelas').value=recurTx.totalInstallments;
    updateParcelaHint();
  } else if(recurMode) {
    document.getElementById('f-recur-group').style.display='none';
  }

  setType(src?src.type:'expense');
  buildRespSelector(src?src.respId:null);
  document.getElementById('overlay').dataset.editId=tx?tx.id:'';
  document.getElementById('overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('f-desc').focus(),50);
}
function closeForm(){document.getElementById('overlay').classList.add('hidden');}
function setType(t){formType=t;document.getElementById('btn-expense').className='type-btn'+(t==='expense'?' active-expense':'');document.getElementById('btn-income').className='type-btn'+(t==='income'?' active-income':'');}

function saveTransaction(){
  const desc=document.getElementById('f-desc').value.trim();
  const amount=parseMoneyInput(document.getElementById('f-amount').value);
  const date=document.getElementById('f-date').value;
  const category=document.getElementById('f-category').value;
  const note=document.getElementById('f-note').value.trim();

  if(!desc||!amount){alert('Preencha descrição e valor');return;}

  if(isRecurringForm){
    const obj={
      id:editingRecurId||('rec'+Date.now()),
      desc,amount,type:formType,category,respId:selectedResp,
      isInstallment:editingRecurId?findRecur(editingRecurId)?.isInstallment||false:false,
      totalInstallments:editingRecurId?findRecur(editingRecurId)?.totalInstallments||null:null
    };
    // If editing an installment, allow updating totalInstallments
    if(obj.isInstallment){
      const newTotal=parseInt(document.getElementById('f-parcelas').value)||obj.totalInstallments;
      const applied=getInstallmentCount(obj.id);
      if(newTotal<applied){alert(`Já foram lançadas ${applied} parcelas. O total não pode ser menor que isso.`);return;}
      obj.totalInstallments=newTotal;
    }
    if(editingRecurId){
      const idx=recurring.findIndex(r=>String(r.id)===String(editingRecurId));
      if(idx>-1) recurring[idx]=obj;
      // Propagar alterações para transações em meses abertos
      transactions.forEach(t=>{
        if(t.recurId!==editingRecurId) return;
        const d=new Date(t.date+'T12:00:00');
        if(isMonthPaid(d.getFullYear(),d.getMonth())) return;
        t.desc=obj.desc;
        t.amount=obj.amount;
        t.type=obj.type;
        t.category=obj.category;
        t.respId=obj.respId;
        if(obj.isInstallment) t.totalInstallments=obj.totalInstallments;
      });
    } else recurring.push(obj);
    markUnsaved();closeForm();renderRecurring();render();return;
  }

  if(!date){alert('Informe a data');return;}
  const editId=document.getElementById('overlay').dataset.editId;

  if(editId){
    // Editing existing transaction — preserve invoiceKey (fatura não muda quando só edita dados)
    const idx=transactions.findIndex(t=>String(t.id)===String(editId));
    if(idx>-1){
      const prev=transactions[idx];
      const prevKey=getTxInvoiceKey(prev);
      transactions[idx]={...prev,desc,amount,type:formType,category,date,respId:selectedResp,note:note||undefined,invoiceKey:prev.invoiceKey||prevKey};
    }
  } else {
    // New transaction — fatura é a próxima aberta a partir da data
    const invKey=resolveInvoiceForDate(date);
    if(recurType==='installment'){
      const totalParcelas=parseInt(document.getElementById('f-parcelas').value)||2;
      if(totalParcelas<2){alert('O número de parcelas deve ser pelo menos 2.');return;}
      // Start month baseado na data informada (mês real da compra)
      const dd=new Date(date+'T12:00:00');
      const sY=dd.getFullYear(), sM=dd.getMonth();
      const nr={
        id:'rec'+Date.now(),
        desc,amount,type:formType,category,respId:selectedResp,
        isInstallment:true,
        totalInstallments:totalParcelas,
        startYear:sY,
        startMonth:sM
      };
      recurring.push(nr);
      const startM=String(sM+1).padStart(2,'0');
      transactions.push({
        id:'tx'+Date.now(),
        desc,amount,type:formType,category,
        date:`${sY}-${startM}-01`,
        invoiceKey:invKey,
        recurId:nr.id,respId:selectedResp,
        installmentNum:1,
        totalInstallments:totalParcelas
      });
    } else if(recurType==='infinite'){
      const nr={id:'rec'+Date.now(),desc,amount,type:formType,category,respId:selectedResp,isInstallment:false};
      recurring.push(nr);
      transactions.push({id:'tx'+Date.now(),desc,amount,type:formType,category,date,invoiceKey:invKey,recurId:nr.id,respId:selectedResp,note:note||undefined});
    } else {
      transactions.push({id:'tx'+Date.now(),desc,amount,type:formType,category,date,invoiceKey:invKey,respId:selectedResp,note:note||undefined});
    }
  }

  markUnsaved();closeForm();render();
}

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function findTx(id){return transactions.find(t=>String(t.id)===String(id));}
function findRecur(id){return recurring.find(r=>String(r.id)===String(id));}

function toggleTxPaid(id){
  const tx=findTx(id);
  if(tx){tx.paid=!tx.paid;markUnsaved();render();}
}

function deleteTx(id){
  if(isCurrentPaid()) return;
  const tx=findTx(id);
  if(!tx) return;
  pendingDeleteId=id;
  document.getElementById('delete-modal-sub').innerHTML=`<strong>"${escHtml(tx.desc)}"</strong><br>${tx.type==='income'?'+':'-'}${fmt(tx.amount)} · ${tx.date.slice(8,10)}/${tx.date.slice(5,7)}/${tx.date.slice(0,4)}`;
  document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal(){const m=document.getElementById('delete-modal');if(m)m.classList.add('hidden');pendingDeleteId=null;}
function confirmDelete(){
  if(pendingDeleteId){
    transactions=transactions.filter(t=>String(t.id)!==String(pendingDeleteId));
    markUnsaved();render();
  }
  closeDeleteModal();
}
function editTx(id){
  if(isCurrentPaid())return;
  const tx=findTx(id);
  if(tx)openForm(tx);
}
function deleteRecur(id){
  const r=findRecur(id);
  const appliedCount=r&&r.isInstallment?getInstallmentCount(r.id):0;
  const msg=r&&r.isInstallment
    ?`Cancelar parcelamento "${r.desc}"?\n${appliedCount} de ${r.totalInstallments} parcelas já foram lançadas.\n\nAs parcelas já lançadas serão mantidas nas transações.`
    :`Remover esta recorrente?`;
  if(!confirm(msg))return;
  recurring=recurring.filter(r=>String(r.id)!==String(id));
  markUnsaved();renderRecurring();
}
function editRecur(id){
  const r=findRecur(id);
  if(r)openForm(null,true,r);
}

// ── BUDGET ──
let budgetEditCat=null;
function openBudgetModal(cat){
  budgetEditCat=cat;
  const sel=document.getElementById('budget-cat-select');
  sel.innerHTML=Object.keys(CAT_ICONS).map(c=>`<option value="${c}"${c===cat?' selected':''}>${CAT_ICONS[c]} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('');
  if(budgets[cat]) setMoneyValue(document.getElementById('budget-amount'),budgets[cat]); else document.getElementById('budget-amount').value='';
  document.getElementById('budget-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('budget-amount').focus(),50);
}
function closeBudgetModal(){document.getElementById('budget-modal').classList.add('hidden');budgetEditCat=null;}
function saveBudget(){
  const val=parseMoneyInput(document.getElementById('budget-amount').value);
  if(budgetEditCat){
    if(val>0) budgets[budgetEditCat]=val;
    else delete budgets[budgetEditCat];
    markUnsaved();render();
  }
  closeBudgetModal();
}

// ── ANNUAL SUMMARY ──
function changeAnnualYear(d){annualYear+=d;renderAnnual();}
function renderAnnual(){
  document.getElementById('annual-year-label').textContent=annualYear;
  let yearInc=0,yearExp=0,monthData=[];
  for(let m=0;m<12;m++){
    const txs=getMonthTxs(annualYear,m);
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    yearInc+=inc;yearExp+=exp;
    monthData.push({m,inc,exp,bal:inc-exp,count:txs.length,paid:isMonthPaid(annualYear,m),closed:isMonthClosed(annualYear,m)});
  }
  const yearBal=yearInc-yearExp;
  const activeMonths=monthData.filter(d=>d.count>0).length;
  const avgInc=activeMonths?yearInc/activeMonths:0;
  const avgExp=activeMonths?yearExp/activeMonths:0;
  const bestMonth=monthData.reduce((best,d)=>d.bal>best.bal?d:best,{bal:-Infinity,m:0});
  const worstMonth=monthData.reduce((worst,d)=>d.bal<worst.bal?d:worst,{bal:Infinity,m:0});

  document.getElementById('annual-summary-cards').innerHTML=`
    <div class="card" style="flex:1;min-width:150px"><div class="card-label">Receita anual</div><div class="card-value" style="color:var(--green);font-size:20px">${fmt(yearInc)}</div><div class="card-sub">Média: ${fmt(avgInc)}/mês</div></div>
    <div class="card" style="flex:1;min-width:150px"><div class="card-label">Despesa anual</div><div class="card-value" style="color:var(--red);font-size:20px">${fmt(yearExp)}</div><div class="card-sub">Média: ${fmt(avgExp)}/mês</div></div>
    <div class="card" style="flex:1;min-width:150px"><div class="card-label">Saldo anual</div><div class="card-value" style="color:${yearBal>=0?'var(--green)':'var(--red)'};font-size:20px">${fmt(yearBal)}</div><div class="card-sub">${activeMonths} meses com movimentação</div></div>
    <div class="card" style="flex:1;min-width:150px"><div class="card-label">Melhor mês</div><div class="card-value" style="color:var(--green);font-size:18px">${bestMonth.bal>-Infinity?MONTHS_SHORT[bestMonth.m]:'—'}</div><div class="card-sub">${bestMonth.bal>-Infinity?fmt(bestMonth.bal):''}</div></div>
    <div class="card" style="flex:1;min-width:150px"><div class="card-label">Pior mês</div><div class="card-value" style="color:var(--red);font-size:18px">${worstMonth.bal<Infinity?MONTHS_SHORT[worstMonth.m]:'—'}</div><div class="card-sub">${worstMonth.bal<Infinity?fmt(worstMonth.bal):''}</div></div>
  `;

  document.getElementById('annual-table').innerHTML=`
    <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th><th>Transações</th><th>Status</th></tr></thead>
    <tbody>${monthData.map(d=>`<tr style="cursor:pointer" onclick="goToMonth(${annualYear},${d.m})">
      <td style="font-weight:500">${MONTHS_SHORT[d.m]}</td>
      <td style="color:var(--green);font-family:var(--font-heading)">${d.inc?fmt(d.inc):'—'}</td>
      <td style="color:var(--red);font-family:var(--font-heading)">${d.exp?fmt(d.exp):'—'}</td>
      <td style="color:${d.bal>=0?'var(--green)':'var(--red)'};font-family:var(--font-heading);font-weight:600">${d.count?fmt(d.bal):'—'}</td>
      <td>${d.count||'—'}</td>
      <td>${d.paid?'<span style="color:var(--green);font-size:11px">✓ Pago</span>':d.closed?'<span style="color:var(--text2);font-size:11px">📋 Fechada</span>':d.count?'<span style="color:var(--text3);font-size:11px">Aberta</span>':'<span style="color:var(--text3);font-size:11px">—</span>'}</td>
    </tr>`).join('')}
    <tr style="border-top:2px solid var(--border2);font-weight:700">
      <td>Total</td>
      <td style="color:var(--green);font-family:var(--font-heading)">${fmt(yearInc)}</td>
      <td style="color:var(--red);font-family:var(--font-heading)">${fmt(yearExp)}</td>
      <td style="color:${yearBal>=0?'var(--green)':'var(--red)'};font-family:var(--font-heading)">${fmt(yearBal)}</td>
      <td>${monthData.reduce((s,d)=>s+d.count,0)}</td>
      <td></td>
    </tr></tbody>`;

  // Category breakdown for the year
  const yearCats={};
  for(let m=0;m<12;m++){
    getMonthTxs(annualYear,m).filter(t=>t.type==='expense').forEach(t=>{yearCats[t.category]=(yearCats[t.category]||0)+t.amount;});
  }
  const sortedCats=Object.entries(yearCats).sort((a,b)=>b[1]-a[1]);
  document.getElementById('annual-cat-grid').innerHTML=sortedCats.length?`
    <div class="panel" style="grid-column:1/-1">
      <div class="panel-header"><div class="panel-title">Despesas por categoria — ${annualYear}</div></div>
      <div style="padding:14px">${sortedCats.map(([cat,amt])=>{
        const pct=yearExp>0?Math.round(amt/yearExp*100):0;
        return `<div class="cat-item"><div class="cat-dot" style="background:${CAT_COLORS[cat]||'#94a3b8'}"></div><div class="cat-name">${CAT_ICONS[cat]||'📦'} ${cat.charAt(0).toUpperCase()+cat.slice(1)}</div><div class="cat-amount" style="color:${CAT_COLORS[cat]||'#94a3b8'};font-size:12px">${fmt(amt)}</div><div class="cat-pct">${pct}%</div></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${CAT_COLORS[cat]||'#94a3b8'}"></div></div>`;
      }).join('')}</div>
    </div>`:'';
}

// ── INVESTMENTS ──
const INV_TYPES={'renda-fixa':{icon:'📊',label:'Renda Fixa',color:'#60a5fa'},'acoes':{icon:'📈',label:'Ações',color:'#3ecf8e'},'fii':{icon:'🏢',label:'FII',color:'#c084fc'},'cripto':{icon:'🪙',label:'Cripto',color:'#fbbf24'},'poupanca':{icon:'🏦',label:'Poupança',color:'#38bdf8'},'fundo':{icon:'💼',label:'Fundo',color:'#fb923c'},'outro':{icon:'📦',label:'Outro',color:'#94a3b8'}};
let editingInvId=null, invOpType=null, invOpTargetId=null;

function getInvBalance(inv){
  return (inv.operations||[]).reduce((s,op)=>s+(op.type==='redeem'?-op.amount:op.amount),0);
}
function getInvTotalApplied(inv){return (inv.operations||[]).filter(op=>op.type==='apply').reduce((s,op)=>s+op.amount,0);}
function getInvTotalRedeemed(inv){return (inv.operations||[]).filter(op=>op.type==='redeem').reduce((s,op)=>s+op.amount,0);}
function getInvTotalYield(inv){return (inv.operations||[]).filter(op=>op.type==='yield').reduce((s,op)=>s+op.amount,0);}
function getInvYieldPct(inv){const applied=getInvTotalApplied(inv);const yld=getInvTotalYield(inv);return applied>0?((yld/applied)*100):0;}

function renderInvestments(){
  const totalBalance=investments.reduce((s,inv)=>s+getInvBalance(inv),0);
  const totalApplied=investments.reduce((s,inv)=>s+getInvTotalApplied(inv),0);
  const totalRedeemed=investments.reduce((s,inv)=>s+getInvTotalRedeemed(inv),0);
  const totalYield=investments.reduce((s,inv)=>s+getInvTotalYield(inv),0);
  const totalYieldPct=totalApplied>0?((totalYield/totalApplied)*100):0;

  document.getElementById('inv-summary').innerHTML=`
    <div class="card" style="flex:1;min-width:140px"><div class="card-label">Patrimônio investido</div><div class="card-value" style="color:var(--accent);font-size:20px">${fmt(totalBalance)}</div><div class="card-sub">${investments.length} investimento${investments.length!==1?'s':''}</div></div>
    <div class="card" style="flex:1;min-width:140px"><div class="card-label">Total aplicado</div><div class="card-value" style="color:var(--green);font-size:20px">${fmt(totalApplied)}</div></div>
    <div class="card" style="flex:1;min-width:140px"><div class="card-label">Rendimento</div><div class="card-value" style="color:#22d3ee;font-size:20px">${fmt(totalYield)}</div><div class="card-sub" style="color:${totalYieldPct>=0?'#22d3ee':'var(--red)'}">${totalYieldPct>=0?'+':''}${totalYieldPct.toFixed(2)}%</div></div>
    <div class="card" style="flex:1;min-width:140px"><div class="card-label">Total resgatado</div><div class="card-value" style="color:var(--amber);font-size:20px">${fmt(totalRedeemed)}</div></div>
  `;

  const list=document.getElementById('inv-list');
  if(!investments.length){
    list.innerHTML='<div class="empty"><div class="empty-icon">📊</div><div>Nenhum investimento cadastrado</div><div style="font-size:12px;margin-top:4px;color:var(--text3)">Clique em "+ Novo investimento" para começar</div></div>';
    return;
  }

  list.innerHTML=investments.map(inv=>{
    const t=INV_TYPES[inv.type]||INV_TYPES.outro;
    const balance=getInvBalance(inv);
    const applied=getInvTotalApplied(inv);
    const redeemed=getInvTotalRedeemed(inv);
    const yld=getInvTotalYield(inv);
    const yldPct=getInvYieldPct(inv);
    const ops=(inv.operations||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
    const recentOps=ops.slice(0,3);
    const sid=String(inv.id);
    const opIcon=op=>op.type==='apply'?'↑':op.type==='yield'?'✦':'↓';
    const opBg=op=>op.type==='apply'?'var(--greenbg)':op.type==='yield'?'rgba(34,211,238,.12)':'var(--amberbg)';
    const opColor=op=>op.type==='apply'?'var(--green)':op.type==='yield'?'#22d3ee':'var(--amber)';
    const opLabel=op=>op.desc||(op.type==='apply'?'Aplicação':op.type==='yield'?'Rendimento':'Resgate');
    const opSign=op=>op.type==='redeem'?'-':'+';

    return `<div class="inv-card" data-invid="${sid}" onclick="openInvForm('${sid}')" style="cursor:pointer">
      <div class="inv-header">
        <div>
          <div class="inv-name">${t.icon} ${escHtml(inv.name)}</div>
          ${inv.note?`<div style="font-size:12px;color:var(--text3);margin-top:2px">${escHtml(inv.note)}</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="inv-type-badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">${t.label}</span>
          <button class="inv-del-btn" onclick="event.stopPropagation();deleteInvestment('${sid}')" title="Excluir">✕</button>
        </div>
      </div>
      <div class="inv-balance" style="color:${balance>=0?'var(--text)':'var(--red)'}">${fmt(balance)}</div>
      <div class="inv-stats">
        <div class="inv-stat"><div class="inv-stat-label">Aplicado</div><div class="inv-stat-value" style="color:var(--green)">${fmt(applied)}</div></div>
        <div class="inv-stat"><div class="inv-stat-label">Rendimento</div><div class="inv-stat-value" style="color:#22d3ee">${fmt(yld)} <span style="font-size:11px;opacity:.7">${yldPct>=0?'+':''}${yldPct.toFixed(1)}%</span></div></div>
        <div class="inv-stat"><div class="inv-stat-label">Resgatado</div><div class="inv-stat-value" style="color:var(--amber)">${fmt(redeemed)}</div></div>
      </div>
      ${recentOps.length?`<div class="inv-history">${recentOps.map(op=>`
        <div class="inv-tx">
          <div class="inv-tx-icon" style="background:${opBg(op)}">${opIcon(op)}</div>
          <div class="inv-tx-info">
            <div class="inv-tx-desc">${opLabel(op)}</div>
            <div class="inv-tx-date">${op.date.slice(8,10)}/${op.date.slice(5,7)}/${op.date.slice(0,4)}</div>
          </div>
          <div class="inv-tx-amount" style="color:${opColor(op)}">${opSign(op)}${fmt(op.amount)}</div>
        </div>`).join('')}
        ${ops.length>3?`<div style="text-align:center;padding:6px 0"><button class="budget-edit" onclick="event.stopPropagation();openInvDetail('${sid}')" style="font-size:12px">Ver todas (${ops.length})</button></div>`:''}
      </div>`:''}
      <div class="inv-actions" onclick="event.stopPropagation()">
        <button class="inv-btn apply" onclick="openInvOp('${sid}','apply')">+ Aplicar</button>
        <button class="inv-btn yield" onclick="openInvOp('${sid}','yield')">✦ Rendimento</button>
        <button class="inv-btn redeem" onclick="openInvOp('${sid}','redeem')">↓ Resgatar</button>
      </div>
    </div>`;
  }).join('');
}

function openInvForm(id){
  editingInvId=id||null;
  const inv=id?investments.find(i=>String(i.id)===String(id)):null;
  document.getElementById('inv-form-title').textContent=inv?'Editar investimento':'Novo investimento';
  document.getElementById('inv-name').value=inv?inv.name:'';
  document.getElementById('inv-type').value=inv?inv.type:'renda-fixa';
  document.getElementById('inv-note').value=inv?inv.note||'':'';
  document.getElementById('inv-form-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('inv-name').focus(),50);
}
function closeInvForm(){document.getElementById('inv-form-overlay').classList.add('hidden');editingInvId=null;}

function saveInvestment(){
  const name=document.getElementById('inv-name').value.trim();
  const type=document.getElementById('inv-type').value;
  const note=document.getElementById('inv-note').value.trim();
  if(!name){alert('Informe o nome do investimento');return;}
  if(editingInvId){
    const inv=investments.find(i=>String(i.id)===String(editingInvId));
    if(inv){inv.name=name;inv.type=type;inv.note=note||undefined;}
  } else {
    investments.push({id:'inv'+Date.now(),name,type,note:note||undefined,operations:[]});
  }
  markUnsaved();closeInvForm();renderInvestments();
}

function deleteInvestment(id){
  const inv=investments.find(i=>String(i.id)===String(id));
  if(!inv) return;
  const ops=(inv.operations||[]).length;
  const msg=ops?`Excluir "${inv.name}"?\n\n${ops} operação${ops>1?'ões':''} será${ops>1?'ão':''} removida${ops>1?'s':''}.`:`Excluir "${inv.name}"?`;
  if(!confirm(msg)) return;
  investments=investments.filter(i=>String(i.id)!==String(id));
  markUnsaved();renderInvestments();
}

function openInvOp(invId,type){
  invOpTargetId=invId;invOpType=type;
  const inv=investments.find(i=>String(i.id)===String(invId));
  const labels={apply:`Aplicação — ${inv.name}`,yield:`Rendimento — ${inv.name}`,redeem:`Resgate — ${inv.name}`};
  const btnLabels={apply:'Aplicar',yield:'Registrar rendimento',redeem:'Resgatar'};
  const btnBg={apply:'var(--green)',yield:'#22d3ee',redeem:'var(--amber)'};
  const btnColor={apply:'#0d2820',yield:'#0a3340',redeem:'#261d08'};
  document.getElementById('inv-op-title').textContent=labels[type];
  document.getElementById('inv-op-amount').value='';
  document.getElementById('inv-op-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('inv-op-desc').value='';
  const saveBtn=document.getElementById('inv-op-save-btn');
  saveBtn.textContent=btnLabels[type];
  saveBtn.style.background=btnBg[type];
  saveBtn.style.color=btnColor[type];
  document.getElementById('inv-op-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('inv-op-amount').focus(),50);
}
function closeInvOp(){document.getElementById('inv-op-overlay').classList.add('hidden');invOpTargetId=null;invOpType=null;}

function saveInvOperation(){
  const amount=parseMoneyInput(document.getElementById('inv-op-amount').value);
  const date=document.getElementById('inv-op-date').value;
  const desc=document.getElementById('inv-op-desc').value.trim();
  if(!amount||amount<=0){alert('Informe um valor válido');return;}
  if(!date){alert('Informe a data');return;}
  const inv=investments.find(i=>String(i.id)===String(invOpTargetId));
  if(!inv) return;
  if(invOpType==='redeem'){
    const balance=getInvBalance(inv);
    if(amount>balance){alert(`Saldo insuficiente. Saldo atual: ${fmt(balance)}`);return;}
  }
  if(!inv.operations) inv.operations=[];
  inv.operations.push({id:'op'+Date.now(),type:invOpType,amount,date,desc:desc||undefined});
  markUnsaved();closeInvOp();renderInvestments();
}

function openInvDetail(invId){
  const inv=investments.find(i=>String(i.id)===String(invId));
  if(!inv) return;
  const t=INV_TYPES[inv.type]||INV_TYPES.outro;
  const ops=(inv.operations||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const balance=getInvBalance(inv);

  document.getElementById('inv-detail-title').textContent=`${t.icon} ${inv.name}`;
  let running=0;
  const opsAsc=(inv.operations||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const balanceMap={};
  opsAsc.forEach(op=>{running+=(op.type==='redeem'?-op.amount:op.amount);balanceMap[op.id]=running;});
  const yld=getInvTotalYield(inv);
  const yldPct=getInvYieldPct(inv);
  const dOpIcon=op=>op.type==='apply'?'↑':op.type==='yield'?'✦':'↓';
  const dOpBg=op=>op.type==='apply'?'var(--greenbg)':op.type==='yield'?'rgba(34,211,238,.12)':'var(--amberbg)';
  const dOpColor=op=>op.type==='apply'?'var(--green)':op.type==='yield'?'#22d3ee':'var(--amber)';
  const dOpLabel=op=>escHtml(op.desc||(op.type==='apply'?'Aplicação':op.type==='yield'?'Rendimento':'Resgate'));
  const dOpSign=op=>op.type==='redeem'?'-':'+';

  document.getElementById('inv-detail-content').innerHTML=`
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <div class="card" style="flex:1;min-width:100px"><div class="card-label">Saldo atual</div><div class="card-value" style="font-size:18px;color:var(--accent)">${fmt(balance)}</div></div>
      <div class="card" style="flex:1;min-width:100px"><div class="card-label">Aplicado</div><div class="card-value" style="font-size:18px;color:var(--green)">${fmt(getInvTotalApplied(inv))}</div></div>
      <div class="card" style="flex:1;min-width:100px"><div class="card-label">Rendimento</div><div class="card-value" style="font-size:18px;color:#22d3ee">${fmt(yld)}</div><div class="card-sub" style="color:${yldPct>=0?'#22d3ee':'var(--red)'}">${yldPct>=0?'+':''}${yldPct.toFixed(2)}%</div></div>
      <div class="card" style="flex:1;min-width:100px"><div class="card-label">Resgatado</div><div class="card-value" style="font-size:18px;color:var(--amber)">${fmt(getInvTotalRedeemed(inv))}</div></div>
    </div>
    <div style="font-family:var(--font-heading);font-size:14px;font-weight:700;margin-bottom:10px">Histórico de operações</div>
    ${ops.length?`<div style="max-height:350px;overflow-y:auto">${ops.map(op=>`
      <div class="inv-tx" style="padding:10px 0">
        <div class="inv-tx-icon" style="background:${dOpBg(op)}; font-size:14px">${dOpIcon(op)}</div>
        <div class="inv-tx-info">
          <div class="inv-tx-desc">${dOpLabel(op)}</div>
          <div class="inv-tx-date">${op.date.slice(8,10)}/${op.date.slice(5,7)}/${op.date.slice(0,4)}</div>
        </div>
        <div style="text-align:right">
          <div class="inv-tx-amount" style="color:${dOpColor(op)}">${dOpSign(op)}${fmt(op.amount)}</div>
          <div style="font-size:11px;color:var(--text3)">Saldo: ${fmt(balanceMap[op.id]||0)}</div>
        </div>
        <button class="tx-del" style="opacity:1" onclick="deleteInvOp('${invId}','${op.id}')">✕</button>
      </div>`).join('')}</div>`:'<div class="empty"><div class="empty-icon" style="font-size:24px">📭</div><div>Nenhuma operação registrada</div></div>'}
  `;
  document.getElementById('inv-detail-overlay').classList.remove('hidden');
}
function closeInvDetail(){document.getElementById('inv-detail-overlay').classList.add('hidden');}

function deleteInvOp(invId,opId){
  const inv=investments.find(i=>String(i.id)===String(invId));
  if(!inv) return;
  if(!confirm('Excluir esta operação?')) return;
  inv.operations=(inv.operations||[]).filter(op=>String(op.id)!==String(opId));
  markUnsaved();
  openInvDetail(invId);
  renderInvestments();
}

// Event delegation — transaction list
document.getElementById('tx-list').addEventListener('click',function(e){
  const checkBtn=e.target.closest('[data-check]');
  if(checkBtn){e.stopPropagation();toggleTxPaid(checkBtn.dataset.check);return;}
  const delBtn=e.target.closest('[data-del]');
  if(delBtn){e.stopPropagation();deleteTx(delBtn.dataset.del);return;}
  const row=e.target.closest('.tx-item:not(.locked)');
  if(row&&row.dataset.txid) editTx(row.dataset.txid);
});
// Event delegation — recurring list
document.getElementById('recur-list').addEventListener('click',function(e){
  const editBtn=e.target.closest('[data-edit-recur]');
  if(editBtn){editRecur(editBtn.dataset.editRecur);return;}
  const delBtn=e.target.closest('[data-del-recur]');
  if(delBtn){deleteRecur(delBtn.dataset.delRecur);}
});
document.getElementById('pay-modal').addEventListener('click',function(e){if(e.target===this)closePayModal();});
document.getElementById('unlock-modal').addEventListener('click',function(e){if(e.target===this)closeUnlockModal();});
document.getElementById('delete-modal').addEventListener('click',function(e){if(e.target===this)closeDeleteModal();});
document.getElementById('budget-modal').addEventListener('click',function(e){if(e.target===this)closeBudgetModal();});
document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeForm();});
document.getElementById('inv-form-overlay').addEventListener('click',function(e){if(e.target===this)closeInvForm();});
document.getElementById('inv-op-overlay').addEventListener('click',function(e){if(e.target===this)closeInvOp();});
document.getElementById('inv-detail-overlay').addEventListener('click',function(e){if(e.target===this)closeInvDetail();});
document.getElementById('bulk-overlay').addEventListener('click',function(e){if(e.target===this)closeBulkEntry();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePayModal();closePayInvoiceModal();closeUnlockModal();closeDeleteModal();closeBudgetModal();closeForm();closeInvForm();closeInvOp();closeInvDetail();closeMoreMenu();closeBulkEntry();closeMonthPicker();}});
document.addEventListener('keydown',e=>{
  // Ignorar quando digitando em input/textarea/select
  const tag=(e.target&&e.target.tagName)||'';
  if(['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(document.getElementById('app-screen').style.display==='none') return;
  // Bloquear se algum modal aberto
  const anyOpen=document.querySelector('.modal-overlay:not(.hidden), .overlay:not(.hidden)');
  if(anyOpen) return;
  const k=e.key.toLowerCase();
  if(k==='n'){e.preventDefault();openForm();}
  else if(k==='m'){e.preventDefault();openBulkEntry();}
  else if(k==='/'){e.preventDefault();const s=document.getElementById('tx-search');if(s){s.focus();s.select();}}
  else if(e.key==='ArrowLeft'){changeMonth(-1);}
  else if(e.key==='ArrowRight'){changeMonth(1);}
});

// ── MONTH/YEAR PICKER ──
let pickerYear=null;
function openMonthPicker(){
  pickerYear=currentYear;
  renderMonthPicker();
  document.getElementById('month-picker').classList.remove('hidden');
}
function closeMonthPicker(){const m=document.getElementById('month-picker');if(m)m.classList.add('hidden');}
function changeMpYear(d){pickerYear+=d;renderMonthPicker();}
function pickerToToday(){const d=new Date();currentYear=d.getFullYear();currentMonth=d.getMonth();closeMonthPicker();applyRecurrences();render();}
function renderMonthPicker(){
  document.getElementById('mp-year').textContent=pickerYear;
  const grid=document.getElementById('mp-grid');
  grid.innerHTML=MONTHS_SHORT.map((lbl,i)=>{
    const active=(i===currentMonth&&pickerYear===currentYear);
    const paid=isMonthPaid(pickerYear,i);
    const closed=isMonthClosed(pickerYear,i);
    const hasTxs=transactions.some(t=>{const k=getTxInvoiceKey(t);return k===monthKey(pickerYear,i);});
    let dotColor='';
    if(paid) dotColor='var(--green)';
    else if(closed) dotColor='var(--amber)';
    else if(hasTxs) dotColor='var(--accent)';
    const dot=dotColor?`<span class="mp-dot" style="background:${dotColor}"></span>`:'';
    return `<button class="mp-month${active?' active':''}" onclick="pickerPickMonth(${i})">${lbl}${dot}</button>`;
  }).join('');
}
function pickerPickMonth(m){
  currentYear=pickerYear;
  currentMonth=m;
  closeMonthPicker();
  applyRecurrences();
  render();
}

// ── SETTINGS (closeDay/dueDay) ──
function openSettings(){
  document.getElementById('cfg-close-day').value=settings.closeDay||'';
  document.getElementById('cfg-due-day').value=settings.dueDay||'';
  document.getElementById('cfg-auto-close').checked=!!settings.autoClose;
  document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettings(){const m=document.getElementById('settings-modal');if(m)m.classList.add('hidden');}
function stepCfg(id,delta){
  const el=document.getElementById(id);
  if(!el) return;
  const cur=parseInt(el.value);
  let v=(isNaN(cur)?1:cur)+delta;
  if(v<1) v=1; else if(v>31) v=31;
  el.value=v;
}
function saveSettings(){
  const cd=parseInt(document.getElementById('cfg-close-day').value);
  const dd=parseInt(document.getElementById('cfg-due-day').value);
  settings.closeDay=(cd>=1&&cd<=31)?cd:null;
  settings.dueDay=(dd>=1&&dd<=31)?dd:null;
  settings.autoClose=document.getElementById('cfg-auto-close').checked;
  markUnsaved();
  closeSettings();
  runAutoClose();
  render();
  maybeShowDueBanner();
}

// Fecha automaticamente faturas de meses já passados (após o dia de fechamento)
function runAutoClose(){
  if(!settings.autoClose||!settings.closeDay) return;
  const today=new Date();
  const ty=today.getFullYear(), tm=today.getMonth(), td=today.getDate();
  let changed=false;
  // Percorre todos os meses com transações
  const monthSet=new Set();
  transactions.forEach(t=>{
    const k=getTxInvoiceKey(t);
    monthSet.add(k);
  });
  monthSet.forEach(key=>{
    const [y,m]=key.split('-').map(Number);
    const mi=m-1;
    // Mês totalmente no passado: fecha se não estiver pago/fechado
    const isPast=(y<ty)||(y===ty&&mi<tm);
    // Mês atual: só fecha se passou do dia de fechamento
    const isCurrentMonthClosed=(y===ty&&mi===tm&&td>settings.closeDay);
    if((isPast||isCurrentMonthClosed)&&!isMonthPaid(y,mi)&&!isMonthClosed(y,mi)){
      closedMonths.push(key);
      changed=true;
    }
  });
  if(changed) saveToLS();
}

// Banner de vencimento próximo
function maybeShowDueBanner(){
  const el=document.getElementById('due-banner');
  if(!el) return;
  if(!settings.dueDay){el.style.display='none';return;}
  const today=new Date();
  // Checa faturas fechadas (não pagas) cujo vencimento é próximo
  const closedKeys=closedMonths.filter(k=>!paidMonths.includes(k));
  let closestMsg=null, mostUrgent=999;
  closedKeys.forEach(key=>{
    const [y,m]=key.split('-').map(Number);
    // Data de vencimento: dueDay do mês seguinte ao fechamento (padrão cartão)
    let dy=y, dm=m;
    dm++;
    if(dm>12){dm=1;dy++;}
    const dueDate=new Date(dy,dm-1,settings.dueDay);
    const diffDays=Math.ceil((dueDate-today)/(1000*60*60*24));
    if(diffDays>=-1&&diffDays<=3&&diffDays<mostUrgent){
      mostUrgent=diffDays;
      const total=transactions.filter(t=>getTxInvoiceKey(t)===key&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
      const when=diffDays<0?'venceu ontem':diffDays===0?'vence hoje':diffDays===1?'vence amanhã':`vence em ${diffDays} dias`;
      closestMsg=`💸 Fatura de ${MONTHS_SHORT[m-1]}/${y} ${when} · ${fmt(total)}`;
    }
  });
  if(closestMsg){
    el.innerHTML=`<span>${closestMsg}</span><button class="backup-banner-btn" onclick="openPayInvoiceModal()">Pagar</button><button class="backup-banner-close" onclick="document.getElementById('due-banner').style.display='none'" title="Dispensar">✕</button>`;
    el.style.display='flex';
  } else {
    el.style.display='none';
  }
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'&&document.getElementById('app-screen').style.display!=='none'){e.preventDefault();saveToFile();}});

// Init money input formatters
initMoneyInputs();
// Update hint when amount changes
document.getElementById('f-amount').addEventListener('moneychange',()=>{if(recurType==='installment')updateParcelaHint();});

// ── BULK ENTRY (tabela inline estilo planilha) ──
const AUTO_CAT_MAP=[
  // Transporte
  {kw:['uber','99 ','lyft','cabify','taxi','táxi','estacionamento','combustivel','combustível','gasolina','etanol','posto','pedagio','pedágio','sem parar'],cat:'transporte'},
  // Assinaturas
  {kw:['netflix','spotify','disney','hbo','amazon prime','prime video','youtube','apple music','deezer','globoplay','paramount','star+','crunchyroll','chatgpt','openai','icloud','google one','adobe'],cat:'assinaturas'},
  // Mercado
  {kw:['mercado','supermercado','carrefour','pao de acucar','pão de açúcar','extra ','atacadão','atacadao','assai','assaí','big ','maxxi','sams club','costco','hortifruti'],cat:'mercado'},
  // Alimentação
  {kw:['ifood','restaurante','lanchonete','pizzaria','padaria','burger','mcdonalds','mcdonald','subway','starbucks','outback','habib','sushi','açaí','acai','sorveteria','cafeteria'],cat:'alimentação'},
  // Saúde
  {kw:['farmacia','farmácia','drogaria','drogasil','droga raia','pacheco','hospital','clínica','clinica','laboratorio','laboratório','unimed','amil','sulamerica','hapvida','consulta medica'],cat:'saúde'},
  // Moradia
  {kw:['aluguel','condominio','condomínio','iptu','energia','eletricidade','enel','cemig','cpfl','agua','água','sabesp','copasa','gas encanado','gás'],cat:'moradia'},
  // Educação
  {kw:['escola','faculdade','universidade','curso','udemy','alura','mensalidade escolar','livro','livraria'],cat:'educação'},
  // Lazer
  {kw:['cinema','teatro','show','ingresso','parque','viagem','hotel','airbnb','booking','decolar','latam','gol ','azul ','passagem'],cat:'lazer'},
  // Beleza
  {kw:['salão','salao','barbearia','cabelereiro','manicure','estetica','estética','cosmetico','cosmético','perfumaria','boticario','boticário','natura ','avon '],cat:'beleza'},
  // Contas
  {kw:['fatura','boleto','conta de luz','conta de agua','conta de água','conta de gas','conta de gás','internet','telefone','celular','claro','vivo','tim ','oi '],cat:'contas'},
  // Pet
  {kw:['pet shop','petshop','petz','cobasi','ração','racao'],cat:'pet shop'},
  {kw:['veterinario','veterinário','vet ','veterin'],cat:'veterinário'},
  // Compras
  {kw:['magazine','magalu','americanas','shopee','mercado livre','shein','amazon','aliexpress','casas bahia','renner','riachuelo','c&a','zara','centauro','decathlon','kabum','ponto frio'],cat:'compras'},
  // Salário / Receitas
  {kw:['salario','salário','pagamento','remuneração','remuneracao','prolabore','pró-labore'],cat:'salário'},
  {kw:['rendimento','dividendo','juros','cashback','reembolso','estorno','devolução','devoluçao'],cat:'outras receitas'},
];

let bulkRows=[];
const BULK_FIELDS=['date','desc','parcela','valor','type','respId'];

function emptyBulkRow(){return {date:'',desc:'',parcela:'',valor:'',type:'expense',respId:''}}

function openBulkEntry(){
  if(isCurrentPaid()){alert('Esta fatura está paga. Reabra para lançar.');return;}
  if(isCurrentClosed()){
    const nxt=nextOpenInvoiceKey(currentYear,currentMonth);
    const [ny,nm]=nxt.split('-');
    showRollToast(`Fatura fechada — lançamentos irão para ${MONTHS_SHORT[parseInt(nm)-1]}/${ny}`);
  }
  bulkRows=Array.from({length:5},()=>emptyBulkRow());
  renderBulkTable();
  document.getElementById('bulk-overlay').classList.remove('hidden');
}

function closeBulkEntry(){
  document.getElementById('bulk-overlay').classList.add('hidden');
  bulkRows=[];
}

function addBulkRow(){bulkRows.push(emptyBulkRow());renderBulkTable();}
function removeBulkRow(i){bulkRows.splice(i,1);if(!bulkRows.length)bulkRows.push(emptyBulkRow());renderBulkTable();}

function normalizeDateInput(s){
  s=(s||'').trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(m) return `20${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return '';
}

function parseAmountInput(s){
  s=(s||'').trim().replace(/[^\d.,-]/g,'');
  if(!s) return NaN;
  if(s.indexOf(',')>=0) return parseFloat(s.replace(/\./g,'').replace(',','.'));
  return parseFloat(s);
}

function parseTypeInput(s){
  s=(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if(s.startsWith('rec')||s==='income'||s==='r'||s==='i'||s==='+') return 'income';
  return 'expense';
}

function matchRespId(s){
  s=(s||'').trim();
  if(!s) return '';
  const r=responsibles.find(x=>x.name.toLowerCase().trim()===s.toLowerCase());
  return r?r.id:'';
}

function detectCategory(memo,isIncome){
  const lower=(memo||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for(const rule of AUTO_CAT_MAP){
    for(const kw of rule.kw){
      const kwNorm=kw.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if(lower.includes(kwNorm)) return rule.cat;
    }
  }
  return isIncome?'outras receitas':'outros';
}

function isDuplicateTx(date,amount,desc){
  return transactions.some(t=>{
    if(t.date!==date) return false;
    if(Math.abs(t.amount-amount)>0.01) return false;
    const a=t.desc.toLowerCase().trim();
    const b=desc.toLowerCase().trim();
    if(a===b) return true;
    if(a.includes(b)||b.includes(a)) return true;
    return false;
  });
}

function renderBulkTable(){
  const tbody=document.getElementById('bulk-tbody');
  const respOpts='<option value="">—</option>'+responsibles.map(r=>`<option value="${r.id}">${escHtml(r.name)}</option>`).join('');
  tbody.innerHTML=bulkRows.map((r,i)=>`
    <tr>
      <td style="width:28px;text-align:center;color:var(--text3);font-size:11px">${i+1}</td>
      <td><input type="text" class="bulk-in bulk-date" data-row="${i}" data-field="date" value="${escHtml(r.date||'')}" placeholder="DD/MM/AAAA" style="width:110px"/></td>
      <td><input type="text" class="bulk-in" data-row="${i}" data-field="desc" value="${escHtml(r.desc||'')}" placeholder="Descrição"/></td>
      <td><input type="text" class="bulk-in" data-row="${i}" data-field="parcela" value="${escHtml(r.parcela||'')}" placeholder="1/12" style="width:60px"/></td>
      <td><input type="text" class="bulk-in money-input" data-row="${i}" data-field="valor" value="${escHtml(r.valor||'')}" placeholder="R$ 0,00" style="width:110px;text-align:right"/></td>
      <td><select class="bulk-in" data-row="${i}" data-field="type"><option value="expense"${r.type==='expense'?' selected':''}>Despesa</option><option value="income"${r.type==='income'?' selected':''}>Receita</option></select></td>
      <td><select class="bulk-in" data-row="${i}" data-field="respId">${respOpts.replace(`value="${r.respId}"`,`value="${r.respId}" selected`)}</select></td>
      <td><button class="bulk-del" onclick="removeBulkRow(${i})" title="Remover linha">✕</button></td>
    </tr>
  `).join('');
  // Mirror mobile cards
  const mob=document.getElementById('bulk-mobile');
  if(mob){
    mob.innerHTML=bulkRows.map((r,i)=>`
      <div class="bulk-mcard">
        <button class="bulk-del" onclick="removeBulkRow(${i})" title="Remover">✕</button>
        <div class="bulk-mnum">#${i+1}</div>
        <div class="bulk-mrow">
          <div class="bulk-mfield" style="min-width:100%"><label>Descrição</label><input type="text" class="bulk-in" data-row="${i}" data-field="desc" value="${escHtml(r.desc||'')}" placeholder="Descrição"/></div>
        </div>
        <div class="bulk-mrow">
          <div class="bulk-mfield"><label>Data</label><input type="text" class="bulk-in bulk-date" data-row="${i}" data-field="date" value="${escHtml(r.date||'')}" placeholder="DD/MM/AAAA"/></div>
          <div class="bulk-mfield"><label>Valor</label><input type="text" class="bulk-in money-input" data-row="${i}" data-field="valor" value="${escHtml(r.valor||'')}" placeholder="R$ 0,00"/></div>
        </div>
        <div class="bulk-mrow">
          <div class="bulk-mfield"><label>Parcela</label><input type="text" class="bulk-in" data-row="${i}" data-field="parcela" value="${escHtml(r.parcela||'')}" placeholder="3/12"/></div>
          <div class="bulk-mfield"><label>Tipo</label><select class="bulk-in" data-row="${i}" data-field="type"><option value="expense"${r.type==='expense'?' selected':''}>Despesa</option><option value="income"${r.type==='income'?' selected':''}>Receita</option></select></div>
        </div>
        <div class="bulk-mrow">
          <div class="bulk-mfield" style="min-width:100%"><label>Responsável</label><select class="bulk-in" data-row="${i}" data-field="respId">${respOpts.replace(`value="${r.respId}"`,`value="${r.respId}" selected`)}</select></div>
        </div>
      </div>
    `).join('');
  }
  initMoneyInputs();
  const allInputs=document.querySelectorAll('#bulk-tbody .bulk-in, #bulk-mobile .bulk-in');
  allInputs.forEach(el=>{
    el.addEventListener('input',e=>{bulkRows[+e.target.dataset.row][e.target.dataset.field]=e.target.value;});
    el.addEventListener('change',e=>{bulkRows[+e.target.dataset.row][e.target.dataset.field]=e.target.value;});
    el.addEventListener('paste',handleBulkPaste);
  });
  document.querySelectorAll('#bulk-tbody .bulk-date, #bulk-mobile .bulk-date').forEach(el=>{
    el.addEventListener('blur',e=>{
      const norm=normalizeDateInput(e.target.value);
      if(norm){
        bulkRows[+e.target.dataset.row].date=norm;
        e.target.value=norm;
      }
    });
  });
  updateBulkCount();
}

function handleBulkPaste(e){
  const target=e.target;
  const cd=e.clipboardData||window.clipboardData;
  if(!cd) return;
  const text=cd.getData('text');
  if(!text||(!text.includes('\t')&&!text.includes('\n'))) return;
  e.preventDefault();
  const rowIdx=parseInt(target.dataset.row);
  const fieldIdx=BULK_FIELDS.indexOf(target.dataset.field);
  if(fieldIdx<0) return;
  const lines=text.replace(/\r/g,'').split('\n').filter(l=>l.length);
  lines.forEach((line,ri)=>{
    const cells=line.split('\t');
    const ti=rowIdx+ri;
    while(bulkRows.length<=ti) bulkRows.push(emptyBulkRow());
    cells.forEach((raw,ci)=>{
      const f=BULK_FIELDS[fieldIdx+ci];
      if(!f) return;
      const val=(raw||'').trim();
      if(f==='date'){bulkRows[ti][f]=normalizeDateInput(val);}
      else if(f==='type'){bulkRows[ti][f]=parseTypeInput(val);}
      else if(f==='respId'){bulkRows[ti][f]=matchRespId(val);}
      else if(f==='valor'){bulkRows[ti][f]=val?formatMoneyInput(val):'';}
      else{bulkRows[ti][f]=val;}
    });
  });
  renderBulkTable();
}

function updateBulkCount(){
  const filled=bulkRows.filter(r=>r.desc||r.valor||r.date).length;
  const el=document.getElementById('bulk-count');
  if(el) el.textContent=`${filled} linha${filled!==1?'s':''} preenchida${filled!==1?'s':''}`;
  const btn=document.getElementById('bulk-import-btn');
  if(btn) btn.textContent=`Importar ${filled} lançamento${filled!==1?'s':''}`;
}

function findOrCreateInstallmentRecur(t){
  const normDesc=t.desc.toLowerCase().trim();
  let match=recurring.find(r=>r.isInstallment
    &&r.totalInstallments===t.totalInstallments
    &&r.desc.toLowerCase().trim()===normDesc);
  if(match) return match;
  // Inferir startYear/startMonth a partir da data e do número da parcela atual
  const d=new Date(t.date+'T12:00:00');
  const sDate=new Date(d.getFullYear(),d.getMonth()-(t.installmentNum-1),1);
  const nr={
    id:'rec'+Date.now()+Math.random(),
    desc:t.desc,amount:t.amount,type:t.type,category:t.category,
    respId:t.respId||null,
    isInstallment:true,
    totalInstallments:t.totalInstallments,
    startYear:sDate.getFullYear(),
    startMonth:sDate.getMonth(),
    manualOnly:true
  };
  recurring.push(nr);
  return nr;
}

function confirmBulkImport(){
  const errors=[];
  const toImport=[];
  bulkRows.forEach((r,i)=>{
    if(!r.desc&&!r.valor&&!r.date) return;
    const normDate=normalizeDateInput(r.date);
    if(!normDate){errors.push(`Linha ${i+1}: data inválida ou ausente`);return;}
    r.date=normDate;
    const amt=parseAmountInput(r.valor);
    if(isNaN(amt)||amt===0){errors.push(`Linha ${i+1}: valor inválido`);return;}
    let installmentNum=null,totalInstallments=null;
    if(r.parcela){
      const pm=r.parcela.match(/(\d+)\s*\/\s*(\d+)/);
      if(pm){
        installmentNum=parseInt(pm[1]);
        totalInstallments=parseInt(pm[2]);
        if(installmentNum<1||installmentNum>totalInstallments){
          errors.push(`Linha ${i+1}: parcela "${r.parcela}" inválida (${installmentNum} de ${totalInstallments})`);
          return;
        }
      } else {
        errors.push(`Linha ${i+1}: parcela "${r.parcela}" fora do formato N/M`);
        return;
      }
    }
    const desc=r.desc||'Sem descrição';
    toImport.push({
      date:r.date,desc,amount:Math.abs(amt),type:r.type||'expense',
      installmentNum,totalInstallments,
      respId:r.respId||null,
      category:detectCategory(desc,r.type==='income')
    });
  });
  if(errors.length){alert(errors.join('\n'));return;}
  if(!toImport.length){alert('Preencha pelo menos uma linha.');return;}
  let imported=0;
  let recursCreated=0;
  toImport.forEach(t=>{
    const tx={
      id:'tx'+Date.now()+Math.random()+'-'+imported,
      desc:t.desc,amount:t.amount,type:t.type,
      category:t.category,date:t.date,
      invoiceKey:resolveInvoiceForDate(t.date),
      respId:t.respId,
      note:'Lançamento em massa'
    };
    if(t.installmentNum&&t.totalInstallments){
      const before=recurring.length;
      const recur=findOrCreateInstallmentRecur(t);
      if(recurring.length>before) recursCreated++;
      // Backfill de parcelas anteriores (1..installmentNum-1)
      for(let n=1;n<t.installmentNum;n++){
        const existing=transactions.find(x=>x.recurId===recur.id&&x.installmentNum===n);
        if(existing) continue;
        let ty=recur.startYear, tm=recur.startMonth+(n-1);
        while(tm>11){tm-=12;ty++;}
        if(isMonthPaid(ty,tm)) continue; // não mexe em fatura paga
        const mm=String(tm+1).padStart(2,'0');
        const backDate=`${ty}-${mm}-01`;
        transactions.push({
          id:'tx'+Date.now()+Math.random()+'-bf'+n,
          desc:t.desc,amount:t.amount,type:t.type,
          category:t.category,date:backDate,
          invoiceKey:resolveInvoiceForDate(backDate),
          respId:t.respId,
          recurId:recur.id,
          installmentNum:n,
          totalInstallments:t.totalInstallments,
          note:'Parcela retroativa (massa)'
        });
        imported++;
      }
      // Evitar duplicação se já existe tx com mesmo recurId+installmentNum
      const dup=transactions.find(x=>x.recurId===recur.id&&x.installmentNum===t.installmentNum);
      if(dup) return;
      tx.recurId=recur.id;
      tx.installmentNum=t.installmentNum;
      tx.totalInstallments=t.totalInstallments;
    }
    transactions.push(tx);
    imported++;
  });
  markUnsaved();
  closeBulkEntry();
  render();
  const toast=document.getElementById('toast');
  toast.textContent=`✓ ${imported} lançamento${imported!==1?'s':''} importado${imported!==1?'s':''}${recursCreated?` · ${recursCreated} parcelamento${recursCreated!==1?'s':''} criado${recursCreated!==1?'s':''}`:''}!`;
  toast.classList.add('show');
  setTimeout(()=>{toast.classList.remove('show');toast.textContent='✓ Arquivo salvo com sucesso!';},3000);
}

// ── EXPORT CSV ──
function csvEscape(v){
  v=v==null?'':String(v);
  if(/[;"\n\r]/.test(v)) return '"'+v.replace(/"/g,'""')+'"';
  return v;
}
function exportCsv(){
  const txs=getCurrentTxs().slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!txs.length){alert('Sem transações no mês atual para exportar.');return;}
  const header='data;descricao;parcela;valor;type;responsavel;categoria;nota';
  const lines=txs.map(t=>{
    const parcela=t.installmentNum&&t.totalInstallments?`${t.installmentNum}/${t.totalInstallments}`:'';
    const valor=t.amount.toFixed(2).replace('.',',');
    const tipo=t.type==='income'?'Receita':'Despesa';
    const resp=t.respId?getRespName(t.respId):'';
    return [t.date,t.desc,parcela,valor,tipo,resp,t.category||'',t.note||''].map(csvEscape).join(';');
  });
  const csv='\uFEFF'+header+'\n'+lines.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`montra_${monthKey(currentYear,currentMonth)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  const toast=document.getElementById('toast');
  toast.textContent=`✓ ${txs.length} transações exportadas!`;
  toast.classList.add('show');
  setTimeout(()=>{toast.classList.remove('show');toast.textContent='✓ Arquivo salvo com sucesso!';},2500);
}

// ── EXTRATO PDF ──
function printExtrato(){
  const txs=getCurrentTxs().slice().sort((a,b)=>a.date.localeCompare(b.date));
  const income=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const monthLabel=MONTHS[currentMonth]+' '+currentYear;
  const generated=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const isPaid=isCurrentPaid();
  function fmtNum(v){return 'R$ '+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}

  let running=0;
  const rows=txs.map(t=>{
    const val=t.type==='income'?t.amount:-t.amount;
    running+=val;
    const sign=t.type==='income'?'+':'-';
    const color=t.type==='income'?'#16a34a':'#dc2626';
    const balColor=running>=0?'#16a34a':'#dc2626';
    let badgeHtml='';
    if(t.recurId){
      if(t.installmentNum){
        badgeHtml=`<span class="badge" style="background:#fef9c3;color:#a16207">${t.installmentNum}/${t.totalInstallments}</span>`;
      } else {
        badgeHtml='<span class="badge">Recorrente</span>';
      }
    }
    return `<tr>
      <td>${t.date.slice(8,10)}/${t.date.slice(5,7)}/${t.date.slice(0,4)}</td>
      <td>${escHtml(t.desc)}${badgeHtml}</td>
      <td>${t.category.charAt(0).toUpperCase()+t.category.slice(1)}</td>
      <td>${getRespName(t.respId)!=='—'?getRespName(t.respId):'—'}</td>
      <td style="color:${color};text-align:right;font-weight:600">${sign} ${fmtNum(t.amount)}</td>
      <td style="color:${balColor};text-align:right;font-weight:600">${fmtNum(running)}</td>
    </tr>`;
  }).join('');

  const logoUrl='https://mdendena2000.github.io/montra/logo.png';

  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>Extrato ${monthLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;padding:32px 40px;position:relative}
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);opacity:.04;pointer-events:none;z-index:0}
    .watermark img{width:500px;height:500px;object-fit:contain}
    .content{position:relative;z-index:1}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a2e;padding-bottom:16px;margin-bottom:20px}
    .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px;display:flex;align-items:center;gap:10px}
    .logo img{width:36px;height:36px;object-fit:contain}
    .header-info{text-align:right;color:#555}
    .header-info .period{font-size:16px;font-weight:700;color:#1a1a2e}
    .status-badge{display:inline-block;margin-top:4px;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;${isPaid?'background:#dcfce7;color:#16a34a;border:1px solid #86efac':'background:#fef9c3;color:#a16207;border:1px solid #fde047'}}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
    .summary-card{border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}
    .summary-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
    .summary-value{font-size:18px;font-weight:700;letter-spacing:-0.5px}
    .inc{color:#16a34a}.exp{color:#dc2626}.bal{color:${balance>=0?'#16a34a':'#dc2626'}}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#f3f4f6}
    th{padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#555;border-bottom:2px solid #e5e7eb}
    th:last-child,th:nth-last-child(2){text-align:right}
    td{padding:9px 10px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafafa}
    .badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-size:10px;background:#ede9fe;color:#7c3aed;font-weight:500}
    .empty{text-align:center;padding:40px;color:#aaa}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#aaa}
    .footer-logo{display:flex;align-items:center;gap:6px}
    .footer-logo img{width:16px;height:16px;object-fit:contain;opacity:.5}
    @media print{body{padding:20px 24px}.watermark{position:fixed}@page{margin:1cm}}
  </style></head><body>
  <div class="watermark"><img src="${logoUrl}"/></div>
  <div class="content">
  <div class="header">
    <div><div class="logo"><img src="${logoUrl}"/>Montra</div><div style="margin-top:4px;font-size:12px;color:#888">Extrato mensal de transações</div></div>
    <div class="header-info">
      <div class="period">${monthLabel}</div>
      <div style="font-size:11px;margin-top:2px">Emitido em ${generated}</div>
      <div class="status-badge">${isPaid?'✓ Mês fechado':'● Mês em aberto'}</div>
    </div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="summary-label">Total de receitas</div><div class="summary-value inc">${fmtNum(income)}</div></div>
    <div class="summary-card"><div class="summary-label">Total de despesas</div><div class="summary-value exp">${fmtNum(expense)}</div></div>
    <div class="summary-card"><div class="summary-label">Saldo do período</div><div class="summary-value bal">${fmtNum(balance)}</div></div>
  </div>
  ${txs.length?`<table>
    <thead><tr>
      <th>Data</th><th>Descrição</th><th>Categoria</th><th>Responsável</th><th style="text-align:right">Valor</th><th style="text-align:right">Saldo corrente</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`:'<div class="empty">Nenhuma transação neste mês.</div>'}
  <div class="footer">
    <span class="footer-logo"><img src="${logoUrl}"/> Montra — gerenciador de finanças pessoais</span>
    <span>${txs.length} transação${txs.length!==1?'ões':''} · ${monthLabel}</span>
  </div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
}

// Auto-load from localStorage on startup
(function(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(!raw) return;
    const data=JSON.parse(raw);
    transactions=data.transactions||[];
    recurring=data.recurring||[];
    responsibles=data.responsibles||[];
    paidMonths=data.paidMonths||[];
    closedMonths=data.closedMonths||[];
    budgets=data.budgets||{};
    investments=data.investments||[];
    settings=Object.assign({closeDay:null,dueDay:null,autoClose:false},data.settings||{});
    customCategories=Array.isArray(data.customCategories)?data.customCategories:[];
    applyCustomCategories();
    migrateInvoiceKeys();
    const btn=document.getElementById('btn-continue');
    const divider=document.getElementById('div-or-import');
    if(btn){btn.style.display='flex';}
    if(divider){divider.style.display='flex';}
  }catch(e){}
})();
