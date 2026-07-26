import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FOOD_PORTION_OPTIONS,
  adjustFoodPhotoAnalysisPortion,
  foodPhotoErrorMessage,
  normalizeFoodPhotoAnalysis,
  prepareFoodPhotoForAnalysis,
  validateFoodPhotoFile
} from '../foodPhotoAnalysis.js';

const DISCONNECTED_MESSAGE = 'Orbit Bridge 연결을 확인한 뒤 다시 시도해주세요.';
const ANALYZING_MESSAGE = '사진을 줄이고 음식과 영양을 분석하고 있어요.';
const READY_MESSAGE = '먹은 양을 확인하고 바로 기록하거나 입력칸에서 수정해주세요.';
const PORTION_MULTIPLIERS = new Set(FOOD_PORTION_OPTIONS.map(({ value }) => value));
const UNAVAILABLE_BRIDGE_KINDS = new Set(['unpaired', 'offline', 'disconnected', 'revoked']);

export function shouldAbortFoodPhotoAnalysis(bridgeKind, analysisStatus) {
  return analysisStatus === 'analyzing'
    && UNAVAILABLE_BRIDGE_KINDS.has(String(bridgeKind || ''));
}

export function createFoodPhotoReadyState(response) {
  return {
    status: 'ready',
    message: READY_MESSAGE,
    analysis: normalizeFoodPhotoAnalysis(response)
  };
}

export default function useFoodPhotoAnalyzer({ bridgeClient, bridgeStatus }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [portionMultiplier, setPortionMultiplierState] = useState(1);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  const mountedRef = useRef(true);
  const requestRef = useRef(null);
  const previewUrlRef = useRef('');
  const selectedFileRef = useRef(null);

  const adjustedAnalysis = useMemo(
    () => adjustFoodPhotoAnalysisPortion(analysis, portionMultiplier),
    [analysis, portionMultiplier]
  );

  const setError = useCallback((error) => {
    if (!mountedRef.current) return;
    setStatus('error');
    setMessage(foodPhotoErrorMessage(error));
  }, []);

  const clearSelectedPhoto = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    selectedFileRef.current = null;
    if (previewUrlRef.current) globalThis.URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    if (!mountedRef.current) return;
    setPreviewUrl('');
    setSelectedFileName('');
    setAnalysis(null);
    setPortionMultiplierState(1);
  }, []);

  const runAnalysis = useCallback(async (file) => {
    requestRef.current?.abort();

    if (!bridgeClient || bridgeStatus?.kind !== 'connected') {
      if (mountedRef.current) {
        setStatus('error');
        setMessage(DISCONNECTED_MESSAGE);
      }
      return null;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    if (mountedRef.current) {
      setStatus('analyzing');
      setMessage(ANALYZING_MESSAGE);
    }

    try {
      const prepared = await prepareFoodPhotoForAnalysis(file);
      if (controller.signal.aborted || !mountedRef.current) return null;

      const response = await bridgeClient.analyzeFood(
        { imageDataUrl: prepared.imageDataUrl },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || !mountedRef.current) return null;

      const ready = createFoodPhotoReadyState(response);
      if (controller.signal.aborted || !mountedRef.current) return null;
      setAnalysis(ready.analysis);
      setStatus(ready.status);
      setMessage(ready.message);
      return ready.analysis;
    } catch (error) {
      if (controller.signal.aborted || error?.code === 'CANCELLED' || !mountedRef.current) {
        return null;
      }
      setError(error);
      return null;
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [bridgeClient, bridgeStatus?.kind, setError]);

  const analyzeFile = useCallback(async (file) => {
    try {
      validateFoodPhotoFile(file);
    } catch (error) {
      clearSelectedPhoto();
      setError(error);
      return null;
    }

    let nextPreviewUrl;
    try {
      nextPreviewUrl = globalThis.URL.createObjectURL(file);
    } catch (error) {
      clearSelectedPhoto();
      setError(error);
      return null;
    }

    requestRef.current?.abort();
    if (previewUrlRef.current) globalThis.URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = nextPreviewUrl;
    selectedFileRef.current = file;

    if (mountedRef.current) {
      setPreviewUrl(nextPreviewUrl);
      setSelectedFileName(file.name || '음식 사진');
      setAnalysis(null);
      setPortionMultiplierState(1);
      setStatus('idle');
      setMessage('');
    }

    return runAnalysis(file);
  }, [clearSelectedPhoto, runAnalysis, setError]);

  const retry = useCallback(() => {
    const file = selectedFileRef.current;
    if (!file) {
      try {
        validateFoodPhotoFile(file);
      } catch (error) {
        setError(error);
      }
      return Promise.resolve(null);
    }
    return runAnalysis(file);
  }, [runAnalysis, setError]);

  const setPortionMultiplier = useCallback((value) => {
    const numericValue = Number(value);
    setPortionMultiplierState(PORTION_MULTIPLIERS.has(numericValue) ? numericValue : 1);
  }, []);

  const reset = useCallback(() => {
    clearSelectedPhoto();
    if (!mountedRef.current) return;
    setStatus('idle');
    setMessage('');
  }, [clearSelectedPhoto]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      if (previewUrlRef.current) globalThis.URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
      selectedFileRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!shouldAbortFoodPhotoAnalysis(bridgeStatus?.kind, status)) return;
    requestRef.current?.abort();
    requestRef.current = null;
    setStatus('error');
    setMessage(DISCONNECTED_MESSAGE);
  }, [bridgeStatus?.kind, status]);

  return {
    previewUrl,
    analysis,
    adjustedAnalysis,
    portionMultiplier,
    status,
    message,
    selectedFileName,
    analyzeFile,
    retry,
    setPortionMultiplier,
    reset,
    isAnalyzing: status === 'analyzing'
  };
}
