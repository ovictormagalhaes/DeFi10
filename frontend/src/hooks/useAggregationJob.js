import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../config/api';
import { getToken, notifyTokenExpired } from '../services/apiClient';

/**
 * Hook para gerenciar ciclo de vida de um job de agregação.
 * Passos:
 * 1. start(account, chains?) -> cria job (POST /api/v1/aggregations  body: { account, chains? })
 * 2. polling até isCompleted=true usando GET /api/v1/aggregations/{jobId}
 * Endpoint único já traz parciais (pending/processed/progress)
 */
export function useAggregationJob() {
  const [jobId, setJobId] = useState(null);
  const [snapshot, setSnapshot] = useState(null); // resposta bruta da API
  const [summary, setSummary] = useState(null); // resumo opcional
  const [expired, setExpired] = useState(false); // 404 após início
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const pollTimer = useRef(null);
  const attemptRef = useRef(0);
  const cancelled = useRef(false);
  const maxAttempts = useRef(20); // Máximo de 20 tentativas (~17 minutos)
  const currentInterval = useRef(5000); // Intervalo inicial de 5s
  // Controle de idempotência / anti-loop
  const lastAccountRef = useRef(null);
  const lastChainRef = useRef(null);
  const ensureInFlightRef = useRef(false);
  const lastEnsureTsRef = useRef(0);
  // Rastreia se o job atual é de um wallet group e qual o ID
  const currentGroupIdRef = useRef(null);

  const clearTimer = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const reset = useCallback(() => {
    clearTimer();
    setJobId(null);
    setSnapshot(null);
    setSummary(null);
    setExpired(false);
    setError(null);
    setLoading(false);
    setIsCompleted(false);
    attemptRef.current = 0;
    cancelled.current = false;
    maxAttempts.current = 20;
    currentInterval.current = 5000;
    currentGroupIdRef.current = null;
  }, []);

  const start = useCallback(
    async (accountOrGroupId, chains = null, { isGroup = false } = {}) => {
      // Evita starts concorrentes
      if (ensureInFlightRef.current) return null;
      ensureInFlightRef.current = true;
      try {
        reset();
        setLoading(true);

        // Escolhe o body builder baseado em se é grupo ou endereço único
        const body = isGroup
          ? api.buildStartAggregationBodyV2({ walletGroupId: accountOrGroupId })
          : api.buildStartAggregationBody(accountOrGroupId, chains || undefined);

        // Headers: adiciona Authorization se for um wallet group
        const headers = { 'Content-Type': 'application/json' };
        
        if (isGroup) {
          const token = getToken(accountOrGroupId);
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }

        const res = await fetch(api.startAggregation(), {
          method: 'POST',
          headers,
          body,
        });
        
        if (res.status === 401 && isGroup) {
          console.warn('[useAggregationJob] Token expired for wallet group:', accountOrGroupId);
          notifyTokenExpired(accountOrGroupId);
          throw new Error('Authentication required');
        }
        
        if (!res.ok) throw new Error(`Start failed: ${res.status}`);
        const data = await res.json();
        // Novo formato: { account, jobs: [ { chain, jobId }, ... ] }
        let pickedJobId = data.jobId;
        if (!pickedJobId && Array.isArray(data.jobs)) {
          pickedJobId = api.pickAggregationJob(data.jobs);
        }
        if (!pickedJobId) throw new Error('Missing jobId in start response');
        setJobId(pickedJobId);
        lastAccountRef.current = isGroup ? null : accountOrGroupId;
        lastChainRef.current = null; // multi-chain ou indefinido
        currentGroupIdRef.current = isGroup ? accountOrGroupId : null;
        attemptRef.current = 0;
        currentInterval.current = 5000; // Reset para intervalo inicial
        return pickedJobId;
      } catch (err) {
        setError(err);
        setLoading(false);
        return null;
      } finally {
        ensureInFlightRef.current = false;
      }
    },
    [reset]
  );

  // Tenta reutilizar job ativo antes de criar outro
  const ensure = useCallback(
    async (accountOrGroupId, _unusedChain = null, { force = false, isGroup = false } = {}) => {
      if (!accountOrGroupId) return null;
      const now = Date.now();
      if (!force && now - lastEnsureTsRef.current < 500) return jobId;
      lastEnsureTsRef.current = now;

      if (!force && jobId && !expired && !isGroup && lastAccountRef.current === accountOrGroupId) {
        return jobId;
      }
      if (ensureInFlightRef.current) return jobId;
      ensureInFlightRef.current = true;
      try {
        setLoading(true);
        // Endpoint GET por account deprecado: sempre inicia (idempotente no backend)
        reset(); // agora sim reset global antes de criar
        setLoading(true);

        // Escolhe o body builder baseado em se é grupo ou endereço único
        const body = isGroup
          ? api.buildStartAggregationBodyV2({ walletGroupId: accountOrGroupId })
          : api.buildStartAggregationBody(accountOrGroupId);

        // Headers: adiciona Authorization se for um wallet group
        const headers = { 'Content-Type': 'application/json' };
        
        if (isGroup) {
          const token = getToken(accountOrGroupId);
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }

        const res = await fetch(api.startAggregation(), {
          method: 'POST',
          headers,
          body,
        });
        
        if (res.status === 401 && isGroup) {
          console.warn('[useAggregationJob] Token expired for wallet group:', accountOrGroupId);
          notifyTokenExpired(accountOrGroupId);
          throw new Error('Authentication required');
        }
        
        if (!res.ok) throw new Error(`Start failed: ${res.status}`);
        const data = await res.json();
        let pickedJobId = data.jobId;
        if (!pickedJobId && Array.isArray(data.jobs)) {
          pickedJobId = api.pickAggregationJob(data.jobs);
        }
        if (!pickedJobId) throw new Error('Missing jobId in start response');
        setJobId(pickedJobId);
        lastAccountRef.current = isGroup ? null : accountOrGroupId;
        lastChainRef.current = null;
        currentGroupIdRef.current = isGroup ? accountOrGroupId : null;
        attemptRef.current = 0;
        currentInterval.current = 5000; // Reset para intervalo inicial
        return pickedJobId;
      } catch (err) {
        setError(err);
        setLoading(false);
        return null;
      } finally {
        ensureInFlightRef.current = false;
      }
    },
    [jobId, expired, reset]
  );

  const fetchSnapshot = useCallback(async (id) => {
    try {
      // Adiciona Authorization header se for um wallet group
      const headers = {};
      if (currentGroupIdRef.current) {
        const token = getToken(currentGroupIdRef.current);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(api.getAggregation(id), { headers });
      if (res.status === 404) {
        setExpired(true);
        throw new Error('Job not found (expired or invalid id)');
      }
      if (!res.ok) throw new Error(`Aggregation fetch failed: ${res.status}`);
      const data = await res.json();
      // Normalização de summary (aceita camelCase / PascalCase / TitleCase variando backend)
      if (data.summary && typeof data.summary === 'object') {
        const s = data.summary;
        const norm = {
          TotalTokens: s.TotalTokens ?? s.totalTokens ?? s.total_tokens ?? s.tokens ?? null,
          TotalAaveSupplies: s.TotalAaveSupplies ?? s.totalAaveSupplies ?? s.aaveSupplies ?? null,
          TotalAaveBorrows: s.TotalAaveBorrows ?? s.totalAaveBorrows ?? s.aaveBorrows ?? null,
          TotalUniswapPositions:
            s.TotalUniswapPositions ?? s.totalUniswapPositions ?? s.uniswapPositions ?? null,
          ProvidersCompleted:
            s.ProvidersCompleted ||
            s.providersCompleted ||
            s.providers ||
            s.providers_completed ||
            [],
        };
        setSummary(norm);
      }
      // Deduplicar processed por provider (último vence) e detectar lista inválida
      if (Array.isArray(data.processed)) {
        const allSameZero =
          data.processed.length > 0 && data.processed.every((p) => !p || p.provider === '0');
        if (allSameZero && data.summary) {
          // Reconstruir processed a partir de summary.providersCompleted
          const pcs = (
            data.summary.ProvidersCompleted ||
            data.summary.providersCompleted ||
            data.summary.providers ||
            []
          )
            .filter((p) => typeof p === 'string')
            .map((name) => ({ provider: name, status: 'Success', error: null }));
          data.processed = pcs;
        } else {
          const map = new Map();
          data.processed.forEach((p) => {
            if (!p || !p.provider) return;
            map.set(p.provider, p); // sobrescreve duplicados
          });
          data.processed = Array.from(map.values());
        }
      } else if ((!data.processed || !data.processed.length) && data.summary) {
        const pcs = (
          data.summary.ProvidersCompleted ||
          data.summary.providersCompleted ||
          data.summary.providers ||
          []
        )
          .filter((p) => typeof p === 'string')
          .map((name) => ({ provider: name, status: 'Success', error: null }));
        if (pcs.length) data.processed = pcs;
      }
      setSnapshot(data);

      // Lógica de completude: para apenas em Completed/CompletedWithErrors, CONTINUA em TimedOut
      if (/^(Completed|CompletedWithErrors)$/i.test(data.status)) {
        setIsCompleted(true);
      } else if (data.status === 'TimedOut') {
        // TimedOut: continua polling com intervalo progressivo (mesmo que isCompleted=true do backend)
        console.log(
          `Job TimedOut (attempt ${attemptRef.current}), continuing with progressive polling...`
        );
        setIsCompleted(false); // Força continuar polling para TimedOut
      } else if (data.isCompleted) {
        // Outros casos onde isCompleted=true do backend
        setIsCompleted(true);
      }
    } catch (err) {
      // Em erro de snapshot não marcamos completado; apenas paramos polling na próxima checagem
      setError(err);
    }
  }, []);

  // Função para calcular intervalo progressivo
  const getProgressiveInterval = useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt <= 2) return 5000; // Primeiras 3 tentativas: 5s
    if (attempt <= 5) return 10000; // Próximas 3 tentativas: 10s
    if (attempt <= 10) return 20000; // Próximas 5 tentativas: 20s
    if (attempt <= 15) return 30000; // Próximas 5 tentativas: 30s
    return 60000; // Restantes: 60s
  }, []);

  // Polling loop com intervalos progressivos
  useEffect(() => {
    if (!jobId) return;
    if (cancelled.current) return;

    const run = async () => {
      if (cancelled.current) return;

      // Verificar limite de tentativas
      if (attemptRef.current >= maxAttempts.current) {
        console.warn(`Polling stopped: reached maximum attempts (${maxAttempts.current})`);
        setError(new Error(`Aggregation polling timeout after ${maxAttempts.current} attempts`));
        setLoading(false);
        return;
      }

      attemptRef.current += 1;
      await fetchSnapshot(jobId);

      if (!cancelled.current && !isCompleted) {
        // Calcular intervalo progressivo baseado no número de tentativas
        currentInterval.current = getProgressiveInterval();
        console.log(
          `Scheduling next poll in ${currentInterval.current}ms (attempt ${attemptRef.current}/${maxAttempts.current})`
        );

        pollTimer.current = setTimeout(run, currentInterval.current);
      } else {
        setLoading(false);
      }
    };

    // Dispara imediatamente a primeira consulta
    run();

    return () => {
      cancelled.current = true;
      clearTimer();
    };
  }, [jobId, isCompleted, fetchSnapshot, getProgressiveInterval]);

  // Derivados convenientes
  const progress =
    snapshot?.progress ??
    (snapshot && snapshot.expected > 0
      ? ((snapshot.succeeded || 0) + (snapshot.failed || 0) + (snapshot.timedOut || 0)) /
        snapshot.expected
      : 0);

  return {
    jobId,
    snapshot,
    error,
    loading,
    isCompleted,
    progress,
    // Métricas de progresso expostas para UI granular
    expected: snapshot?.expected ?? null,
    succeeded: snapshot?.succeeded ?? null,
    failed: snapshot?.failed ?? null,
    timedOut: snapshot?.timedOut ?? null,
    status: snapshot?.status || (isCompleted ? 'Completed' : 'Running'),
    summary,
    expired,
    pending: snapshot?.pending || [],
    processed: snapshot?.processed || [],
    // Informações do polling progressivo
    pollingAttempt: attemptRef.current,
    maxPollingAttempts: maxAttempts.current,
    nextPollInterval: currentInterval.current,
    start,
    ensure, // start com reutilização de job existente por account (idempotente)
    reset,
  };
}

export default useAggregationJob;
