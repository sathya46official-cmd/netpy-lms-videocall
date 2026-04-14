'use client';

import { useEffect, useState } from 'react';
import { Lock, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Loader from '@/components/Loader';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils';

type OrganisationSettings = {
  inviteOnlyOnboarding: boolean;
  multiBatchGrouping: boolean;
  staffCanCreateMeetings: boolean;
  studentsCanPostQuestions: boolean;
};

const DEFAULT_SETTINGS: OrganisationSettings = {
  inviteOnlyOnboarding: true,
  multiBatchGrouping: true,
  staffCanCreateMeetings: true,
  studentsCanPostQuestions: true,
};

export default function OrgAdminSettingsPage() {
  const [settings, setSettings] = useState<OrganisationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/organisations/settings');
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error ?? `Failed to load settings (${res.status})`);
        }

        setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) });
        setHasLoadError(false);
      } catch (error) {
        setHasLoadError(true);
        toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  const updateSetting = (key: keyof OrganisationSettings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      const res = await fetch('/api/organisations/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed to save settings (${res.status})`);
      }

      toast({ title: 'Settings saved', description: 'Your organization settings were updated.' });
    } catch (error) {
      toast({ title: 'Save failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-800">Organisation Settings</h1>
        <p className="text-stone-500">Manage your institution&apos;s configuration and policies.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="bg-white border-stone-200">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="bg-stone-100 p-2 rounded-lg"><Settings2 className="h-5 w-5 text-stone-600" /></div>
            <CardTitle className="text-stone-800 text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-stone-600">
            <label className="flex items-center justify-between gap-4">
              <span>Invite-based onboarding</span>
              <input
                type="checkbox"
                checked={settings.inviteOnlyOnboarding}
                onChange={() => updateSetting('inviteOnlyOnboarding')}
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Multi-batch student grouping</span>
              <input
                type="checkbox"
                checked={settings.multiBatchGrouping}
                onChange={() => updateSetting('multiBatchGrouping')}
              />
            </label>
          </CardContent>
        </Card>

        <Card className="bg-white border-stone-200">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="bg-stone-100 p-2 rounded-lg"><Lock className="h-5 w-5 text-stone-600" /></div>
            <CardTitle className="text-stone-800 text-base">Access Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-stone-600">
            <label className="flex items-center justify-between gap-4">
              <span>Staff can create meetings</span>
              <input
                type="checkbox"
                checked={settings.staffCanCreateMeetings}
                onChange={() => updateSetting('staffCanCreateMeetings')}
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Students can post Q&amp;A questions</span>
              <input
                type="checkbox"
                checked={settings.studentsCanPostQuestions}
                onChange={() => updateSetting('studentsCanPostQuestions')}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      <div>
        <Button onClick={saveSettings} disabled={isSaving || hasLoadError}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        {hasLoadError && (
          <p className="text-xs text-red-500 mt-2">Cannot save settings because they failed to load. Please refresh the page.</p>
        )}
      </div>
    </div>
  );
}
