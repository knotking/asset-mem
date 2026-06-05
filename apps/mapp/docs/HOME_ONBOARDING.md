# Home onboarding checklist (mapp + web)

Four-step checklist on the properties home screen. Step logic: `@homeapp/common/lib/home-onboarding` (mapp); `apps/webapp/src/lib/home-onboarding.ts` (web mirror — keep in sync).

## Steps

1. **Add property** — at least one property exists.
2. **Upload** — onboarding property has `docs > 0` (Firestore doc count on mapp; document list length on web).
3. **Checkpoint** — onboarding property has `checks > 0` (checkpoint subcollection count).
4. **Chat** — user tapped **Open AI Chat** from the checklist. On landing (via `fromOnboardingChecklist` route param), the param is cleared immediately and `onboardingChatOpened` is written in the background so other property tabs stay responsive.

## Onboarding property

- Pinned in Firestore preferences as `onboardingPropertyId` when the first property is created (home modal on mapp; new-property upload flow on web).
- If unset or deleted, falls back to the **oldest** property by `createdAt`.
- Adding a second property does not change which property steps 2–4 target.

## Hide rules

Checklist stays visible until the user dismisses it (X or **Dismiss checklist** when all steps are done). When all four steps are complete, every row shows as done and the header reads **All steps complete**; it does not auto-hide.

Hidden only when `onboardingChecklistDismissed` is true.

## Preferences fields

`users/{uid}/preferences/user`: `onboardingPropertyId`, `onboardingChecklistDismissed`, `onboardingChatOpened`.

After onboarding, see [FEATURE_DISCOVERY.md](../../docs/FEATURE_DISCOVERY.md) for the discovery checklist, help hub, chat prompts, and contextual tips.
