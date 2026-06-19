/** Tailwind class tokens for signed-in app shell (/home/*). Mobile-first. */

/** Page title — dashboard, timeline, settings, etc. */
export const APP_PAGE_TITLE_CLASS = 'text-2xl font-bold tracking-tight text-foreground';

/** Page subtitle under H1 */
export const APP_PAGE_SUBTITLE_CLASS = 'text-sm text-muted-foreground';

/** Sticky property header — property name */
export const APP_PROPERTY_TITLE_CLASS =
  'text-lg font-semibold text-foreground truncate';

/** Section / card heading inside a page */
export const APP_SECTION_TITLE_CLASS = 'text-lg font-semibold text-foreground';

/** Primary label on a list/card row (checkpoint name, document name, etc.) */
export const APP_LIST_ITEM_TITLE_CLASS =
  'text-sm sm:text-base font-semibold leading-snug text-foreground';

/** In-page subsection heading (below tab header, above a list) */
export const APP_SUBSECTION_TITLE_CLASS =
  'text-base sm:text-lg font-semibold text-foreground';

/** Primary nav tabs (property shell, timeline sub-tabs) */
export const APP_NAV_TAB_CLASS = 'text-sm font-medium';

/** Sheet / dialog section title */
export const APP_SHEET_TITLE_CLASS = 'text-lg font-semibold';

/** Dialog title (matches shadcn DialogTitle) */
export const APP_DIALOG_TITLE_CLASS =
  'text-lg font-semibold leading-none tracking-tight';

/** Caption, chart labels, and other secondary microcopy */
export const APP_CAPTION_CLASS = 'text-xs text-muted-foreground';

/** Screen-reader-only page title inside the property shell (visible header already names the property). */
export const APP_SR_ONLY_PAGE_TITLE_CLASS = 'sr-only';
