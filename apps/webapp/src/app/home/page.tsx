
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { collection, onSnapshot, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property, Document as DocumentType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AddPropertyCard } from '@/components/properties/add-property-card';
import { PropertyCard } from '@/components/properties/property-card';
import { SessionProvider } from '@/contexts/session-context';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

function PropertiesDashboardSkeleton() {
  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Skeleton className="h-56 w-full rounded-lg bg-primary/20" />
          <Skeleton className="h-56 w-full rounded-lg bg-primary/20" />
          <Skeleton className="h-56 w-full rounded-lg bg-primary/20" />
        </div>
      </div>
    </div>
  )
}

function PropertiesDashboardContent() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [properties, setProperties] = useState<Property[]>([]);
    const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProperties = useMemo(() => {
        if (!searchTerm.trim()) {
            return properties;
        }
        const normalizedTerm = searchTerm.trim().toLowerCase();
        return properties.filter(
            (property) =>
                property.name?.toLowerCase().includes(normalizedTerm) ||
                property.address?.toLowerCase().includes(normalizedTerm) ||
                property.cityStateZip?.toLowerCase().includes(normalizedTerm)
        );
    }, [properties, searchTerm]);

    useEffect(() => {
        if (!user) {
        setProperties([]);
        setIsPropertiesLoading(false);
        return;
        }

        setIsPropertiesLoading(true);

        const propertiesRef = collection(db, 'users', user.uid, 'properties');
        const q = query(propertiesRef, where('userId', '==', user.uid));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const props: Property[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
            
            // For each property, fetch its documents and other counts
            const propertiesWithDetails = await Promise.all(props.map(async (prop) => {
                const docsRef = collection(db, 'users', user.uid, 'docs');
                const docsQuery = query(docsRef, where('propertyId', '==', prop.id));
                const docsSnapshot = await getDocs(docsQuery);
                const documents = docsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentType));
                
                // Fetch services and checks counts from the property document itself
                const propDocRef = doc(db, 'users', user.uid, 'properties', prop.id);
                const propDocSnap = await getDoc(propDocRef);
                const propData = propDocSnap.data();
                
                return {
                    ...prop,
                    documents,
                    docIds: documents.map(d => d.id),
                    docGsURIs: documents.map(d => d.gsURI).filter((uri): uri is string => !!uri),
                    servicesCount: propData?.servicesCount || 0,
                    checksCount: propData?.checksCount || 0,
                };
            }));
            
            setProperties(propertiesWithDetails.sort((a, b) => a.address.localeCompare(b.address)));
            setIsPropertiesLoading(false);
        }, (error) => {
            console.error("Error fetching properties:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not fetch properties.",
            });
            setIsPropertiesLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);


    if (authLoading || isPropertiesLoading) {
        return <PropertiesDashboardSkeleton />;
    }
    
    return (
        <div className="p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Property AI Agent</h1>
                <p className="text-muted-foreground">Upload property documents and chat with AI to get insights or diagnostics of your properties and assests</p>
            </header>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search properties..."
                        className="pl-10 pr-10"
                        aria-label="Search properties by name or address"
                    />
                    {searchTerm.length > 0 && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AddPropertyCard />
            {filteredProperties.length === 0 ? (
                <div className="col-span-full py-8 text-center text-muted-foreground">
                    {searchTerm.trim() ? 'No properties match your search.' : 'No properties found.'}
                </div>
            ) : (
                filteredProperties.map(prop => (
                    <PropertyCard key={prop.id} property={prop} />
                ))
            )}
            </div>
        </div>
        </div>
    );
}


export default function PropertiesDashboardPage() {
    return (
        <SessionProvider>
            <PropertiesDashboardContent />
        </SessionProvider>
    )
}
