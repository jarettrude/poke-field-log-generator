import React, { useState, useEffect } from 'react';
import { Pencil, CheckCircle2 } from 'lucide-react';
import {
  setPromptOverride,
  clearPromptOverride,
  getAllPrompts,
  getDefaultPrompt,
  PromptConfig,
} from '../services/promptService';
import {
  recoverStalledJobs,
  pauseAllRunningJobs,
  cancelAllRunningJobs,
} from '../services/jobsService';
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
  const [maintenanceLoading, setMaintenanceLoading] = useState<
    'recover' | 'pauseAll' | 'cancelAll' | null
  >(null);
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

  const handleRecoverStalled = async () => {
    setMaintenanceLoading('recover');
    try {
      const result = await recoverStalledJobs();
      showToast({
        variant: 'success',
        title: 'Stalled jobs recovered',
        description:
          result.recoveredCount === 0
            ? 'No stalled jobs found.'
            : `Recovered ${result.recoveredCount} stalled job(s) back to the queue.`,
      });
    } catch (error) {
      console.error('Failed to recover stalled jobs:', error);
      showToast({
        variant: 'error',
        title: 'Recovery failed',
        description: 'Could not recover stalled jobs. Please try again.',
      });
    } finally {
      setMaintenanceLoading(null);
    }
  };

  const handlePauseAll = async () => {
    setMaintenanceLoading('pauseAll');
    try {
      const result = await pauseAllRunningJobs();
      showToast({
        variant: 'success',
        title: 'Jobs paused',
        description:
          result.pausedCount === 0
            ? 'No running jobs to pause.'
            : `Paused ${result.pausedCount} running job(s).`,
      });
    } catch (error) {
      console.error('Failed to pause running jobs:', error);
      showToast({
        variant: 'error',
        title: 'Pause failed',
        description: 'Could not pause running jobs. Please try again.',
      });
    } finally {
      setMaintenanceLoading(null);
    }
  };

  const handleCancelAll = async () => {
    setMaintenanceLoading('cancelAll');
    try {
      const result = await cancelAllRunningJobs();
      showToast({
        variant: 'success',
        title: 'Jobs canceled',
        description:
          result.canceledCount === 0
            ? 'No running jobs to cancel.'
            : `Canceled ${result.canceledCount} running job(s).`,
      });
    } catch (error) {
      console.error('Failed to cancel running jobs:', error);
      showToast({
        variant: 'error',
        title: 'Cancel failed',
        description: 'Could not cancel running jobs. Please try again.',
      });
    } finally {
      setMaintenanceLoading(null);
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
              className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      <h2 className="mt-8 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Job Maintenance
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Use these tools to recover from crashes or intentionally stop work before restarting.
      </p>
      <div className="card-elevated mb-10 overflow-hidden">
        <div className="flex flex-col gap-3 p-6">
          <button
            onClick={handleRecoverStalled}
            disabled={maintenanceLoading !== null}
            className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {maintenanceLoading === 'recover' ? 'Recovering...' : 'Recover Stalled Jobs'}
          </button>
          <button
            onClick={handlePauseAll}
            disabled={maintenanceLoading !== null}
            className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {maintenanceLoading === 'pauseAll' ? 'Pausing...' : 'Pause All Running Jobs'}
          </button>
          <button
            onClick={handleCancelAll}
            disabled={maintenanceLoading !== null}
            className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {maintenanceLoading === 'cancelAll' ? 'Canceling...' : 'Cancel All Running Jobs'}
          </button>
        </div>
      </div>
    </div>
  );
};
