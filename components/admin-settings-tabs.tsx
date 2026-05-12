'use client';
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkScheduleSettings from '@/components/work-schedule-settings';
import WeeklyTrackerSettings from '@/components/daily-tracker-settings';
import CrmIntegrationSettings from '@/components/crm-integration-settings';
import ShiftSettings from '@/components/shift-settings';
import AttendancePolicySettings from '@/components/attendance-policy-settings';
import OrgEntityManager from '@/components/org-entity-manager';

const TABS = [
  { key: 'general',      label: 'General' },
  { key: 'organization', label: 'Organization' },
  { key: 'shifts',       label: 'Shifts' },
  { key: 'attendance-policy', label: 'Attendance Policy' },
  { key: 'notifications', label: 'Notifications' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminSettingsTabs({ initialTab }: { initialTab?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || initialTab || 'general';
  const activeTab = useMemo<TabKey>(() => {
    return TABS.some((tab) => tab.key === currentTab) ? (currentTab as TabKey) : 'general';
  }, [currentTab]);

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/admin/settings?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-3xl p-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTab(tab.key)}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <WorkScheduleSettings />
            <WeeklyTrackerSettings />
            <CrmIntegrationSettings />
          </div>
        )}

        {activeTab === 'organization' && (
          <div className="space-y-4">
            <OrgEntityManager
              entityType="team"
              apiPath="/api/teams"
              label="Team"
              examples={['KORA CORE', 'HOMES Kora', 'Engineering', 'Sales', 'Operations']}
            />
          </div>
        )}

        {activeTab === 'shifts' && (
          <div className="space-y-4">
            <ShiftSettings />
          </div>
        )}

        {activeTab === 'attendance-policy' && (
          <div className="space-y-4">
            <AttendancePolicySettings />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-3xl border border-gray-200 p-8 text-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Notifications</h2>
            <p className="text-sm text-gray-600">
              Notification settings are not configured yet. This section is reserved for future admin notification preferences.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
