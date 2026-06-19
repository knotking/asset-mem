/** Tailwind class tokens for signed-in app shell (/home/*). Mobile-first. */

/** Page title — dashboard, settings, etc. */
export const APP_PAGE_TITLE_CLASS =
  'text-lg sm:text-2xl font-bold tracking-tight text-foreground';

/** Page subtitle under H1 */
export const APP_PAGE_SUBTITLE_CLASS = 'text-sm text-muted-foreground';

/** Sticky property header — property name */
export const APP_PROPERTY_TITLE_CLASS =
  'text-base sm:text-lg font-semibold text-foreground truncate';

/** Section / card heading inside a page */
export const APP_SECTION_TITLE_CLASS =
  'text-base sm:text-lg font-semibold text-foreground';

/** In-page subsection heading (below tab header, above a list) */
export const APP_SUBSECTION_TITLE_CLASS = APP_SECTION_TITLE_CLASS;

/** Primary label on a list/card row (checkpoint name, document name, etc.) */
export const APP_LIST_ITEM_TITLE_CLASS =
  'text-sm sm:text-base font-semibold leading-snug text-foreground';

/** Profile display name and similar emphasized body text */
export const APP_PROFILE_NAME_CLASS =
  'text-base sm:text-lg font-medium text-foreground';

/** Primary nav tabs (property shell, timeline sub-tabs) */
export const APP_NAV_TAB_CLASS = 'text-sm font-medium';

/** Sheet / drawer panel title */
export const APP_SHEET_TITLE_CLASS = 'text-base sm:text-lg font-semibold';

/** Dialog title (matches shadcn DialogTitle) */
export const APP_DIALOG_TITLE_CLASS =
  'text-base sm:text-lg font-semibold leading-none tracking-tight';

/** Caption, chart labels, and other secondary microcopy */
export const APP_CAPTION_CLASS = 'text-xs text-muted-foreground';

/** Read-only form field value (Basic Information, etc.) */
export const APP_FIELD_VALUE_CLASS = 'text-sm sm:text-base text-foreground';

/** Muted container for read-only field values */
export const APP_FIELD_VALUE_BOX_CLASS =
  'min-w-0 break-words rounded-md bg-muted/50 p-2.5 sm:p-3 min-h-[36px] sm:min-h-[40px]';

/** Screen-reader-only page title inside the property shell (visible header already names the property). */
export const APP_SR_ONLY_PAGE_TITLE_CLASS = 'sr-only';
