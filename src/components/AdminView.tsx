import React, { useState, useEffect } from 'react';
import { Circle, Pencil } from 'lucide-react';
import {
  setPromptOverride,
  clearPromptOverride,
  getAllPrompts,
  getDefaultPrompt,
  PromptConfig,
} from '../services/promptService';

export const AdminView: React.FC = () => {
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
    } catch (error) {
      console.error('Failed to save prompt:', error);
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
    } catch (error) {
      console.error('Failed to reset prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="mb-2 text-xl font-semibold text-slate-800">Prompt Settings</h2>
      <p className="mb-8 text-sm text-slate-500">
        Customize the AI prompts. Changes are saved to the database.
      </p>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'summary'
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Summary Prompt
          {prompts.hasOverrides.summary && (
            <Circle className="h-1.5 w-1.5 fill-emerald-400 text-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('tts')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'tts'
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          TTS Prompt
          {prompts.hasOverrides.tts && (
            <Circle className="h-1.5 w-1.5 fill-emerald-400 text-emerald-400" />
          )}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <textarea
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="h-96 w-full resize-none p-6 font-mono text-sm outline-none"
          placeholder={`Enter your custom ${activeTab} prompt...`}
        />
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="flex items-center gap-2 text-xs text-slate-400">
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
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset to Default'}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
