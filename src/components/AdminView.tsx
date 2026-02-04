import React, { useState, useEffect } from 'react';
import { Pencil, CheckCircle2 } from 'lucide-react';
import {
  setPromptOverride,
  clearPromptOverride,
  getAllPrompts,
  getDefaultPrompt,
  PromptConfig,
} from '../services/promptService';
import { useToast } from './ToastProvider';

export const AdminView: React.FC = () => {
  const { showToast } = useToast();
  const [prompts, setPrompts] = useState<{
    defaults: PromptConfig;
    current: PromptConfig;
    hasOverrides: { summary: boolean; tts: boolean };
  }>({
    defaults: { summary: '', tts: '' },
    current: { summary: '', tts: '' },
    hasOverrides: { summary: false, tts: false },
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'tts'>('summary');
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    setEditValue(prompts.current[activeTab]);
  }, [activeTab, prompts]);

  const loadPrompts = async () => {
    try {
      const allPrompts = await getAllPrompts();
      setPrompts(allPrompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setPromptOverride(activeTab, editValue);
      await loadPrompts();
      showToast({
        variant: 'success',
        title: 'Prompt saved',
        description: `${activeTab === 'summary' ? 'Summary' : 'TTS'} prompt has been saved to the database.`,
      });
    } catch (error) {
      console.error('Failed to save prompt:', error);
      showToast({
        variant: 'error',
        title: 'Save failed',
        description: 'Could not save prompt. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await clearPromptOverride(activeTab);
      await loadPrompts();
      setEditValue(getDefaultPrompt(activeTab));
      showToast({
        variant: 'success',
        title: 'Prompt reset',
        description: `${activeTab === 'summary' ? 'Summary' : 'TTS'} prompt has been reset to default.`,
      });
    } catch (error) {
      console.error('Failed to reset prompt:', error);
      showToast({
        variant: 'error',
        title: 'Reset failed',
        description: 'Could not reset prompt. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="mb-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Prompt Settings
      </h2>
      <p className="mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Customize the AI prompts. Changes are saved to the database.
      </p>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={activeTab === 'summary' ? 'btn btn-primary' : 'btn btn-outline'}
        >
          Summary Prompt
          {prompts.hasOverrides.summary && (
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--accent-secondary)' }} />
          )}
        </button>
        <button
          onClick={() => setActiveTab('tts')}
          className={activeTab === 'tts' ? 'btn btn-primary' : 'btn btn-outline'}
        >
          TTS Prompt
          {prompts.hasOverrides.tts && (
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--accent-secondary)' }} />
          )}
        </button>
      </div>

      <div className="card-elevated overflow-hidden">
        <textarea
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="h-96 w-full resize-none p-6 font-mono text-sm outline-none"
          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
          placeholder={`Enter your custom ${activeTab} prompt...`}
        />
        <div
          className="flex items-center justify-between border-t px-6 py-4"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
        >
          <span
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {prompts.hasOverrides[activeTab] ? (
              <>
                <Pencil className="h-3 w-3" /> Custom prompt active
              </>
            ) : (
              'Using default prompt'
            )}
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={loading}
              className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset to Default'}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-pokeball-600 hover:bg-pokeball-700 rounded-lg px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
