import React from 'react';
import MiniMetric from './MiniMetric';
import TokenDisplay from './TokenDisplay';
import RangeChip from './RangeChip';
import { useTheme } from '../context/ThemeProvider';
import { useMaskValues } from '../context/MaskValuesContext';
import { formatPrice, formatTokenAmount, extractRewards, calculatePercentage, getTotalPortfolioValue, extractPoolRange, extractPoolFees24h } from '../utils/walletUtils';

/* Heuristic helpers to extract fields from varied pool position shapes */
function getTokens(pos) {
  if (!pos || typeof pos !== 'object') return [];
  // Primary tokens
  let tokens = [];
  if (Array.isArray(pos.tokens) && pos.tokens.length) tokens = pos.tokens.map(t => t?.token || t).filter(Boolean);
  else if (Array.isArray(pos.pool?.tokens) && pos.pool.tokens.length) tokens = pos.pool.tokens.map(t => t?.token || t).filter(Boolean);
  else {
    const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken;
    const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken;
    if (t0) tokens.push(t0?.token || t0);
    if (t1) tokens.push(t1?.token || t1);
  }
  return tokens.filter(Boolean);
}
// Rewards agora extraídos via extractRewards util
// Extract protocol candidate + logo/icon if present
function getProtocolInfo(pos){
  if(!pos || typeof pos !== 'object') return { name:null, logo:null };
  const proto = pos.protocol || pos.provider || pos.platform || pos.dex || pos.exchange || pos.source || null;
  let name = null;
  let logo = null;
  if(proto && typeof proto === 'object'){
    name = proto.name || proto.id || proto.slug || proto.title || null;
    logo = proto.logo || proto.icon || proto.iconUrl || proto.image || proto.img || null;
  } else if (typeof proto === 'string') {
    name = proto;
  }
  return { name, logo };
}
function safeNum(v){ const n = parseFloat(v); return isFinite(n) ? n : 0; }
// Legacy short formatter (kept for unclaimed/claimed small values), but for base token amount prefer formatTokenAmount which respects decimals.
function formatAmount(value){
  if(value==null) return '—';
  const num = parseFloat(value);
  if(!isFinite(num)) return '—';
  if(Math.abs(num) >= 1_000_000_000) return (num/1_000_000_000).toLocaleString('en-US',{ maximumFractionDigits:2 })+'B';
  if(Math.abs(num) >= 1_000_000) return (num/1_000_000).toLocaleString('en-US',{ maximumFractionDigits:2 })+'M';
  if(Math.abs(num) >= 1_000) return (num/1_000).toLocaleString('en-US',{ maximumFractionDigits:2 })+'K';
  return num.toLocaleString('en-US',{ maximumFractionDigits:4 });
}
function stableTokenKey(t){
  if(!t|| typeof t!=='object') return null;
  return (t.tokenAddress||t.contractAddress||t.address||t.id||t.symbol||'').toLowerCase();
}
function mergeTokenList(list){
  const map = new Map();
  list.forEach(tok=>{
    const key = stableTokenKey(tok);
    if(!key){
      map.set(Symbol(), tok); // keep unique unknown
      return;
    }
    if(!map.has(key)) map.set(key, { ...tok }); else {
      const acc = map.get(key);
      const amountFields = ['amount','balance','rewardAmount','pending','earned','accrued'];
      amountFields.forEach(f=>{
        if(tok[f]!=null){
          const a = parseFloat(acc[f]||0); const b = parseFloat(tok[f]);
          if(isFinite(b)) acc[f] = a + b;
        }
      });
      const valFields = ['totalPrice','value'];
      valFields.forEach(f=>{
        if(tok[f]!=null){
          const a = parseFloat(acc[f]||0); const b = parseFloat(tok[f]);
          if(isFinite(b)) acc[f] = a + b;
        }
      });
    }
  });
  return Array.from(map.values());
}
function sumUnclaimed(rewards){
  if(!Array.isArray(rewards)||!rewards.length) return 0;
  return rewards.reduce((s,r)=>{
    const v = r.pending ?? r.unclaimed ?? r.rewardAmount ?? r.accrued ?? r.amount ?? r.balance;
    const n = parseFloat(v); return s + (isFinite(n)? n:0);
  },0);
}
function sumClaimed(rewards){
  if(!Array.isArray(rewards)||!rewards.length) return 0;
  return rewards.reduce((s,r)=>{
    const v = r.claimed ?? r.earned ?? r.realized; const n = parseFloat(v); return s + (isFinite(n)? n:0);
  },0);
}
function sumRewardValue(rewards){
  if(!Array.isArray(rewards)||!rewards.length) return 0;
  return rewards.reduce((s,r)=>{
    let val = r.totalPrice ?? r.value;
    if(val == null){
      const price = parseFloat(r.price ?? r.financials?.price);
      if(isFinite(price)){
        const u = parseFloat(r.pending ?? r.unclaimed ?? r.rewardAmount ?? r.accrued) || 0;
        const c = parseFloat(r.claimed ?? r.earned) || 0;
        val = price * (u + c);
      }
    }
    const num = parseFloat(val);
    return s + (isFinite(num)? num:0);
  },0);
}
function getUserValue(raw){
  const pos = raw?.position || raw;
  // Prefer explicit totalPrice/value fields
  const direct = pos.totalPrice ?? pos.value ?? pos.financials?.totalPrice;
  if (direct != null) return safeNum(direct);
  const toks = getTokens(pos);
  if (toks.length) return toks.reduce((s,t)=> s + safeNum(t.totalPrice ?? t.value ?? t.financials?.totalPrice),0);
  return 0;
}
function getAPR(raw){
  const pos = raw?.position || raw;
  const cand = pos.apr ?? pos.APR ?? pos.apy ?? pos.APY ?? pos.aprPct ?? pos.apyPct ?? pos.yieldPct ?? pos.annualPercentageRate;
  const n = safeNum(cand);
  if (!n) return null;
  // assume already percentage (0-100) if >1, else multiply by 100 if <=1
  return n > 1 ? n : n * 100;
}
// Removed getFees24h - now using extractPoolFees24h from walletUtils
function getCreatedDate(raw){
  const pos = raw?.position || raw;
  const cand = pos.createdAt || pos.creationTime || pos.timestamp || pos.created_date || pos.startTime;
  if (!cand) return null;
  try { const d = new Date(cand); if (!isNaN(d.getTime())) return d; } catch { return null; }
  return null;
}
function shortenAddress(a){ if(!a) return ''; return a.slice(0,6)+"..."+a.slice(-4); }

