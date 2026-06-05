'use client';

import { useCallback } from 'react';
import { usePreferences } from '@/contexts/preferences-context';
import type { FeatureTipId } from '@/lib/feature-discovery';
import { trackEvent } from '@/lib/analytics';

export function useDismissFeatureTip() {
  const { preferences, updatePreferences } = usePreferences();

  const dismissTip = useCallback(
    (tipId: FeatureTipId) => {
      trackEvent('feature_tip_dismiss', { tip_id: tipId });
      void updatePreferences({
        featureTipsDismissed: {
          [tipId]: true,
        },
      });
    },
    [updatePreferences]
  );

  return { dismissTip };
}
