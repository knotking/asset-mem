
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Star, Wrench, Zap, Phone, Mail, User } from 'lucide-react';
import { useProperty } from '@/contexts/property-context';
import type { Provider } from '@/lib/types';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const placeholderProvidersData: Omit<Provider, 'addedDate' | 'createdAt'>[] = [
  {
    id: '1',
    propertyId: 'placeholder',
    userId: 'placeholder',
    name: 'Pipeline Plumbers',
    category: 'plumber',
    status: 'active',
    rating: 4.8,
    phone: '(555) 123-4567',
    email: 'contact@pipelineplumbers.com',
    specialties: ['Leak detection', 'Drain cleaning', 'Water heaters'],
  },
  {
    id: '2',
    propertyId: 'placeholder',
    userId: 'placeholder',
    name: 'Sparky Electric Co.',
    category: 'electrician',
    status: 'active',
    rating: 4.9,
    phone: '(555) 987-6543',
    email: 'service@sparkyelectric.com',
    specialties: ['Panel upgrades', 'Wiring', 'Lighting installation'],
  },
];

const categoryIcons = {
    plumber: <Wrench className="h-5 w-5 text-muted-foreground" />,
    electrician: <Zap className="h-5 w-5 text-muted-foreground" />,
    default: <User className="h-5 w-5 text-muted-foreground" />
}


function ProviderCard({ provider }: { provider: Provider }) {
    const statusVariant = {
        active: 'bg-green-100 text-green-800 border-green-200',
        inactive: 'bg-red-100 text-red-800 border-red-200',
    };
    
    const categoryVariant = 'bg-blue-100 text-blue-800 border-blue-200';
    const Icon = categoryIcons[provider.category as keyof typeof categoryIcons] || categoryIcons.default;


    return (
        <Card>
            <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                {Icon}
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg text-foreground">{provider.name}</h3>
                            </div>
                        </div>
                         <div className="flex items-center gap-2">
                             <Badge variant="outline" className={categoryVariant}>{provider.category}</Badge>
                             <Badge variant="outline" className={statusVariant[provider.status]}>{provider.status}</Badge>
                         </div>
                    </div>
                     <div className="flex items-center gap-1 text-sm text-yellow-500">
                        {[...Array(Math.floor(provider.rating))].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                        {provider.rating % 1 !== 0 && <Star className="h-4 w-4 fill-current opacity-50" />}
                        {[...Array(5 - Math.ceil(provider.rating))].map((_, i) => <Star key={`empty-${i}`} className="h-4 w-4" />)}
                        <span className="text-muted-foreground ml-1">({provider.rating})</span>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{provider.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{provider.email}</span>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Specialties:</h4>
                    <div className="flex flex-wrap gap-2">
                        {provider.specialties.map(specialty => (
                            <Badge key={specialty} variant="secondary">{specialty}</Badge>
                        ))}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/50 px-6 py-3 flex justify-between items-center">
                 <p className="text-xs text-muted-foreground">
                    Added: {provider.addedDate ? format(provider.addedDate, 'M/d/yyyy') : '...'}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">Contact</Button>
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="secondary" size="sm">View Details</Button>
                </div>
            </CardFooter>
        </Card>
    );
}

function ProvidersPageSkeleton() {
    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            <header className="mb-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-10 w-36" />
                </div>
            </header>
            <div className="mb-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-[180px]" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
            </div>
        </div>
    )
}

function PropertyProvidersContent() {
    const { property } = useProperty();
    const [providers, setProviders] = useState<Provider[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        setProviders(placeholderProvidersData.map(p => ({
            ...p,
            addedDate: new Date('2024-01-20T00:00:00Z'),
            createdAt: new Date('2024-01-20T00:00:00Z')
        })));
    }, []);

    const filteredProviders = providers.filter(provider => {
        const matchesSearch = provider.name.toLowerCase().includes(searchTerm.toLowerCase()) || provider.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = categoryFilter === 'all' || provider.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || provider.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    if (!isClient) {
        return <ProvidersPageSkeleton />;
    }

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            <header className="mb-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Service Providers</h1>
                        <p className="text-muted-foreground">Manage contractors, inspectors, and service providers for {property?.name || 'this property'}.</p>
                    </div>
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Provider
                    </Button>
                </div>
            </header>

            <div className="mb-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search providers or specialties..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="plumber">Plumber</SelectItem>
                        <SelectItem value="electrician">Electrician</SelectItem>
                        <SelectItem value="hvac">HVAC</SelectItem>
                        <SelectItem value="landscaping">Landscaping</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4">
                {filteredProviders.length > 0 ? (
                    filteredProviders.map(provider => <ProviderCard key={provider.id} provider={provider} />)
                ) : (
                    <div className="text-center py-20 px-6 border-2 border-dashed rounded-lg">
                         <div className="flex flex-col items-center gap-4">
                            <div className="p-3 bg-muted rounded-full">
                                <Search className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground">No providers found for the current filters.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PropertyProvidersPage() {
    return <PropertyProvidersContent />;
}
