import { notFound, redirect } from 'next/navigation';

const RESERVED_SHARE_SEGMENTS = new Set(['chat', 'report']);

type LegacySharedChatRedirectProps = {
  params: Promise<{ shareId: string }>;
};

/** Permanent redirect for chat links created before /share/chat/[shareId]. */
export default async function LegacySharedChatRedirect({
  params,
}: LegacySharedChatRedirectProps) {
  const { shareId } = await params;
  if (!shareId || RESERVED_SHARE_SEGMENTS.has(shareId)) {
    notFound();
  }
  redirect(`/share/chat/${shareId}`);
}
