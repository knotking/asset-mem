
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { Sparkles, UserCircle, Building } from "lucide-react";

type Props = {
  message: Message;
  context?: 'property' | 'document' | null;
};

export function ChatAvatar({ message, context }: Props) {
  const isUser = message.role === "user";
  const isPropertyAgent = !isUser && context === 'property';

  const icon = () => {
    if (isUser) return <UserCircle className="h-5 w-5 text-secondary-foreground" />;
    if (isPropertyAgent) return <Building className="h-5 w-5 text-accent-foreground" />;
    return <Sparkles className="h-5 w-5 text-accent-foreground" />;
  }

  return (
    <Avatar className={cn("h-8 w-8", { "bg-secondary text-secondary-foreground": isUser, "bg-accent text-accent-foreground": !isUser })}>
      <AvatarFallback className={cn({ "bg-secondary": isUser, "bg-accent": !isUser })}>
        {icon()}
      </AvatarFallback>
    </Avatar>
  );
}
