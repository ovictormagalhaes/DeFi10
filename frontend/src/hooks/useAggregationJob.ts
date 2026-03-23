import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../config/api';
import { getToken, notifyTokenExpired } from '../services/apiClient';

interface ProcessedEntry {
  provider: string;
  status: string;
  error: string | null;
}

interface AggregationSummary {
  TotalTokens: number | null;
  TotalAaveSupplies: number | null;
  TotalAaveBorrows: number | null;
  TotalUniswapPositions: number | null;
  ProvidersCompleted: string[];
}

interface AggregationSnapshot {
  status?: string;
  isCompleted?: boolean;
  progress?: number;
  expected?: number;
  succeeded?: number;
  failed?: number;
  timedOut?: number;
  pending?: string[];
  processed?: ProcessedEntry[];
  summary?: Record<string, any>;
  [key: string]: any;
}

interface StartOptions {
  isGroup?: boolean;
}

interface EnsureOptions {
  force?: boolean;
  isGroup?: boolean;
}

interface UseAggregationJobReturn {
  jobId: string | null;
  snapshot: AggregationSnapshot | null;
  error: Error | null;
  loading: boolean;
  isCompleted: boolean;
  progress: number;
  expected: number | null;
  succeeded: number | null;
  failed: number | null;
  timedOut: number | null;
  status: string;
  summary: AggregationSummary | null;
  expired: boolean;
  pending: string[];
  processed: ProcessedEntry[];
  pollingAttempt: number;
  maxPollingAttempts: number;
  nextPollInterval: number;
  start: (accountOrGroupId: string, chains?: string[] | null, options?: StartOptions) => Promise<string | null>;
  ensure: (accountOrGroupId: string, _unusedChain?: string | null, options?: EnsureOptions) => Promise<string | null>;
  reset: () => void;
}

/**
 * Hook para gerenciar ciclo de vida de um job de agregação.
 * Passos:
 * 1. start(account, chains?) -> cria job (POST /api/v1/aggregations  body: { account, chains? })
 * 2. polling até isCompleted=true usando GET /api/v1/aggregations/{jobId}
 * Endpoint único já traz parciais (pending/processed/progress)
 */
export function useAggregationJob(): UseAggregationJobReturn {
  const [jobId, setJobId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AggregationSnapshot | null>(null);
  const [summary, setSummary] = useState<AggregationSummary | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const cancelled = useRef(false);
  const maxAttempts = useRef(20);
  const currentInterval = useRef(5000);
  const lastAccountRef = useRef<string | null>(null);
  const lastChainRef = useRef<string | null>(null);
  const ensureInFlightRef = useRef(false);
  const lastEnsureTsRef = useRef(0);
  const currentGroupIdRef = useRef<string | null>(null);

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
    async (accountOrGroupId: string, chains: string[] | null = null, { isGroup = false }: StartOptions = {}): Promise<string | null> => {
      if (ensureInFlightRef.current) return null;
      ensureInFlightRef.current = true;
      try {
        reset();
        setLoading(true);

        const body = isGroup
          ? api.buildStartAggregationBodyV2({ walletGroupId: accountOrGroupId })
          : api.buildStartAggregationBody(accountOrGroupId, chains || undefined);

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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
        currentInterval.current = 5000;
        return pickedJobId;
      } catch (err) {
        setError(err as Error);
        setLoading(false);
        return null;
      } finally {
        ensureInFlightRef.current = false;
      }
    },
    [reset]
  );

  const ensure = useCallback(
    async (accountOrGroupId: string, _unusedChain: string | null = null, { force = false, isGroup = false }: EnsureOptions = {}): Promise<string | null> => {
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
        reset();
        setLoading(true);

        const body = isGroup
          ? api.buildStartAggregationBodyV2({ walletGroupId: accountOrGroupId })
          : api.buildStartAggregationBody(accountOrGroupId);

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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
        currentInterval.current = 5000;
        return pickedJobId;
      } catch (err) {
        setError(err as Error);
        setLoading(false);
        return null;
      } finally {
        ensureInFlightRef.current = false;
      }
    },
    [jobId, expired, reset]
  );

  const fetchSnapshot = useCallback(async (id: string) => {
    try {
      const headers: Record<string, string> = {};
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
      if (data.summary && typeof data.summary === 'object') {
        const s = data.summary;
        const norm: AggregationSummary = {
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
      if (Array.isArray(data.processed)) {
        const allSameZero =
          data.processed.length > 0 && data.processed.every((p: any) => !p || p.provider === '0');
        if (allSameZero && data.summary) {
          const pcs = (
            data.summary.ProvidersCompleted ||
            data.summary.providersCompleted ||
            data.summary.providers ||
            []
          )
            .filter((p: any) => typeof p === 'string')
            .map((name: string) => ({ provider: name, status: 'Success', error: null }));
          data.processed = pcs;
        } else {
          const map = new Map<string, ProcessedEntry>();
          data.processed.forEach((p: any) => {
            if (!p || !p.provider) return;
            map.set(p.provider, p);
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
          .filter((p: any) => typeof p === 'string')
          .map((name: string) => ({ provider: name, status: 'Success', error: null }));
        if (pcs.length) data.processed = pcs;
      }
      setSnapshot(data);

      if (/^(Completed|CompletedWithErrors)$/i.test(data.status)) {
        setIsCompleted(true);
      } else if (data.status === 'TimedOut') {
        setIsCompleted(false);
      } else if (data.isCompleted) {
        setIsCompleted(true);
      }
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const getProgressiveInterval = useCallback((): number => {
    const attempt = attemptRef.current;
    if (attempt <= 2) return 5000;
    if (attempt <= 5) return 10000;
    if (attempt <= 10) return 20000;
    if (attempt <= 15) return 30000;
    return 60000;
  }, []);

  useEffect(() => {
    if (!jobId) return;
    if (cancelled.current) return;

    const run = async () => {
      if (cancelled.current) return;

      if (attemptRef.current >= maxAttempts.current) {
        console.warn(`Polling stopped: reached maximum attempts (${maxAttempts.current})`);
        setError(new Error(`Aggregation polling timeout after ${maxAttempts.current} attempts`));
        setLoading(false);
        return;
      }

      attemptRef.current += 1;
      await fetchSnapshot(jobId);

      if (!cancelled.current && !isCompleted) {
        currentInterval.current = getProgressiveInterval();
        pollTimer.current = setTimeout(run, currentInterval.current);
      } else {
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled.current = true;
      clearTimer();
    };
  }, [jobId, isCompleted, fetchSnapshot, getProgressiveInterval]);

  const progress =
    snapshot?.progress ??
    (snapshot && (snapshot.expected ?? 0) > 0
      ? ((snapshot.succeeded || 0) + (snapshot.failed || 0) + (snapshot.timedOut || 0)) /
        (snapshot.expected as number)
      : 0);

  return {
    jobId,
    snapshot,
    error,
    loading,
    isCompleted,
    progress,
    expected: snapshot?.expected ?? null,
    succeeded: snapshot?.succeeded ?? null,
    failed: snapshot?.failed ?? null,
    timedOut: snapshot?.timedOut ?? null,
    status: snapshot?.status || (isCompleted ? 'Completed' : 'Running'),
    summary,
    expired,
    pending: (snapshot?.pending || []) as string[],
    processed: (snapshot?.processed || []) as ProcessedEntry[],
    pollingAttempt: attemptRef.current,
    maxPollingAttempts: maxAttempts.current,
    nextPollInterval: currentInterval.current,
    start,
    ensure,
    reset,
  };
}

export default useAggregationJob;