export default function PoolsView({ getLiquidityPoolsData }) {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const pools = React.useMemo(() => getLiquidityPoolsData?.() || [], [getLiquidityPoolsData]);

  const enriched = React.useMemo(() => pools.map((p,i) => {
    // Keep original reference because some providers put range at root while also nesting a position object.
    const original = p;
    const pos = p.position || p; // 'pos' is the inner position shape if available.
  // Get all tokens from position (including LiquidityUncollectedFee)
  const allTokens = pos.tokens || p.position?.tokens || p.tokens || [];
  const tokensRaw = getTokens(pos);
  const rewardsRaw = extractRewards(pos);
  const tokens = mergeTokenList(tokensRaw);
  const rewards = mergeTokenList(rewardsRaw);
  
  // Extract uncollected fees specifically from LiquidityUncollectedFee tokens
  const uncollectedFeeTokens = allTokens.filter(t => t.type === 'LiquidityUncollectedFee') || [];
  
    const { name: protocolName, logo: protocolLogo } = getProtocolInfo(pos);
  const value = getUserValue(p);
    const apr = getAPR(p);
    const fees24h = extractPoolFees24h(p);
    const created = getCreatedDate(p);
    // Extract range using unified utility function
    const range = extractPoolRange(p);
    const poolName = pos.name || (tokens.length >=2 ? `${tokens[0].symbol || tokens[0].name}/${tokens[1].symbol || tokens[1].name}` : tokens[0]?.symbol || tokens[0]?.name || `Pool #${i+1}`);
    const poolId = pos.id || pos.poolId || pos.address || pos.contractAddress || `pool-${i}`;
    
    // Calculate uncollected fees value from LiquidityUncollectedFee tokens (like PoolTables)
    const rewardsTotalValue = uncollectedFeeTokens.reduce((s, t) => s + (parseFloat(
      t.financials?.totalPrice || t.totalPrice || 0
    ) || 0), 0);
    
    // Keep legacy calculations for other rewards
    const rewardsUnclaimed = sumUnclaimed(rewards);
    const rewardsClaimed = sumClaimed(rewards);
    return { raw:p, pos, tokens, rewards, value, apr, fees24h, created, range, poolName, poolId, protocolName, protocolLogo, rewardsUnclaimed, rewardsClaimed, rewardsTotalValue, uncollectedFeeTokens };
  }), [pools]);

  const totalValue = React.useMemo(() => enriched.reduce((s,e)=> s + e.value, 0), [enriched]);
  const avgApr = React.useMemo(() => {
    const arr = enriched.map(e => e.apr).filter(v => v!=null && v>0);
    if(!arr.length) return null;
    return arr.reduce((s,v)=>s+v,0)/arr.length;
  }, [enriched]);
  const totalFees24h = React.useMemo(()=> enriched.reduce((s,e)=> s + (e.fees24h||0),0), [enriched]);
  const totalRewardsValue = React.useMemo(()=> enriched.reduce((s,e)=> s + (e.rewardsTotalValue||0),0), [enriched]);
  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent = portfolioTotal>0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  // responsiveness for card grid (track width for columns if needed later)
  const [vw, setVw] = React.useState(typeof window!=='undefined'?window.innerWidth:1200);
  React.useEffect(()=>{ const r=()=>setVw(window.innerWidth); window.addEventListener('resize',r); return ()=>window.removeEventListener('resize',r);},[]);
  const isNarrow = vw < 900; // adapt break for horizontal card wrapping

  const [openMap, setOpenMap] = React.useState(()=>({}));
  const toggle = (id)=> setOpenMap(m => ({ ...m, [id]: !m[id] }));

  return (
    <div className="pools-view">
      <div className="metric-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard label="Total Pools" value={enriched.length} theme={theme} />
        <MetricCard label="Portfolio %" value={portfolioPercent} theme={theme} />
        <MetricCard label="Total Value" value={maskValue(formatPrice(totalValue))} theme={theme} tone="accent" strong />
        <MetricCard label="Avg APR" value={avgApr!=null?`${avgApr.toFixed(2)}%`:'—'} theme={theme} />
        <MetricCard label="Fees 24h" value={maskValue(formatPrice(totalFees24h))} theme={theme} />
        <MetricCard label="Total Rewards" value={maskValue(formatPrice(totalRewardsValue))} theme={theme} />
      </div>
      <div className="pools-panel">
        <div className="pools-panel-header">
          <div className="pools-panel-title">Liquidity Pools</div>
          <div className="pools-panel-hint">Clique para expandir / recolher</div>
        </div>
        {enriched.length === 0 && (
          <div className="text-secondary" style={{ textAlign:'center', padding:'40px 0', fontSize:13 }}>No liquidity pools detected.</div>
        )}
        <div>
          {enriched.map(row => (
            <CollapseItem key={row.poolId} row={row} open={!!openMap[row.poolId]} onToggle={()=>toggle(row.poolId)} maskValue={maskValue} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Removed old StatCard in favor of unified MiniMetric usage

function MetricRow({ label, value, theme, mono=true }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, gap:12 }}>
      <span style={{ color:theme.textSecondary, flex:'0 0 100px' }}>{label}</span>
      <span style={{ fontFamily: mono? 'var(--font-mono)': 'inherit', color:theme.textPrimary, flex:1, textAlign:'right' }}>{value}</span>
    </div>
  );
}

function TokenLine({ token, maskValue, theme }) {
  if(!token) return null;
  const price = token.price ?? token.financials?.price;
  const amount = token.amount ?? token.balance ?? token.financials?.amount ?? token.rewardAmount ?? token.pending ?? token.earned ?? token.accrued;
  let value = token.totalPrice ?? token.value ?? token.financials?.totalPrice;
  if(value == null && price != null && amount != null){
    const aNum = parseFloat(amount); const pNum = parseFloat(price);
    if(isFinite(aNum) && isFinite(pNum)) value = pNum * aNum;
  }
  const symbol = token.symbol || token.ticker || token.name || '—';
  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(120px,200px) repeat(3, minmax(90px, 140px))', gap:12, fontSize:12, alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
        {token.logo && (
          <img src={token.logo} alt={symbol} style={{ width:18, height:18, borderRadius:'50%', objectFit:'cover', border:`1px solid ${theme.border}` }} onError={e=> e.currentTarget.style.display='none'} />
        )}
        <span style={{ fontWeight:600, color:theme.textPrimary }} className="truncate">{symbol}</span>
      </div>
      <span style={{ fontFamily:'var(--font-mono)', textAlign:'right', color:theme.textPrimary }}>{price!=null? maskValue(formatPrice(price)):'—'}</span>
      <span style={{ fontFamily:'var(--font-mono)', textAlign:'right', color:theme.textPrimary }}>{amount!=null? maskValue(formatAmount(amount), { short:true }):'—'}</span>
      <span style={{ fontFamily:'var(--font-mono)', textAlign:'right', color:theme.textPrimary }}>{value!=null? maskValue(formatPrice(value)):'—'}</span>
    </div>
  );
}

function RewardLine({ reward, maskValue, theme }) {
  if(!reward) return null;
  const symbol = reward.symbol || reward.ticker || reward.name || '—';
  const unclaimed = reward.pending ?? reward.unclaimed ?? reward.rewardAmount ?? reward.accrued;
  const claimed = reward.claimed ?? reward.earned; // fallback
  const price = reward.price ?? reward.financials?.price;
  let value = reward.totalPrice ?? reward.value;
  if(value == null && price != null){
    const totalBase = [unclaimed, claimed].map(v=> parseFloat(v)||0).reduce((a,b)=>a+b,0);
    if(isFinite(totalBase)) value = totalBase * parseFloat(price);
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(120px,200px) repeat(3, minmax(90px, 140px))', gap:12, fontSize:12, alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
        {reward.logo && (
          <img src={reward.logo} alt={symbol} style={{ width:18, height:18, borderRadius:'50%', objectFit:'cover', border:`1px solid ${theme.border}` }} onError={e=> e.currentTarget.style.display='none'} />
        )}
        <span style={{ fontWeight:600, color:theme.textPrimary }} className="truncate">{symbol}</span>
      </div>
      <span style={{ fontFamily:'var(--font-mono)', textAlign:'right', color:theme.textPrimary }}>{unclaimed!=null? maskValue(formatAmount(unclaimed), { short:true }):'—'}</span>
      <span style={{ fontFamily:'var(--font-mono)', textAlign:'right', color:theme.textPrimary }}>{claimed!=null? maskValue(formatAmount(claimed), { short:true }):'—'}</span>
      <span style={{ fontFamily:'var(--font-mono)', textAlign:'right', color:theme.textPrimary }}>{value!=null? maskValue(formatPrice(value)):'—'}</span>
    </div>
  );
}

function SectionTitle({ children, theme }) {
  return <div style={{ fontSize:11, letterSpacing:.5, fontWeight:600, textTransform:'uppercase', color:theme.textSecondary, marginTop:4 }}>{children}</div>;
}

function PoolCard({ row, maskValue }) {
  const { theme } = useTheme();
  const tokenIcons = row.tokens.slice(0,4);
  const highlightValue = maskValue(formatPrice(row.value));
  const highlightApr = row.apr!=null? `${row.apr.toFixed(2)}%`:'—';
  const highlightFees = row.fees24h? maskValue(formatPrice(row.fees24h)):'—';
  // Total amount & uncollected (rewards) agora serão mostrados na tabela, não no resumo
  // Age derivation
  let ageDisplay = '—';
  if(row.created instanceof Date){
    const diffMs = Date.now() - row.created.getTime();
    if(diffMs > 0){
      const diffH = diffMs / 3600000;
      if(diffH < 24) ageDisplay = `${Math.floor(diffH)}h`;
      else {
        const diffD = diffH/24;
        if(diffD < 14) ageDisplay = `${Math.floor(diffD)}d`;
        else {
          const diffW = diffD/7;
          if(diffW < 8) ageDisplay = `${Math.floor(diffW)}w`;
          else {
            const diffM = diffD/30.4375; // average month
            ageDisplay = `${Math.floor(diffM)}m`;
          }
        }
      }
    }
  }
  // Responsive stacking for tokens/rewards: side-by-side if wide
  const wide = typeof window !== 'undefined' ? window.innerWidth >= 1100 : true;
  return (
    <div style={{ padding:12 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:28, fontSize:12 }}>
        <MiniMetric 
          label="Range" 
          value={row.range ? '' : 'Full Range'} 
          theme={theme} 
          custom={row.range ? <RangeChip range={row.range} width={110} /> : null} 
        />
        <MiniMetric label="APR" value={highlightApr} theme={theme} accent />
        <MiniMetric label="Fees 24h" value={highlightFees} theme={theme} />
        <MiniMetric label="Age" value={ageDisplay} theme={theme} />
      </div>
      <div style={{ marginTop:16 }}>
        <table className="table-unified text-primary" style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, fontSize:12 }}>
          <thead>
            <AggregateHeader row={row} maskValue={maskValue} />
            <tr className="thead-row">
              <th className="th-head th-left col-name" style={thStyle(theme, 'left')}>Token</th>
              <th className="th-head th-right col-amount" style={thStyle(theme, 'right')}>Amount</th>
              <th className="th-head th-right col-unclaimed" style={thStyle(theme, 'right')}>Uncollected</th>
              <th className="th-head th-right col-claimed" style={thStyle(theme, 'right')}>Claimed</th>
              <th className="th-head th-right col-value" style={thStyle(theme, 'right')}>Value</th>
            </tr>
          </thead>
          <tbody>
            {row.tokens.map((t,i)=> <TokenTableRow key={i} token={t} maskValue={maskValue} isLast={i===row.tokens.length-1} uncollectedFeeTokens={row.uncollectedFeeTokens} />)}
            {row.tokens.length===0 && (
              <tr><td colSpan={5} style={{ padding:'10px 12px', fontSize:12, color:theme.textSecondary, textAlign:'center' }}>No tokens</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {row.rewards.length>0 && (
        <>
          <div style={{ marginTop:22 }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:.5, textTransform:'uppercase', color:theme.textSecondary, marginBottom:6 }}>Rewards</div>
            <table className="table-unified text-primary" style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, fontSize:12 }}>
              <thead>
                <tr className="thead-row">
                  <th className="th-head th-left col-name" style={thStyle(theme, 'left')}>Token</th>
                  <th className="th-head th-right col-unclaimed" style={thStyle(theme, 'right')}>Unclaimed</th>
                  <th className="th-head th-right col-claimed" style={thStyle(theme, 'right')}>Claimed</th>
                  <th className="th-head th-right col-value" style={thStyle(theme, 'right')}>Value</th>
                </tr>
              </thead>
              <tbody>
                {row.rewards.map((r,i)=> <RewardTableRow key={i} reward={r} maskValue={maskValue} isLast={i===row.rewards.length-1} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function thStyle(theme, align){
  return {
    textAlign: align === 'right' ? 'right':'left',
    fontSize:11,
    fontWeight:600,
    letterSpacing:.5,
    padding:'8px 12px',
    textTransform:'uppercase',
    color: theme.textSecondary,
    borderBottom:`1px solid ${theme.border}`,
    background: theme.bgPanel,
    position:'sticky',
    top:0,
    zIndex:1
  };
}

function tdBase(theme, align){
  return {
    padding:'10px 12px',
    textAlign: align==='right' ? 'right':'left',
    fontFamily:'var(--font-mono)',
    color: theme.textPrimary,
    borderBottom:`1px solid ${theme.border}`,
    verticalAlign:'middle',
    background:'transparent'
  };
}

function TokenTableRow({ token, maskValue, isLast, uncollectedFeeTokens = [] }){
  const { theme } = useTheme();
  if(!token) return null;
  // Amount base (liquidity amount do token principal)
  const amount = token.amount ?? token.balance ?? token.financials?.amount;
  
  // Find corresponding uncollected fee token for this token symbol
  const uncollectedFeeToken = uncollectedFeeTokens.find(fee => 
    (fee.symbol || '').toLowerCase() === (token.symbol || '').toLowerCase()
  );
  
  // Get uncollected value from the corresponding LiquidityUncollectedFee token
  const unclaimed = uncollectedFeeToken ? (uncollectedFeeToken.financials?.totalPrice || uncollectedFeeToken.totalPrice || 0) : null;
  const claimed = null; // tokens de liquidez não têm claimed por enquanto
  const price = token.price ?? token.financials?.price;
  let value = token.totalPrice ?? token.value ?? token.financials?.totalPrice;
  if(value == null && price != null && amount != null){
    const pNum = parseFloat(price)||0;
    const aNum = parseFloat(amount)||0;
    if(isFinite(pNum) && isFinite(aNum)) value = aNum * pNum;
  }
  const symbol = token.symbol || token.ticker || token.name || '—';
  return (
    <tr className="table-row table-row-hover tbody-divider">
      <td className="td text-primary col-name" style={{ ...tdBase(theme,'left'), fontFamily:'inherit', paddingLeft:12 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative', width:22, height:22, flex:'0 0 auto' }}>
            <div style={{ position:'absolute', left:0, top:0, width:22, height:22 }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: theme.bgElevated || theme.bgPanel, border:'none', boxSizing:'border-box', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {token.logo && <img src={token.logo} alt={symbol} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} onError={e=> e.currentTarget.style.display='none'} />}
              </div>
            </div>
            {token.chainLogo && (
              <div style={{ position:'absolute', top:-4, right:-4, width:10, height:10, borderRadius:'50%', background: theme.bgElevated || theme.bgPanel, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', boxShadow:'rgba(255,255,255,0.08) 0 0 0 1px inset, rgba(0,0,0,0.25) 0 0 0 1px' }}>
                <img src={token.chainLogo} alt={token.chain || 'chain'} style={{ width:'100%', height:'100%', objectFit:'contain', borderRadius:'50%' }} />
              </div>
            )}
          </div>
          <div style={{ minWidth:0 }}>
            <span style={{ fontSize:14, fontWeight:400, color:theme.textPrimary, lineHeight:'16px', whiteSpace:'nowrap' }}>{symbol}</span>
          </div>
        </div>
      </td>
  <td className="td td-right td-mono tabular-nums text-primary col-amount" style={tdBase(theme,'right')}>{amount!=null? maskValue(formatTokenAmount(token, 4)):'—'}</td>
      <td className="td td-right td-mono tabular-nums text-primary col-unclaimed" style={tdBase(theme,'right')}>{unclaimed!=null? maskValue(formatPrice(unclaimed)):'—'}</td>
      <td className="td td-right td-mono tabular-nums text-primary col-claimed" style={tdBase(theme,'right')}>{claimed!=null? maskValue(formatAmount(claimed), { short:true }):'—'}</td>
      <td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-value" style={{ ...tdBase(theme,'right'), fontWeight:600 }}>{value!=null? maskValue(formatPrice(value)):'—'}</td>
    </tr>
  );
}

function RewardTableRow({ reward, maskValue, isLast }){
  const { theme } = useTheme();
  if(!reward) return null;
  const symbol = reward.symbol || reward.ticker || reward.name || '—';
  const unclaimed = reward.pending ?? reward.unclaimed ?? reward.rewardAmount ?? reward.accrued;
  const claimed = reward.claimed ?? reward.earned;
  const price = reward.price ?? reward.financials?.price;
  let value = reward.totalPrice ?? reward.value;
  if(value == null && price != null){
    const totalBase = [unclaimed, claimed].map(v=> parseFloat(v)||0).reduce((a,b)=>a+b,0);
    if(isFinite(totalBase)) value = totalBase * parseFloat(price);
  }
  return (
    <tr className="table-row table-row-hover tbody-divider">
      <td className="td text-primary col-name" style={{ ...tdBase(theme,'left'), fontFamily:'inherit', paddingLeft:12 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative', width:22, height:22, flex:'0 0 auto' }}>
            <div style={{ position:'absolute', left:0, top:0, width:22, height:22 }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: theme.bgElevated || theme.bgPanel, border:'none', boxSizing:'border-box', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {reward.logo && <img src={reward.logo} alt={symbol} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} onError={e=> e.currentTarget.style.display='none'} />}
              </div>
            </div>
            {reward.chainLogo && (
              <div style={{ position:'absolute', top:-4, right:-4, width:10, height:10, borderRadius:'50%', background: theme.bgElevated || theme.bgPanel, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', boxShadow:'rgba(255,255,255,0.08) 0 0 0 1px inset, rgba(0,0,0,0.25) 0 0 0 1px' }}>
                <img src={reward.chainLogo} alt={reward.chain || 'chain'} style={{ width:'100%', height:'100%', objectFit:'contain', borderRadius:'50%' }} />
              </div>
            )}
          </div>
          <div style={{ minWidth:0 }}>
            <span style={{ fontSize:14, fontWeight:400, color:theme.textPrimary, lineHeight:'16px', whiteSpace:'nowrap' }}>{symbol}</span>
          </div>
        </div>
      </td>
      <td className="td td-right td-mono tabular-nums text-primary col-unclaimed" style={tdBase(theme,'right')}>{unclaimed!=null? maskValue(formatAmount(unclaimed), { short:true }):'—'}</td>
      <td className="td td-right td-mono tabular-nums text-primary col-claimed" style={tdBase(theme,'right')}>{claimed!=null? maskValue(formatAmount(claimed), { short:true }):'—'}</td>
      <td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-value" style={{ ...tdBase(theme,'right'), fontWeight:600 }}>{value!=null? maskValue(formatPrice(value)):'—'}</td>
    </tr>
  );
}

function AggregateHeader({ row, maskValue }) {
  const { theme } = useTheme();
  // Agregados: Uncollected (rewards), Claimed (rewards), Value (tokens)
  // OBS: Amount não é somado porque tokens diferentes não possuem unidade homogênea para agregação.
  
  // Para tokens principais: só calcular valor total
  let totalValue = 0;
  row.tokens.forEach(token => {
    if(!token) return;
    const amount = token.amount ?? token.balance ?? token.financials?.amount;
    const price = token.price ?? token.financials?.price;
    let value = token.totalPrice ?? token.value ?? token.financials?.totalPrice;
    if(value == null && price != null && amount != null){
      const pNum = parseFloat(price)||0;
      const aNum = parseFloat(amount)||0;
      if(isFinite(pNum) && isFinite(aNum)) value = aNum * pNum;
    }
    const vNum = parseFloat(value)||0;
    if(isFinite(vNum)) totalValue += vNum;
  });

  // Para rewards: calcular unclaimed e claimed separadamente
  let totalUnclaimed = 0; let totalClaimed = 0;
  row.rewards.forEach(reward => {
    if(!reward) return;
    const unclaimed = reward.pending ?? reward.unclaimed ?? reward.rewardAmount ?? reward.accrued;
    const claimed = reward.claimed ?? reward.earned ?? 0;
    const uNum = parseFloat(unclaimed)||0; 
    const cNum = parseFloat(claimed)||0;
    if(isFinite(uNum)) totalUnclaimed += uNum;
    if(isFinite(cNum)) totalClaimed += cNum;
  });

  // Se não há rewards separados, usar o valor total já calculado do row
  const showAmount = '—';
  const showUnclaimed = row.rewards.length > 0 && totalUnclaimed > 0 ? 
    maskValue(formatAmount(totalUnclaimed), { short:true }) : 
    (row.rewardsTotalValue > 0 ? maskValue(formatPrice(row.rewardsTotalValue)) : '—');
  const showClaimed = row.rewards.length > 0 && totalClaimed > 0 ? 
    maskValue(formatAmount(totalClaimed), { short:true }) : '—';
  const showValue = row.tokens.length ? maskValue(formatPrice(totalValue)) : '—';
  return (
    <tr style={{ background: theme.bgPanel }}>
      <th style={{ ...thStyle(theme,'left'), fontSize:10, textTransform:'uppercase', color: theme.textSecondary }}></th>
      <th style={{ ...thStyle(theme,'right'), fontFamily:'var(--font-mono)', fontWeight:600, color: theme.textPrimary }}>{showAmount}</th>
      <th style={{ ...thStyle(theme,'right'), fontFamily:'var(--font-mono)', fontWeight:600, color: theme.textPrimary }}>{showUnclaimed}</th>
      <th style={{ ...thStyle(theme,'right'), fontFamily:'var(--font-mono)', fontWeight:600, color: theme.textPrimary }}>{showClaimed}</th>
      <th style={{ ...thStyle(theme,'right'), fontFamily:'var(--font-mono)', fontWeight:700, color: theme.textPrimary }}>{showValue}</th>
    </tr>
  );
}

function CollapseItem({ row, open, onToggle, maskValue }) {
  const tokenIcons = row.tokens.slice(0,4);
  const poolLabel = row.poolName;
  return (
    <div className="pool-collapse-section">
      <button onClick={onToggle} className="pool-collapse-btn" aria-expanded={open} aria-controls={`pool-card-${row.poolId}`}>
        <div className="flex align-center" style={{ gap:10, minWidth:0 }}>
          {tokenIcons.length>0 && (
            <TokenDisplay tokens={tokenIcons} showName={false} showText={false} size={30} gap={6} showChain={true} />
          )}
          <span className="pool-collapse-label">{poolLabel}</span>
        </div>
        <div className="pool-collapse-metrics">
          {row.apr!=null && <span className="mini-metric-value accent">{row.apr.toFixed(2)}%</span>}
          <span className="mini-metric-value">{maskValue(formatPrice(row.value))}</span>
          <span className={`chevron ${open? 'chevron-open':''}`}>▸<span className="sr-only">{open? 'Collapse':'Expand'}</span></span>
        </div>
      </button>
      {open && (
        <div id={`pool-card-${row.poolId}`} className="pool-card-wrapper">
          <PoolCard row={row} maskValue={maskValue} />
        </div>
      )}
    </div>
  );
}


function MetricCard({ label, value, theme, strong=false, tone='default', size='md' }) {
  const colorMap = {
    default: theme.textPrimary,
    accent: theme.accent || '#00b386',
  };
  const valColor = colorMap[tone] || theme.textPrimary;
  const fontSize = size==='lg'? 24 : 18;
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px', 
      padding: '16px',
      background: theme.bgPanel || theme.bgElevated,
      border: `1px solid ${theme.border}`,
      borderRadius: '8px',
      minWidth: '160px'
    }}>
      <span style={{ 
        fontSize: 12, 
        letterSpacing: 0.5, 
        fontWeight: 600, 
        color: theme.textSecondary,
        textTransform: 'uppercase' 
      }}>{label}</span>
      <span style={{ 
        fontSize, 
        fontWeight: strong ? 700 : 600, 
        fontFamily: 'var(--font-mono)', 
        color: valColor,
        lineHeight: 1.2
      }}>{value}</span>
    </div>
  );
}

function MetricBlock({ label, value, theme, strong=false, tone='default', size='md' }) {
  const colorMap = {
    default: theme.textPrimary,
    accent: theme.accent || '#00b386',
  };
  const valColor = colorMap[tone] || theme.textPrimary;
  const fontSize = size==='lg'? 22 : 16;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:110 }}>
      <span style={{ fontSize:11, letterSpacing:.5, fontWeight:600, color:theme.textSecondary }}>{label}</span>
      <span style={{ fontSize, fontWeight: strong?700:600, fontFamily:'var(--font-mono)', color:valColor }}>{value}</span>
    </div>
  );
}

function TokenHeader({ theme }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(120px,200px) repeat(3, minmax(90px, 140px))', gap:12, fontSize:11, fontWeight:600, color:theme.textSecondary }}>
      <span>Token</span><span style={{ textAlign:'right' }}>Price</span><span style={{ textAlign:'right' }}>Amount</span><span style={{ textAlign:'right' }}>Value</span>
    </div>
  );
}

function RewardHeader({ theme }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(120px,200px) repeat(3, minmax(90px, 140px))', gap:12, fontSize:11, fontWeight:600, color:theme.textSecondary }}>
      <span>Token</span><span style={{ textAlign:'right' }}>Unclaimed</span><span style={{ textAlign:'right' }}>Claimed</span><span style={{ textAlign:'right' }}>Value</span>
    </div>
  );
}
