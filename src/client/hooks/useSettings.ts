import { useState, useEffect, useCallback } from 'react';
import { SystemSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import i18n from '../i18n';

export interface ExtendedSettings extends SystemSettings {
  isWritable?: boolean;
  storageSizeBytes?: number;
}

export function useSettings() {
  const [settings, setSettings] = useState<ExtendedSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
      }
    } catch (err: any) {
      setError(err?.message || i18n.t('settings.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (
    newConfig: Partial<SystemSettings> & { migrateData?: boolean }
  ) => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || i18n.t('settings.saveFailed'));
      }
      setSettings(json.data);
      return json.data;
    } catch (err: any) {
      setError(err?.message || i18n.t('settings.saveFailed'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const validateDir = async (dirPath: string) => {
    const res = await fetch('/api/settings/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    const json = await res.json();
    return json;
  };

  return {
    settings,
    loading,
    saving,
    error,
    fetchSettings,
    saveSettings,
    validateDir,
  };
}
