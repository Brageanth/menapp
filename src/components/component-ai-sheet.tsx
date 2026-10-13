'use client';

import { useState } from 'react';
import type { Component, NewComponentInput } from '@/domain/component';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import { ComponentFormSheet, inputStyle, labelStyle } from './component-form-sheet';

type Step = 'input' | 'loading' | 'preview' | 'error';

function normalizeAiOutput(raw: Record<string, unknown>): NewComponentInput {
  const nullToUndefined = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
  return {
    ...raw,
    typicalSlots: nullToUndefined(raw.typicalSlots as NewComponentInput['typicalSlots']),
    flavorProfile: nullToUndefined(raw.flavorProfile as NewComponentInput['flavorProfile']),
    temperature: nullToUndefined(raw.temperature as NewComponentInput['temperature']),
    effort: nullToUndefined(raw.effort as NewComponentInput['effort']),
    cookedShelfLifeDays: nullToUndefined(raw.cookedShelfLifeDays as NewComponentInput['cookedShelfLifeDays']),
    batchable: nullToUndefined(raw.batchable as NewComponentInput['batchable']),
    ingredients: nullToUndefined(raw.ingredients as NewComponentInput['ingredients']),
    steps: nullToUndefined(raw.steps as NewComponentInput['steps']),
    isCompleteDish: nullToUndefined(raw.isCompleteDish as NewComponentInput['isCompleteDish']),
    notes: nullToUndefined(raw.notes as NewComponentInput['notes']),
  } as NewComponentInput;
}

export function ComponentAiSheet({
  existing,
  onSave,
  onArchive,
  onClose,
}: {
  existing?: Component;
  onSave: (values: NewComponentInput) => void;
  onArchive?: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('input');
  const [description, setDescription] = useState('');
  const [aiResult, setAiResult] = useState<NewComponentInput | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate() {
    if (!description.trim()) return;
    setStep('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/component-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, existing }),
      });
      if (!res.ok) throw new Error('bad response');
      const raw = await res.json();
      setAiResult(normalizeAiOutput(raw));
      setStep('preview');
    } catch {
      setErrorMsg('No se pudo generar el componente. Probá de nuevo o completalo a mano.');
      setStep('error');
    }
  }

  if (step === 'preview') {
    return (
      <ComponentFormSheet
        initial={existing}
        prefill={aiResult ?? undefined}
        onSave={onSave}
        onArchive={onArchive}
        onClose={onClose}
        onBackToDescription={() => setStep('input')}
      />
    );
  }

  return (
    <TextInputSheet
      mode={existing ? 'edit' : 'create'}
      description={description}
      onChangeDescription={setDescription}
      loading={step === 'loading'}
      error={errorMsg}
      onSubmit={handleGenerate}
      onSkipToManual={() => {
        setAiResult(null);
        setStep('preview');
      }}
      onClose={onClose}
    />
  );
}

function TextInputSheet({
  mode,
  description,
  onChangeDescription,
  loading,
  error,
  onSubmit,
  onSkipToManual,
  onClose,
}: {
  mode: 'create' | 'edit';
  description: string;
  onChangeDescription: (v: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
  onSkipToManual: () => void;
  onClose: () => void;
}) {
  useLockBodyScroll(onClose);

  return (
    <div
      style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '88dvh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 24 }}>{mode === 'edit' ? 'Editar con IA' : 'Nuevo componente'}</h2>

        <label style={labelStyle}>
          {mode === 'edit' ? 'Describí el cambio' : 'Describí el componente'}
          <textarea
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            rows={4}
            autoFocus
            placeholder={
              mode === 'edit' ? 'ej: "subile las proteínas a 40g"' : 'ej: "pechuga de pollo a la plancha, porción típica 150g"'
            }
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        {error && <p style={{ fontSize: 12.5, color: '#A8412B' }}>{error}</p>}

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !description.trim()}
          style={{
            padding: 14,
            borderRadius: 10,
            background: '#2B2724',
            color: '#FAF8F4',
            fontWeight: 600,
            fontSize: 14.5,
            border: 'none',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Generando…' : 'Generar'}
        </button>

        <button
          type="button"
          onClick={onSkipToManual}
          style={{ alignSelf: 'center', fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: 0 }}
        >
          Completar a mano en su lugar
        </button>
      </div>
    </div>
  );
}
