'use client';

import { useState } from 'react';
import { InspectionCard } from './inspection-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Upload } from 'lucide-react';
import { Document } from '@/lib/types';

interface InspectionListProps {
  inspections: Document[];
  loading: boolean;
  onInspectionClick?: (inspection: Document) => void;
}

export function InspectionList({ inspections, loading, onInspectionClick }: InspectionListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch =
      !searchTerm ||
      inspection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.summary?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search inspection reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {filteredInspections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            {searchTerm ? 'No reports match your search' : 'No inspection reports found'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInspections.map((inspection) => (
            <InspectionCard
              key={inspection.id}
              inspection={inspection}
              onClick={onInspectionClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
