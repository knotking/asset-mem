'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Camera, Calendar, MapPin, AlertTriangle, CheckCircle, Loader2, AlertCircle as AlertCircleIcon, Info, Play, X } from 'lucide-react';
import type { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { usePropertyCheckpointMetrics } from '@/hooks/usePropertyCheckpointMetrics';
import { CreateCheckpointDialog } from '@/components/properties/create-checkpoint-dialog';
import { CheckpointDetailModal } from '@/components/properties/checkpoint-detail-modal';
import { CheckpointComparisonModal } from '@/components/properties/checkpoint-comparison-modal';
import { CheckpointIssuesModal } from '@/components/properties/checkpoint-issues-modal';

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
                    
                    {/* Insights Card Skeleton */}
                    <Card className="mb-6">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                            <Skeleton className="h-3 w-48 mb-4" />
                            <div className="flex justify-between mb-4">
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-7 w-20" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-4 w-36" />
                                </div>
                            </div>
                            <Skeleton className="h-16 w-full" />
                        </CardContent>
                    </Card>
                    
                    {/* List Skeleton */}
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <Card key={idx}>
                                <CardContent className="p-4">
                                    <div className="flex gap-4">
                                        <Skeleton className="h-24 w-24 rounded-md" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-28" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PropertyInsightsCard({ onOpenIssues }: { onOpenIssues: () => void }) {
    const { metrics, loading } = usePropertyCheckpointMetrics();
    const [showHelp, setShowHelp] = useState(false);

    if (loading || !metrics) {
        return (
            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-3 w-48 mb-4" />
                    <div className="flex justify-between mb-4">
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-7 w-20" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-4 w-36" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const latest = metrics.overall?.latest_score;
    const issues = metrics.issues?.total_by_severity;
    const rate = metrics.deterioration?.rate_points_per_day;
    const trend = metrics.deterioration?.trend;
    const considered = metrics.window?.checkpoints_considered;

    const latestDisplay =
        typeof latest === 'number' && Number.isFinite(latest)
            ? Math.max(0, Math.min(100, latest))
            : null;
    const latestLabel =
        latestDisplay === null
            ? '—'
            : latestDisplay >= 80
                ? 'Good'
                : latestDisplay >= 60
                    ? 'Fair'
                    : latestDisplay >= 40
                        ? 'Needs attention'
                        : 'Poor';

    const trendLabel =
        trend === 'improving'
            ? 'Improving'
            : trend === 'stable'
                ? 'Stable'
                : trend === 'deteriorating'
                    ? 'Worsening'
                    : 'Unknown';
    const rateAbs = typeof rate === 'number' && Number.isFinite(rate) ? Math.abs(rate) : null;
    const rateDisplay =
        rateAbs === null
            ? typeof considered === 'number' && considered >= 2
                ? 'Need 2+ scored checkpoints'
                : '—'
            : `${rateAbs.toFixed(1)} pts/day`;
    const rateSecondary = rateAbs === null ? '' : `≈ ${(rateAbs * 7).toFixed(0)} pts/week`;

    return (
        <Card className="mb-6">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Property Insights</CardTitle>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowHelp(!showHelp)}
                    >
                        <Info className="h-4 w-4 mr-2" />
                        {showHelp ? 'Hide' : 'What is this?'}
                    </Button>
                </div>
                {typeof considered === 'number' && considered > 0 && (
                    <CardDescription>
                        Based on the last {considered} checkpoint{considered === 1 ? '' : 's'}.
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Overall condition</p>
                        <p className="text-2xl font-bold">
                            {latestDisplay === null ? '—' : `${Math.round(latestDisplay)}/100`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {latestDisplay === null ? 'No score yet' : latestLabel}
                        </p>
                        {latestDisplay !== null && (
                            <div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-muted">
                                <div className="h-full bg-primary" style={{ width: `${latestDisplay}%` }} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-sm text-muted-foreground">Change rate</p>
                        <p className="text-lg font-medium">
                            {rateDisplay} {trendLabel !== 'Unknown' ? `(${trendLabel})` : ''}
                        </p>
                        {!!rateSecondary && (
                            <p className="text-sm text-muted-foreground">{rateSecondary}</p>
                        )}
                    </div>
                </div>

                {issues && (
                    <button onClick={onOpenIssues} className="w-full text-left">
                        <p className="text-sm text-muted-foreground mb-1">Issues found</p>
                        <div className="flex justify-between items-center">
                            <p className="text-sm">
                                Critical {issues.critical} · Major {issues.major} · Moderate {issues.moderate} · Minor {issues.minor}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Click to see which issues were counted.
                        </p>
                    </button>
                )}

                {showHelp && (
                    <Card className="bg-muted">
                        <CardContent className="p-4 space-y-2">
                            <p className="font-semibold text-sm">How to read this</p>
                            <div className="space-y-1 text-xs text-muted-foreground">
                                <p>• Overall condition is a 0–100 score estimated by AI from your recent checkpoint photos.</p>
                                <p>• Change rate is how fast the score is moving over time (points/day). "Worsening" means the score is trending down.</p>
                                <p>• Issues are grouped by severity (minor → critical) based on AI classification.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}

interface CheckpointCardProps {
    checkpoint: Checkpoint;
    onClick: () => void;
    selectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

function CheckpointCard({ checkpoint, onClick, selectionMode, isSelected, onToggleSelect }: CheckpointCardProps) {
    const media0 = checkpoint.media?.[0];
    const thumbnail = checkpoint.media?.[0]?.thumbnailUrl || checkpoint.media?.[0]?.url;
    const isVideo = !!media0?.contentType?.startsWith('video/');
    const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();
    const hasIssues = (checkpoint.aiAnalysis?.issues?.length || 0) > 0;

    return (
        <Card 
            className={`cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
        >
            <CardContent className="p-4">
                <div className="flex gap-4">
                    {/* Selection checkbox */}
                    {selectionMode && (
                        <div className="flex items-start pt-1">
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={onToggleSelect}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    {/* Thumbnail */}
                    <div 
                        className="h-24 w-24 bg-muted rounded-md overflow-hidden flex-shrink-0 relative"
                        onClick={selectionMode ? onToggleSelect : onClick}
                    >
                        {thumbnail ? (
                            <>
                                <Image 
                                    src={thumbnail} 
                                    alt={checkpoint.name || 'Checkpoint'} 
                                    fill
                                    className="object-cover"
                                />
                                {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="rounded-full bg-black/50 p-2">
                                            <Play className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center">
                                <Camera className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0" onClick={selectionMode ? onToggleSelect : onClick}>
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="font-semibold truncate">{checkpoint.name || 'Untitled Checkpoint'}</h3>
                            <div className="flex gap-1 flex-shrink-0 ml-2">
                                {checkpoint.analysisStatus === 'processing' && (
                                    <Badge variant="secondary" className="text-xs">
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Analyzing
                                    </Badge>
                                )}
                                {checkpoint.analysisStatus === 'failed' && (
                                    <Badge variant="destructive" className="text-xs">
                                        <AlertCircleIcon className="h-3 w-3 mr-1" />
                                        Failed
                                    </Badge>
                                )}
                                {checkpoint.analysisStatus === 'completed' && hasIssues && (
                                    <Badge variant="destructive" className="text-xs">
                                        Issue Detected
                                    </Badge>
                                )}
                            </div>
                        </div>
                        
                        {checkpoint.location && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                                <MapPin className="h-3 w-3" />
                                <span>{checkpoint.location}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{format(date, 'MMM d, yyyy')}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function PropertyCheckpointsPage() {
    const { checkpoints, loading, hasMoreCheckpoints, loadMoreCheckpoints, isLoadingEarlier, deleteCheckpoint } = useCheckpoint();
    const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
    const [isIssuesModalVisible, setIsIssuesModalVisible] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    
    // Selection mode state
    const [activeTab, setActiveTab] = useState<'insights' | 'select'>('insights');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleClearSelection = () => {
        setSelectedIds([]);
    };

    const handleCompare = () => {
        if (selectedIds.length === 2) {
            setIsComparisonModalOpen(true);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        
        if (confirm(`Delete ${selectedIds.length} checkpoint${selectedIds.length !== 1 ? 's' : ''}? This action cannot be undone.`)) {
            try {
                await Promise.all(selectedIds.map(id => deleteCheckpoint(id)));
                setSelectedIds([]);
            } catch (error) {
                console.error('Failed to delete checkpoints:', error);
            }
        }
    };

    if (loading) {
        return <CheckpointsPageSkeleton />;
    }

    // Empty state
    if (checkpoints.length === 0) {
        return (
            <div className="h-full flex flex-col p-6 md:p-8">
                <div className="max-w-5xl mx-auto w-full">
                    <header className="mb-8">
                        <h1 className="text-2xl font-bold">Property Timeline</h1>
                        <p className="text-muted-foreground">Visual history of property condition with photos and documentation</p>
                    </header>

                    <Card className="mb-6 border-dashed">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold">Property Insights</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                                Once you create checkpoints, you'll see AI-powered insights here including:
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                                    <p className="text-sm text-muted-foreground">
                                        Overall condition score (0–100) based on your checkpoint photos
                                    </p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                                    <p className="text-sm text-muted-foreground">
                                        Change rate tracking to see if your property is improving or deteriorating
                                    </p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                                    <p className="text-sm text-muted-foreground">
                                        Issue detection grouped by severity (critical, major, moderate, minor)
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="text-center">
                        <CardContent className="p-12">
                            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                                <Camera className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No Checkpoints Yet</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Create your first checkpoint to start tracking changes over time.
                            </p>
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Checkpoint
                            </Button>
                        </CardContent>
                    </Card>

                    <CreateCheckpointDialog
                        open={isCreateDialogOpen}
                        onOpenChange={setIsCreateDialogOpen}
                    />
                </div>
            </div>
        );
    }

    const selectedCheckpoints = checkpoints.filter(c => selectedIds.includes(c.id));

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 md:p-8 flex-1 overflow-auto">
                <div className="max-w-5xl mx-auto">
                    <header className="mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold">Property Timeline</h1>
                                <p className="text-muted-foreground">Visual history of property condition with photos and documentation</p>
                            </div>
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Checkpoint
                            </Button>
                        </div>
                    </header>

                    <Tabs value={activeTab} onValueChange={(v) => {
                        setActiveTab(v as 'insights' | 'select');
                        if (v === 'insights') {
                            setSelectedIds([]);
                        }
                    }} className="mb-6">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="insights">Insights</TabsTrigger>
                            <TabsTrigger value="select">Select Checkpoints</TabsTrigger>
                        </TabsList>

                        <TabsContent value="insights" className="mt-6">
                            <PropertyInsightsCard onOpenIssues={() => setIsIssuesModalVisible(true)} />
                        </TabsContent>

                        <TabsContent value="select" className="mt-6">
                            {selectedIds.length > 0 && (
                                <Card className="mb-6">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="font-medium">
                                                {selectedIds.length} checkpoint{selectedIds.length !== 1 ? 's' : ''} selected
                                            </p>
                                            <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                                                Clear
                                            </Button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleCompare}
                                                disabled={selectedIds.length !== 2}
                                                className="flex-1"
                                            >
                                                Compare (2)
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={handleDeleteSelected}
                                                disabled={selectedIds.length === 0}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>

                    <div className="space-y-4">
                        {checkpoints.map(checkpoint => (
                            <CheckpointCard 
                                key={checkpoint.id} 
                                checkpoint={checkpoint}
                                onClick={() => activeTab === 'insights' && setSelectedCheckpoint(checkpoint)}
                                selectionMode={activeTab === 'select'}
                                isSelected={selectedIds.includes(checkpoint.id)}
                                onToggleSelect={() => handleToggleSelect(checkpoint.id)}
                            />
                        ))}
                    </div>

                    {hasMoreCheckpoints && (
                        <div className="mt-6 text-center">
                            <Button 
                                variant="outline" 
                                onClick={loadMoreCheckpoints}
                                disabled={isLoadingEarlier}
                            >
                                {isLoadingEarlier ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Load More Checkpoints'
                                )}
                            </Button>
                        </div>
                    )}

                    {checkpoints.length > 20 && !hasMoreCheckpoints && (
                        <p className="text-center text-sm text-muted-foreground mt-6">
                            No more checkpoints to load
                        </p>
                    )}

                    <CreateCheckpointDialog
                        open={isCreateDialogOpen}
                        onOpenChange={setIsCreateDialogOpen}
                    />

                    <CheckpointDetailModal
                        checkpoint={selectedCheckpoint}
                        open={!!selectedCheckpoint}
                        onOpenChange={(open) => !open && setSelectedCheckpoint(null)}
                    />

                    <CheckpointComparisonModal
                        checkpoint1={selectedCheckpoints[0] || null}
                        checkpoint2={selectedCheckpoints[1] || null}
                        open={isComparisonModalOpen}
                        onOpenChange={setIsComparisonModalOpen}
                    />

                    <CheckpointIssuesModal
                        checkpoints={checkpoints}
                        open={isIssuesModalVisible}
                        onOpenChange={setIsIssuesModalVisible}
                    />
                </div>
            </div>
        </div>
    );
}
