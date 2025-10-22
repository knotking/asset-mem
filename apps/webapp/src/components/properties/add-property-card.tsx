
'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/hooks/use-toast";

export function AddPropertyCard() {
    const router = useRouter();
    const { globalDraft } = useSession();
    const { toast } = useToast();

    const handleClick = () => {
        // This flow is for creating a brand new property, which is not fully implemented.
        // For now, it opens the upload dialog in a "new property" context.
        router.push(`/home/properties/new-property/details`);
    };

    return (
        <button onClick={handleClick} className="w-full h-full text-left">
            <Card className="h-full group hover:border-foreground/20 transition-colors border-dashed border-2 flex flex-col">
                <CardContent className="p-4 flex-1 flex flex-col items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 bg-muted rounded-full shrink-0 group-hover:bg-muted-foreground/10 transition-colors">
                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-medium text-foreground">Add New Property</h3>
                        <p className="text-sm text-muted-foreground max-w-40">Upload documents for a new property</p>
                    </div>
                </CardContent>
            </Card>
        </button>
    );
}
