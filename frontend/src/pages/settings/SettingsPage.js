import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Card, CardContent, Tab, Tabs, Typography } from '@mui/material';
import ProfilePanel from './ProfilePanel';
import PasswordPanel from './PasswordPanel';
import PrivacyPanel from './PrivacyPanel';
import DangerPanel from './DangerPanel';
import { tabFromParam } from './settingsSchemas';

const TABS = [
  { value: 'profile', label: 'Profile', Panel: ProfilePanel },
  { value: 'password', label: 'Password', Panel: PasswordPanel },
  { value: 'privacy', label: 'Privacy & data', Panel: PrivacyPanel },
  { value: 'danger', label: 'Delete account', Panel: DangerPanel },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = tabFromParam(searchParams.get('tab'));
  const current = TABS.find((t) => t.value === active);

  return (
    <Box>
      <Typography variant="h4" component="h1">Settings</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Manage your profile, password and data.</Typography>

      <Card>
        <Tabs
          value={active}
          onChange={(_, value) => setSearchParams({ tab: value }, { replace: true })}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Settings sections"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              id={`settings-tab-${tab.value}`}
              aria-controls={`settings-panel-${tab.value}`}
            />
          ))}
        </Tabs>
        <CardContent
          role="tabpanel"
          id={`settings-panel-${active}`}
          aria-labelledby={`settings-tab-${active}`}
          sx={{ p: { xs: 2, md: 4 } }}
        >
          <current.Panel />
        </CardContent>
      </Card>
    </Box>
  );
}
