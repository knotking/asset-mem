
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPageSkeleton as ChatPageSkeletonNew } from "@/components/chat/chat-page-skeleton";

const ChatMessageSkeleton = ({ isUser = false }: { isUser?: boolean }) => {
  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && <Skeleton className="h-8 w-8 rounded-lg bg-primary/20" />}
      
      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <Skeleton className={`h-12 w-48 rounded-lg ${isUser ? "bg-primary/20" : "bg-primary/20"}`} />
        <Skeleton className={`h-8 w-32 rounded-lg ${isUser ? "bg-primary/20" : "bg-primary/20"}`} />
      </div>
      {isUser && <Skeleton className="h-8 w-8 rounded-lg bg-primary/20" />}
    </div>
  );
};

export function ChatPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col h-screen">
      <main className="flex-1 overflow-hidden p-4 sm:p-6">
        <div className="space-y-6">
          <ChatMessageSkeleton isUser />
          <ChatMessageSkeleton />
          <ChatMessageSkeleton isUser />
          <ChatMessageSkeleton />
        </div>
      </main>
      <footer className="p-4 bg-card border-t">
        <div className="relative flex w-full items-end gap-2 rounded-lg border bg-background pr-2 h-[52px]">
           <Skeleton className="flex-1 h-8 bg-primary/20 ml-3" />
           <Skeleton className="h-8 w-8 rounded-full bg-primary/20" />
           <Skeleton className="h-8 w-8 rounded-full bg-primary/80" />
        </div>
      </footer>
    </div>
  );
}
