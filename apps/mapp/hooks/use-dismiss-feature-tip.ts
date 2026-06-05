import { useCallback } from 'react';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import type { FeatureTipId } from '@homeapp/common/lib/feature-discovery';

export function useDismissFeatureTip() {
  const { preferences, updatePreferences } = usePreferences();

  const dismissTip = useCallback(
    (tipId: FeatureTipId) => {
      void updatePreferences({
        featureTipsDismissed: {
          ...preferences?.featureTipsDismissed,
          [tipId]: true,
        },
      });
    },
    [preferences?.featureTipsDismissed, updatePreferences]
  );

  return { dismissTip };
}
