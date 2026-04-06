const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CAT_COLORS={'alimentação':'#f87171','transporte':'#fbbf24','moradia':'#60a5fa','saúde':'#3ecf8e','lazer':'#c084fc','educação':'#fb923c','salário':'#34d399','mercado':'#38bdf8','assinaturas':'#a78bfa','viagens':'#22d3ee','beleza':'#f9a8d4','contas':'#64748b','outras receitas':'#10b981','compras':'#e879f9','pet shop':'#f59e0b','veterinário':'#84cc16','outros':'#94a3b8'};
const CAT_ICONS={'alimentação':'🍽','transporte':'🚗','moradia':'🏠','saúde':'💊','lazer':'🎮','educação':'📚','salário':'💼','mercado':'🛒','assinaturas':'📺','viagens':'✈️','beleza':'💅','contas':'📄','outras receitas':'💰','compras':'🛍','pet shop':'🐶','veterinário':'🐾','outros':'📦'};
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
let transactions=[], recurring=[], responsibles=[], paidMonths=[], budgets={}, investments=[];
let charts={};
let pendingDeleteId=null;
let annualYear=new Date().getFullYear();

const LS_KEY='montra_data';
function saveToLS(){
  try{localStorage.setItem(LS_KEY,JSON.stringify({version:'1.0',savedAt:new Date().toISOString(),transactions,recurring,responsibles,paidMonths,budgets,investments}));}catch(e){}
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
function markUnsaved(){saveToLS();}
function markSaved(){}

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
      budgets=data.budgets||{};
      investments=data.investments||[];
      currentFileName=file.name;
      saveToLS();
      startApp(file.name);
    }catch(err){alert('Arquivo JSON inválido. Verifique o arquivo e tente novamente.');}
  };
  reader.readAsText(file);
  e.target.value='';
}

function createNew(){
  transactions=[]; recurring=[]; responsibles=[]; paidMonths=[]; budgets={}; investments=[];
  currentFileName='montra.json';
  startApp('novo arquivo');
}

function startApp(label){
  saveToLS();
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('app-screen').style.display='block';
  document.getElementById('session-name-label').textContent=label;
  currentYear=now.getFullYear(); currentMonth=now.getMonth();
  applyRecurrences();
  render();
  document.querySelectorAll('.tab').forEach((t,i)=>{t.classList.toggle('active',i===0);});
  document.querySelectorAll('.page').forEach((p,i)=>{p.classList.toggle('active',i===0);});
}

function closeSession(){
  document.getElementById('app-screen').style.display='none';
  document.getElementById('welcome-screen').classList.remove('hidden');
  Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}});
  charts={};
}

