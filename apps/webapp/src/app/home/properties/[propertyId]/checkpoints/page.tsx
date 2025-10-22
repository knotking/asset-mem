
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, AlertTriangle, Calendar, MapPin, Camera } from 'lucide-react';
import type { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

const placeholderCheckpointsData: Omit<Checkpoint, 'createdAt'>[] = [
  {
    id: '1',
    propertyId: 'placeholder',
    userId: 'placeholder',
    title: 'Property Walkthrough',
    description: 'Initial inspection of suburban home',
    location: 'Overall',
    condition: 'fair',
    tags: ['inspection', 'baseline'],
    media: [
        {
            id: 'media1',
            url: 'https://images.unsplash.com/photo-1570905810373-a8ae44f954cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdWJ1cmJhbiUyMGhvdXNlJTIwZXh0ZXJpb3J8ZW58MXx8fHwxNzU3ODkwMDQ4fDA&ixlib=rb-4.1.0&q=80&w=1080',
            type: 'image',
            caption: 'Older home needs some attention. Foundation appears solid.'
        }
    ]
  },
];

function CheckpointCard({ checkpoint }: { checkpoint: Checkpoint }) {
    const conditionVariant = {
        good: 'bg-green-100 text-green-800 border-green-200',
        fair: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        poor: 'bg-red-100 text-red-800 border-red-200',
        needs_attention: 'bg-orange-100 text-orange-800 border-orange-200',
    };

    return (
        <Card>
            <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-foreground">{checkpoint.title}</h3>
                            <p className="text-sm text-muted-foreground">{checkpoint.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" />
                                    <span>{checkpoint.createdAt ? format(checkpoint.createdAt, 'MMM dd, yyyy, hh:mm a') : '...'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3" />
                                    <span>{checkpoint.location}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <Badge variant="outline" className={conditionVariant[checkpoint.condition]}>
                            {checkpoint.condition}
                        </Badge>
                        {checkpoint.tags.map(tag => (
                            <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                    </div>
                </div>

                {checkpoint.media.length > 0 && (
                    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                        <p className="text-sm font-medium flex items-center gap-2">
                            <Camera className="h-4 w-4" /> Media ({checkpoint.media.length})
                        </p>
                        <div className="space-y-4">
                            {checkpoint.media.map(mediaItem => (
                                <div key={mediaItem.id} className="space-y-2">
                                    <div className="relative aspect-[4/3] w-full max-w-lg mx-auto overflow-hidden rounded-lg">
                                        <Image src={mediaItem.url} alt={mediaItem.caption || checkpoint.title} fill className="object-cover" data-ai-hint="house night" />
                                    </div>
                                    {mediaItem.caption && <p className="text-sm text-muted-foreground text-center px-4">{mediaItem.caption}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatItem({ value, label }: { value: number | string, label: string }) {
    return (
        <div className="flex-1 text-center px-4 py-6 bg-card border rounded-lg">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    );
}

function CheckpointsPageSkeleton() {
    return (
        <div className="h-full flex flex-col">
            <div className="p-6 md:p-8 flex-1">
                <div className="max-w-5xl mx-auto">
                    <header className="mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <Skeleton className="h-8 w-64 mb-2" />
                                <Skeleton className="h-4 w-96" />
                            </div>
                            <Skeleton className="h-10 w-40" />
                        </div>
                    </header>
                    <div className="mb-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row gap-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-[180px]" />
                        <Skeleton className="h-10 w-[180px]" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </div>
            <footer className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t">
                <div className="max-w-5xl mx-auto p-4 flex gap-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 flex-1" />)}
                </div>
            </footer>
        </div>
    )
}

function PropertyCheckpointsContent() {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('all');
    const [conditionFilter, setConditionFilter] = useState('all');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Add createdAt date on the client to avoid hydration mismatch
        setCheckpoints(placeholderCheckpointsData.map(c => ({
            ...c,
            createdAt: new Date('2024-01-20T05:30:00Z'),
        })));
    }, []);
    
    if (!isClient) {
        return <CheckpointsPageSkeleton />;
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 md:p-8 flex-1">
                <div className="max-w-5xl mx-auto">
                    <header className="mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Property Timeline</h1>
                                <p className="text-muted-foreground">Visual history of property condition with photos and documentation</p>
                            </div>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Checkpoint
                            </Button>
                        </div>
                    </header>

                    <div className="mb-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search checkpoints..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Locations</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select value={conditionFilter} onValueChange={setConditionFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="All Conditions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Conditions</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="fair">Fair</SelectItem>
                                <SelectItem value="poor">Poor</SelectItem>
                                <SelectItem value="needs_attention">Needs Attention</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                     <div className="space-y-6">
                        {checkpoints.length > 0 ? (
                            checkpoints.map(checkpoint => <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />)
                        ) : (
                             <div className="text-center py-20 px-6 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">No checkpoints recorded for this property yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t">
                <div className="max-w-5xl mx-auto p-4 flex gap-4">
                    <StatItem value={1} label="Total" />
                    <StatItem value={1} label="Photos" />
                    <StatItem value={1} label="Locations" />
                    <StatItem value={0} label="Good+" />
                    <StatItem value={0} label="Needs Attention" />
                </div>
            </footer>
        </div>
    );
}

export default function PropertyCheckpointsPage() {
    return <PropertyCheckpointsContent />;
}
