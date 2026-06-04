'use client';

import Link from 'next/link';
import { FileText, Scale } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function LegalSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal</CardTitle>
        <CardDescription>Privacy policy and terms of service</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/privacy">
            <FileText className="h-4 w-4" />
            Privacy Policy
          </Link>
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/terms">
            <Scale className="h-4 w-4" />
            Terms of Service
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
