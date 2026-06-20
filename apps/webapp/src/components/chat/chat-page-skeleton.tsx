
import { Skeleton } from "@/components/ui/skeleton";

const ChatMessageSkeleton = ({ isUser = false }: { isUser?: boolean }) => {
  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && <Skeleton className="h-8 w-8 rounded-lg bg-primary/20" />}

      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <Skeleton className="h-12 w-48 rounded-lg bg-primary/20" />
        <Skeleton className="h-8 w-32 rounded-lg bg-primary/20" />
      </div>
      {isUser && <Skeleton className="h-8 w-8 rounded-lg bg-primary/20" />}
    </div>
  );
};

/** Loading placeholder for the chat message list + composer (fits property shell, not full viewport). */
export function ChatPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <main className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
        <div className="space-y-6">
          <ChatMessageSkeleton isUser />
          <ChatMessageSkeleton />
          <ChatMessageSkeleton isUser />
          <ChatMessageSkeleton />
        </div>
      </main>
      <footer className="shrink-0 border-t bg-card px-3 py-2 sm:px-4 sm:py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Skeleton className="mb-2 h-9 w-full max-w-xs rounded-full md:hidden" />
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Skeleton className="size-11 shrink-0 rounded-md bg-primary/20 md:hidden" />
          <Skeleton className="hidden size-11 shrink-0 rounded-full bg-primary/20 md:block md:size-10" />
          <Skeleton className="h-10 w-full rounded-lg bg-primary/20" />
          <Skeleton className="size-11 shrink-0 rounded-full bg-primary/80 md:size-10" />
        </div>
      </footer>
    </div>
  );
}
