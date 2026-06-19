
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Clock, Calendar } from 'lucide-react';
import { useProperty } from '@/contexts/property-context';
import type { Service } from '@/lib/types';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { APP_PAGE_SUBTITLE_CLASS, APP_PAGE_TITLE_CLASS } from '@/lib/app-typography';

const placeholderServicesData: Omit<Service, 'scheduledDate' | 'createdAt'>[] = [
  {
    id: '1',
    propertyId: 'placeholder',
    userId: 'placeholder',
    name: 'Roof Inspection',
    status: 'pending',
  },
];


function ServiceListItem({ service }: { service: Service }) {
    const statusVariant = {
        pending: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
        completed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        cancelled: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    };

    return (
        <Card className="min-w-0 transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="min-w-0 break-words font-semibold text-foreground">{service.name}</p>
                    </div>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <p>{service.scheduledDate ? format(service.scheduledDate, 'M/dd/yyyy') : '...'}</p>
                    </div>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
                    <Badge variant="outline" className={cn('w-fit', statusVariant[service.status])}>
                        {service.status}
                    </Badge>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">View Details</Button>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">Reschedule</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ServicesPageSkeleton() {
    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            <header className="mb-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-10 w-44" />
                </div>
            </header>
            <div className="mb-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-[180px]" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    )
}

function PropertyServicesContent() {
    const { property } = useProperty();
    const [services, setServices] = useState<Service[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Add dates on the client to avoid hydration mismatch
        setServices(placeholderServicesData.map(s => ({
            ...s,
            scheduledDate: new Date('2024-10-02T00:00:00Z'),
            createdAt: new Date('2024-08-15T00:00:00Z')
        })));
    }, []);

    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || service.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (!isClient) {
        return <ServicesPageSkeleton />;
    }

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            <header className="mb-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className={APP_PAGE_TITLE_CLASS}>Property Services</h1>
                        <p className={APP_PAGE_SUBTITLE_CLASS}>Manage maintenance and services for {property?.name || 'this property'}.</p>
                    </div>
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Service
                    </Button>
                </div>
            </header>

            <div className="mb-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search services..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4">
                {filteredServices.length > 0 ? (
                    filteredServices.map(service => <ServiceListItem key={service.id} service={service} />)
                ) : (
                    <div className="text-center py-12 px-6 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No services found for the current filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PropertyServicesPage() {
    return <PropertyServicesContent />;
}