// ── SAVE TO FILE ──
function saveToFile(){
  const data={version:'1.0',savedAt:new Date().toISOString(),transactions,recurring,responsibles,paidMonths,budgets,investments};
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

// ── DATA HELPERS ──
function monthKey(y,m){return `${y}-${String(m+1).padStart(2,'0')}`}
function isMonthPaid(y,m){return paidMonths.includes(monthKey(y,m))}
function currentKey(){return monthKey(currentYear,currentMonth)}
function isCurrentPaid(){return isMonthPaid(currentYear,currentMonth)}
function getRespColor(id){const idx=responsibles.findIndex(r=>r.id===id);return idx>=0?RESP_PALETTE[idx%RESP_PALETTE.length]:'#94a3b8';}
function getRespName(id){const r=responsibles.find(x=>x.id===id);return r?r.name:'—';}
function getRespInitials(id){const n=getRespName(id);return n==='—'?'?':n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function fmt(v){return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function getCurrentTxs(){return transactions.filter(t=>{const d=new Date(t.date+'T12:00:00');return d.getFullYear()===currentYear&&d.getMonth()===currentMonth;}).sort((a,b)=>b.date.localeCompare(a.date));}
function getMonthTxs(y,m){return transactions.filter(t=>{const d=new Date(t.date+'T12:00:00');return d.getFullYear()===y&&d.getMonth()===m;});}

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
  if(isCurrentPaid()) return;
  const m=String(currentMonth+1).padStart(2,'0');
  let changed=false;
  recurring.forEach(r=>{
    const already=transactions.some(t=>t.recurId===r.id&&t.date.startsWith(`${currentYear}-${m}`));
    if(already) return;

    if(r.isInstallment){
      // Use stored start month; fallback to first transaction date for legacy data
      let sYear=r.startYear, sMonth=r.startMonth;
      if(sYear==null||sMonth==null){
        const firstTx=transactions.filter(t=>t.recurId===r.id).sort((a,b)=>a.date.localeCompare(b.date))[0];
        if(!firstTx) return;
        const d=new Date(firstTx.date+'T12:00:00');
        sYear=d.getFullYear(); sMonth=d.getMonth();
        r.startYear=sYear; r.startMonth=sMonth;
      }
      // Calculate month offset from start
      const offset=(currentYear-sYear)*12+(currentMonth-sMonth);
      if(offset<0) return; // Month is before start
      if(offset>=r.totalInstallments) return; // All installments already covered
      const installmentNum=offset+1;
      transactions.push({
        id:'r'+Date.now()+Math.random(),
        desc:r.desc,
        amount:r.amount,
        type:r.type,
        category:r.category,
        date:`${currentYear}-${m}-01`,
        recurId:r.id,
        respId:r.respId||null,
        installmentNum,
        totalInstallments:r.totalInstallments
      });
      changed=true;
    } else {
      // Infinite recurring — don't apply to months before first transaction
      const firstTx=transactions.filter(t=>t.recurId===r.id).sort((a,b)=>a.date.localeCompare(b.date))[0];
      if(!firstTx) return;
      if(`${currentYear}-${m}`<firstTx.date.slice(0,7)) return;
      transactions.push({
        id:'r'+Date.now()+Math.random(),
        desc:r.desc,
        amount:r.amount,
        type:r.type,
        category:r.category,
        date:`${currentYear}-${m}-01`,
        recurId:r.id,
        respId:r.respId||null
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
  const banner=document.getElementById('lock-banner-area');
  const payBtn=document.getElementById('pay-month-btn');
  const badgeArea=document.getElementById('paid-badge-area');
  const addBtn=document.getElementById('add-tx-btn');
  if(paid){
    banner.innerHTML=`<div class="lock-banner"><div class="lock-banner-left"><span style="font-size:20px">🔒</span><div><div class="lock-title">Mês fechado — somente leitura</div><div class="lock-sub">Fechado em ${MONTHS[currentMonth]} ${currentYear}</div></div></div><button class="unlock-btn" onclick="openUnlockModal()">🔓 Reabrir</button></div>`;
    badgeArea.innerHTML=`<span class="paid-badge"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Pago</span>`;
    payBtn.style.display='none'; addBtn.disabled=true;
  } else {
    banner.innerHTML=''; badgeArea.innerHTML=''; payBtn.style.display='flex'; addBtn.disabled=false;
  }
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
      }

      return `<div class="tx-item${paid?' locked':''}${t.paid?' tx-checked':''}" data-txid="${sid}">
        ${paid?'<div class="tx-paid-dot"></div>':`<button class="tx-check${t.paid?' checked':''}" data-check="${sid}" title="${t.paid?'Desmarcar':'Marcar como pago'}"></button>`}
        <div class="tx-icon" style="background:${CAT_COLORS[t.category]||'#94a3b8'}22">${CAT_ICONS[t.category]||'📦'}</div>
        <div class="tx-info">
          <div class="tx-name">${escHtml(t.desc)}${badge}</div>
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

// ── PAY MONTH ──
function openPayModal(){
  const txs=getCurrentTxs();
  const income=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  document.getElementById('pay-modal-title').textContent=`Fechar ${MONTHS[currentMonth]}?`;
  document.getElementById('pay-modal-sub').innerHTML=`<strong style="color:var(--text)">${MONTHS[currentMonth]} ${currentYear}</strong><br>Receitas: <span style="color:var(--green)">${fmt(income)}</span> · Despesas: <span style="color:var(--red)">${fmt(expense)}</span><br>Saldo: <span style="color:${income-expense>=0?'var(--green)':'var(--red)'}">${fmt(income-expense)}</span>`;
  document.getElementById('pay-modal').classList.remove('hidden');
}
function closePayModal(){document.getElementById('pay-modal').classList.add('hidden');}
function confirmPayMonth(){if(!paidMonths.includes(currentKey()))paidMonths.push(currentKey());markUnsaved();closePayModal();render();}
function openUnlockModal(){document.getElementById('unlock-modal-sub').textContent=`Tem certeza que deseja reabrir ${MONTHS[currentMonth]} ${currentYear}?`;document.getElementById('unlock-modal').classList.remove('hidden');}
function closeUnlockModal(){document.getElementById('unlock-modal').classList.add('hidden');}
function confirmUnlock(){paidMonths=paidMonths.filter(k=>k!==currentKey());markUnsaved();closeUnlockModal();render();}

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
  // Also include current viewed month
  monthSet.add(currentYear+'-'+currentMonth);
  const entries=[];
  monthSet.forEach(key=>{
    const [y,m]=[parseInt(key.split('-')[0]),parseInt(key.split('-')[1])];
    const txs=getMonthTxs(y,m);
    if(!txs.length&&!isMonthPaid(y,m)) return;
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    entries.push({y,m,inc,exp,bal:inc-exp,paid:isMonthPaid(y,m),txCount:txs.length});
  });
  entries.sort((a,b)=>(b.y*12+b.m)-(a.y*12+a.m));
  if(!entries.length){grid.innerHTML='<div class="empty"><div class="empty-icon">📅</div><div>Nenhum histórico ainda</div></div>';return;}
  grid.innerHTML=entries.map(e=>`
    <div class="hist-card${e.paid?' paid-card':''}" onclick="goToMonth(${e.y},${e.m})">
      <div class="hist-month"><span>${MONTHS_SHORT[e.m]} ${e.y}</span>${e.paid?`<span class="paid-badge" style="font-size:11px;padding:3px 8px"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Pago</span>`:`<span style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:20px;padding:3px 8px">Aberto</span>`}</div>
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
  Chart.defaults.color='#9b99b0';Chart.defaults.font={family:"'DM Sans',sans-serif",size:12};

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
  if(!recurMode&&isCurrentPaid()){alert('Este mês está fechado. Reabra o mês para adicionar transações.');return;}
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
  document.getElementById('f-category').value=src?src.category:'alimentação';
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
    // Editing existing transaction — just update fields
    const idx=transactions.findIndex(t=>String(t.id)===String(editId));
    if(idx>-1) transactions[idx]={...transactions[idx],desc,amount,type:formType,category,date,respId:selectedResp,note:note||undefined};
  } else {
    // New transaction
    if(recurType==='installment'){
      const totalParcelas=parseInt(document.getElementById('f-parcelas').value)||2;
      if(totalParcelas<2){alert('O número de parcelas deve ser pelo menos 2.');return;}
      const nr={
        id:'rec'+Date.now(),
        desc,amount,type:formType,category,respId:selectedResp,
        isInstallment:true,
        totalInstallments:totalParcelas,
        startYear:currentYear,
        startMonth:currentMonth
      };
      recurring.push(nr);
      // First installment in current viewed month
      const startM=String(currentMonth+1).padStart(2,'0');
      transactions.push({
        id:'tx'+Date.now(),
        desc,amount,type:formType,category,
        date:`${currentYear}-${startM}-01`,
        recurId:nr.id,respId:selectedResp,
        installmentNum:1,
        totalInstallments:totalParcelas
      });
    } else if(recurType==='infinite'){
      const nr={id:'rec'+Date.now(),desc,amount,type:formType,category,respId:selectedResp,isInstallment:false};
      recurring.push(nr);
      transactions.push({id:'tx'+Date.now(),desc,amount,type:formType,category,date,recurId:nr.id,respId:selectedResp,note:note||undefined});
    } else {
      transactions.push({id:'tx'+Date.now(),desc,amount,type:formType,category,date,respId:selectedResp,note:note||undefined});
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
  if(isCurrentPaid())return;
  const tx=findTx(id);
  if(!tx) return;
  pendingDeleteId=id;
  document.getElementById('delete-modal-sub').innerHTML=`<strong>"${escHtml(tx.desc)}"</strong><br>${tx.type==='income'?'+':'-'}${fmt(tx.amount)} · ${tx.date.slice(8,10)}/${tx.date.slice(5,7)}/${tx.date.slice(0,4)}`;
  document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal(){document.getElementById('delete-modal').classList.add('hidden');pendingDeleteId=null;}
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
    monthData.push({m,inc,exp,bal:inc-exp,count:txs.length,paid:isMonthPaid(annualYear,m)});
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
      <td>${d.paid?'<span style="color:var(--green);font-size:11px">✓ Fechado</span>':d.count?'<span style="color:var(--text3);font-size:11px">Aberto</span>':'<span style="color:var(--text3);font-size:11px">—</span>'}</td>
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
document.getElementById('ofx-overlay').addEventListener('click',function(e){if(e.target===this)closeOfxImport();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePayModal();closeUnlockModal();closeDeleteModal();closeBudgetModal();closeForm();closeInvForm();closeInvOp();closeInvDetail();closeMoreMenu();closeOfxImport();}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'&&document.getElementById('app-screen').style.display!=='none'){e.preventDefault();saveToFile();}});

// Init money input formatters
initMoneyInputs();
// Update hint when amount changes
document.getElementById('f-amount').addEventListener('moneychange',()=>{if(recurType==='installment')updateParcelaHint();});

// ── OFX IMPORT ──
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

let ofxParsedTxs=[];

function triggerOfxInput(){
  if(isCurrentPaid()){alert('Este mês está fechado. Reabra para importar.');return;}
  document.getElementById('ofx-input').click();
}

function detectOfxEncoding(buffer){
  // Muitos bancos BR declaram USASCII/1252 no header mas gravam UTF-8.
  // Estratégia: tentar UTF-8 primeiro (sem erros = é UTF-8 válido).
  try{
    const utf8=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
    // Se decodificou sem erro, é UTF-8
    return 'utf-8';
  }catch(e){}
  // Não é UTF-8 válido — usar header do OFX para decidir
  const header=new TextDecoder('ascii').decode(buffer.slice(0,1024));
  const charsetMatch=header.match(/CHARSET:\s*(\S+)/i);
  const charset=(charsetMatch?charsetMatch[1]:'').toUpperCase();
  if(charset.includes('8859')) return 'iso-8859-1';
  // Fallback: windows-1252 (superset de latin1)
  return 'windows-1252';
}

function handleOfxFile(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const buffer=ev.target.result;
      const enc=detectOfxEncoding(buffer);
      const raw=new TextDecoder(enc).decode(buffer);
      const txs=parseOfx(raw);
      if(!txs.length){alert('Nenhuma transação encontrada no arquivo OFX.');return;}
      showOfxPreview(txs);
    }catch(err){
      alert('Erro ao processar o arquivo OFX. Verifique se o formato é válido.');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value='';
}

function parseOfx(raw){
  const txs=[];
  // Encontrar todas as transações (STMTTRN blocks)
  const regex=/<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST))/gi;
  let match;
  while((match=regex.exec(raw))!==null){
    const block=match[1];
    const get=tag=>{
      // OFX pode ser SGML (sem fechamento) ou XML (com fechamento)
      const r=new RegExp('<'+tag+'>\\s*([^<\\r\\n]+)','i');
      const m=block.match(r);
      return m?m[1].trim():'';
    };
    const trnType=get('TRNTYPE');
    const dateRaw=get('DTPOSTED');
    const amountRaw=get('TRNAMT');
    const memo=get('MEMO')||get('NAME')||'Sem descrição';
    const fitid=get('FITID');
    if(!amountRaw||!dateRaw) continue;
    // Parse date: YYYYMMDD or YYYYMMDDHHMMSS
    const year=dateRaw.slice(0,4);
    const month=dateRaw.slice(4,6);
    const day=dateRaw.slice(6,8);
    const date=`${year}-${month}-${day}`;
    // Parse amount (pode ter ponto ou vírgula)
    const amount=parseFloat(amountRaw.replace(',','.'));
    if(isNaN(amount)) continue;
    const isIncome=amount>0;
    const absAmount=Math.abs(amount);
    // Auto-categorização
    const cat=detectCategory(memo,isIncome);
    // Detecção de duplicata
    const dup=isDuplicateTx(date,absAmount,memo);
    txs.push({
      fitid,date,desc:memo,amount:absAmount,
      type:isIncome?'income':'expense',
      category:cat,selected:!dup,isDuplicate:dup
    });
  }
  // Ordenar por data desc
  txs.sort((a,b)=>b.date.localeCompare(a.date));
  return txs;
}

function detectCategory(memo,isIncome){
  const lower=memo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
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
    // Comparar descrição de forma flexível
    const a=t.desc.toLowerCase().trim();
    const b=desc.toLowerCase().trim();
    if(a===b) return true;
    if(a.includes(b)||b.includes(a)) return true;
    return false;
  });
}

function showOfxPreview(txs){
  ofxParsedTxs=txs;
  const incomeCount=txs.filter(t=>t.type==='income').length;
  const expenseCount=txs.filter(t=>t.type==='expense').length;
  const dupCount=txs.filter(t=>t.isDuplicate).length;
  const totalIncome=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  document.getElementById('ofx-summary').innerHTML=`
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:120px"><div class="card-label">Transações</div><div class="card-value" style="font-size:18px">${txs.length}</div><div class="card-sub">${incomeCount} receitas · ${expenseCount} despesas</div></div>
      <div class="card" style="flex:1;min-width:120px"><div class="card-label">Receitas</div><div class="card-value" style="font-size:18px;color:var(--green)">${fmt(totalIncome)}</div></div>
      <div class="card" style="flex:1;min-width:120px"><div class="card-label">Despesas</div><div class="card-value" style="font-size:18px;color:var(--red)">${fmt(totalExpense)}</div></div>
    </div>
    ${dupCount?`<div class="alert-banner" style="margin-top:10px"><span class="alert-banner-icon">⚠️</span><span class="alert-banner-text">${dupCount} possível${dupCount>1?'is':''} duplicata${dupCount>1?'s':''} detectada${dupCount>1?'s':''} (desmarcadas automaticamente)</span></div>`:''}
  `;

  const catOptions=Object.keys(CAT_ICONS).map(c=>`<option value="${c}">${CAT_ICONS[c]} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('');

  document.getElementById('ofx-list').innerHTML=txs.map((t,i)=>`
    <div class="ofx-item${t.isDuplicate?' ofx-dup':''}" data-idx="${i}">
      <input type="checkbox" ${t.selected?'checked':''} onchange="ofxParsedTxs[${i}].selected=this.checked;updateOfxCount()"/>
      <div class="ofx-item-info">
        <div class="ofx-item-desc">${escHtml(t.desc)}${t.isDuplicate?'<span class="ofx-dup-badge">duplicata</span>':''}</div>
        <div class="ofx-item-date">${t.date.slice(8,10)}/${t.date.slice(5,7)}/${t.date.slice(0,4)}</div>
      </div>
      <div class="ofx-item-amount" style="color:${t.type==='income'?'var(--green)':'var(--red)'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
      <select class="ofx-item-cat" onchange="ofxParsedTxs[${i}].category=this.value">${catOptions.replace(`value="${t.category}"`,`value="${t.category}" selected`)}</select>
    </div>
  `).join('');

  document.getElementById('ofx-select-all').checked=txs.some(t=>t.selected);
  updateOfxCount();
  document.getElementById('ofx-overlay').classList.remove('hidden');
}

function toggleOfxSelectAll(){
  const checked=document.getElementById('ofx-select-all').checked;
  ofxParsedTxs.forEach(t=>t.selected=checked);
  document.querySelectorAll('#ofx-list input[type="checkbox"]').forEach(cb=>cb.checked=checked);
  updateOfxCount();
}

function updateOfxCount(){
  const count=ofxParsedTxs.filter(t=>t.selected).length;
  document.getElementById('ofx-selected-count').textContent=`${count} de ${ofxParsedTxs.length} selecionadas`;
  document.getElementById('ofx-import-btn').textContent=`Importar ${count} transação${count!==1?'ões':''}`;
}

function closeOfxImport(){
  document.getElementById('ofx-overlay').classList.add('hidden');
  ofxParsedTxs=[];
}

function confirmOfxImport(){
  const selected=ofxParsedTxs.filter(t=>t.selected);
  if(!selected.length){alert('Selecione pelo menos uma transação para importar.');return;}
  let imported=0;
  selected.forEach(t=>{
    transactions.push({
      id:'tx'+Date.now()+Math.random(),
      desc:t.desc,
      amount:t.amount,
      type:t.type,
      category:t.category,
      date:t.date,
      respId:null,
      note:'Importado via OFX'
    });
    imported++;
  });
  markUnsaved();
  closeOfxImport();
  render();
  const toast=document.getElementById('toast');
  toast.textContent=`✓ ${imported} transação${imported!==1?'ões':''} importada${imported!==1?'s':''}!`;
  toast.classList.add('show');
  setTimeout(()=>{toast.classList.remove('show');toast.textContent='✓ Arquivo salvo com sucesso!';},3000);
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
    budgets=data.budgets||{};
    investments=data.investments||[];
    const btn=document.getElementById('btn-continue');
    const divider=document.getElementById('div-or-import');
    if(btn){btn.style.display='flex';}
    if(divider){divider.style.display='flex';}
  }catch(e){}
})();
