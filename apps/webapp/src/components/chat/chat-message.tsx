

import { cn } from "@/lib/utils";
import type { Message, ServiceProvider, StructuredResponseData, Product } from "@/lib/types";
import { ChatAvatar } from "./chat-avatar";
import Image from "next/image";
import { File, Map, Building, Home, ShieldCheck, ReceiptText, Search, FileKey, FileText, Lightbulb, Copy, Star, Users, Phone, Mail, CheckCircle, Info, Wrench, Youtube, ExternalLink, Stethoscope, TrendingUp, ShoppingCart, DollarSign, Sparkles } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { markdownToWhatsapp, htmlToWhatsapp } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "../ui/badge";

// Helper function to safely extract string from warranty/insurance info
const extractTextFromCoverageInfo = (info: any): string => {
    if (!info) return '';
    
    // If it's already a string, return it
    if (typeof info === 'string') {
        return info;
    }
    
    // If it's an object, try to extract meaningful text
    if (typeof info === 'object' && info !== null) {
        // Check for common text properties
        if (info.text) return String(info.text);
        if (info.content) return String(info.content);
        if (info.message) return String(info.message);
        if (info.description) return String(info.description);
        if (info.summary) return String(info.summary);
        
        // If it's an array, join the items
        if (Array.isArray(info)) {
            return info.map(item => 
                typeof item === 'string' ? item : JSON.stringify(item)
            ).join('\n');
        }
        
        // Otherwise, format as JSON for readability
        try {
            return JSON.stringify(info, null, 2);
        } catch {
            return String(info);
        }
    }
    
    // Fallback to string conversion
    return String(info);
};

const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: ReceiptText,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileText,
};

const ServiceProviderCard = ({ provider }: { provider: ServiceProvider }) => {
  
 
    const linkStr = typeof provider.link === 'string' ? provider.link : undefined;
    const websiteStr = typeof provider.website === 'string' ? provider.website : undefined;

    const normalizeUrl = (u?: string): string | undefined => {
        if (!u || typeof u !== 'string') return undefined;
        const trimmed = u.trim();
        if (trimmed === '') return undefined;
        const withProto = (/^https?:\/\//i.test(trimmed)) ? trimmed : `https://${trimmed}`;
        try {
            const url = new URL(withProto);
            return url.toString();
        } catch {
            return undefined;
        }
    };

    const primaryLink = normalizeUrl(linkStr) || normalizeUrl(websiteStr) || undefined;
    const primaryLinkLabel = 'Website';

    const isPrimaryLinkValid = typeof primaryLink === 'string' && /^https?:\/\//i.test(primaryLink);
    const isDirectionsLinkValid = typeof provider.directions === 'string' && (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

    // Helper function to check if a value is meaningful (not empty, null, undefined, or "N/A")
    const hasValue = (val: any): boolean => {
        if (!val) return false;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            return trimmed !== '' && 
                   trimmed.toLowerCase() !== 'n/a' && 
                   trimmed.toLowerCase() !== 'not available' &&
                   trimmed.toLowerCase() !== 'none' &&
                   trimmed.toLowerCase() !== 'null';
        }
        return true;
    };

    // Extract rating number if available
    const ratingValue = provider.ratings && typeof provider.ratings === 'string' 
        ? provider.ratings.split('/')[0].trim() 
        : null;
    const hasRating = hasValue(ratingValue) && ratingValue !== 'N/A' && ratingValue !== '0';
    const hasReviews = hasValue(provider.reviews);
    const hasContact = hasValue(provider.contact_info);
    const hasLocation = hasValue(provider.location);
    const hasAdditionalInfo = hasValue(provider.additional_information) && 
                               provider.additional_information?.toLowerCase() !== 'no additional information available.';
    const hasSpecialties = hasValue(provider.specialties);

    // Show card if provider has a name - we'll only display fields that have data
    // This ensures we show all providers that come from the agent, and let the UI handle empty fields gracefully
    if (!provider.name) {
        return null;
    }

    return (
    <Card className="flex flex-col h-full w-full">
        <CardHeader>
            <CardTitle className="text-base flex justify-between items-start">
            <span className="line-clamp-2">{provider.name}</span>
                {provider.authorized === "True" && (
                    <Badge variant="outline" className="flex items-center gap-1 bg-blue-100 text-blue-800 border-blue-200 shrink-0">
                        <CheckCircle className="h-3 w-3" />
                          Authorized
                    </Badge>
                )}
            </CardTitle>
            {(hasRating || hasReviews) && (
                <CardDescription className="flex items-center gap-2 pt-1">
                    {hasRating && (
                        <div className="flex items-center gap-1 text-sm text-yellow-500">
                            <Star className="h-4 w-4 fill-current" />
                            <span>{ratingValue}</span>
                        </div>
                    )}
                    {hasReviews && (
                        <span className="text-muted-foreground text-xs">
                            {provider.reviews && !provider.reviews.toLowerCase().includes('review') 
                                ? provider.reviews 
                                : `${provider.reviews} reviews`}
                        </span>
                    )}
                </CardDescription>
            )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3">
             {hasAdditionalInfo && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {provider.additional_information}
                </p>
             )}
            <div className="text-sm space-y-2">
                {hasContact && (
                    <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className='min-w-0'>{provider.contact_info}</span>
                    </div>
                )}
                {hasLocation && (
                    <div className="flex items-start gap-2 min-w-0">
                        <Map className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="line-clamp-1 min-w-0">{provider.location}</span>
                    </div>
                )}
            </div>
            {hasSpecialties && (
                <div className="space-y-1 pt-1 min-w-0">
                    <h4 className="text-xs font-semibold text-muted-foreground">Specialties</h4>
                    <p className="text-xs text-foreground break-words">{provider.specialties}</p>
                </div>
            )}
        </CardContent>
        {(isPrimaryLinkValid || isDirectionsLinkValid) && (
            <CardFooter className="flex gap-2 mt-auto pt-4">
                {isPrimaryLinkValid && primaryLink && <Button variant="outline" size="sm" asChild><a href={primaryLink} target="_blank" rel="noopener noreferrer">{primaryLinkLabel}</a></Button>}
                {isDirectionsLinkValid && provider.directions && <Button variant="default" size="sm" asChild><a href={provider.directions} target="_blank" rel="noopener noreferrer">Directions</a></Button>}
            </CardFooter>
        )}
    </Card>
)};

const ProductCard = ({ product }: { product: Product }) => {
    // Use new fields first, fallback to legacy fields
    const itemName = product.item_name || product.product_name || product.description || 'Product';
    const imageSrc = product.image_url || null;
    // store_url is the primary field, url is legacy fallback
    const productUrl = product.store_url || product.url || null;
    
    return (
        <Card className="flex flex-col h-full w-full">
        <CardHeader>
            <CardTitle className="text-base flex justify-between items-start">
                <span className="line-clamp-2">{itemName}</span>
            </CardTitle>
            {product.vendor && (
                <CardDescription className="flex items-center gap-2 pt-1">
                    <ShoppingCart className="h-4 w-4" />
                    <span>{product.vendor}</span>
                </CardDescription>
            )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3">
            {imageSrc && (
                <div className="relative w-full h-32 rounded-md overflow-hidden">
                    <Image
                        src={imageSrc}
                        alt={itemName}
                        fill
                        className="object-cover"
                    />
                </div>
            )}
            <div className="text-sm space-y-2">
                {(product.price || product.item_price) && (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">{product.price || product.item_price}</span>
                    </div>
                )}
                {product.reviews && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-xs">
                            {product.reviews}
                        </span>
                    </div>
                )}
                {product.rating && (
                    <div className="flex items-center gap-2 text-sm text-yellow-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span>{product.rating}</span>
                    </div>
                )}
            </div>
        </CardContent>
        <CardFooter className="flex gap-2 mt-auto pt-4">
            {productUrl && (
                <Button variant="outline" size="sm" asChild>
                    <a href={productUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Product
                    </a>
                </Button>
            )}
        </CardFooter>
    </Card>
    );
};

const getPreviewText = (value?: string, max = 240) => {
    if (!value) return undefined;
    const plain = value
        .replace(/[`*_>#]/g, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length <= max) return plain;
    return plain.slice(0, max).trim().replace(/[.,!?;:]?$/, '') + '…';
};

const StructuredResponse = ({ data }: { data: StructuredResponseData }) => {
    const analysis = data.analysis || {} as NonNullable<StructuredResponseData['analysis']>;
    // Support both nested (analysis.*) and flat structures (top-level keys)
    const triage = analysis?.triageResult || (data as any)?.triageResult;
    const checkpointSummary = analysis?.checkpointSummary;
    const coverage = analysis?.coverageResult || (data as any)?.coverageResult;
    const diy = analysis?.diyResults || (data as any)?.diyResults;
    const service = analysis?.serviceResults || (data as any)?.serviceResults || {};
    const cost = analysis?.costEstimationResults || (data as any)?.costEstimationResults;
    const rawTitle = (typeof analysis?.title === 'string' && analysis.title.trim())
        ? analysis.title.trim()
        : (typeof (data as any)?.title === 'string' && (data as any).title.trim() ? (data as any).title.trim() : undefined);

    // Normalize and validate provider objects coming from various agents/APIs
    const normalizeProvider = (p: any): ServiceProvider | null => {
        if (!p || typeof p !== 'object') return null;
        const nameCandidate = p.name || p.business_name || p.businessName || p.title || p.company || p.provider || p.store || '';
        const name = typeof nameCandidate === 'string' ? nameCandidate : String(nameCandidate || '');
        if (!name.trim()) return null;

        const website = p.website || p.url || p.link || undefined;
        const link = p.link || p.url || p.website || undefined;
        const directions = p.directions || p.directions_url || p.map_link || undefined;
        const contact_info = p.contact_info || p.phone || p.phoneNumber || p.contact || p.contactInfo || undefined;
        const location = p.location || p.address || p.address_line || undefined;
        const ratings = p.ratings || p.rating || undefined;
        const reviews = p.reviews || p.review_count || p.reviewCount || undefined;
        const specialties = p.specialties || p.services || undefined;
        const additional_information = p.additional_information || p.description || p.about || undefined;
        const authorized = p.authorized || p.verified || undefined;

        return {
            name,
            website,
            link,
            directions,
            contact_info,
            location,
            ratings: ratings != null ? String(ratings) : undefined,
            reviews: reviews != null ? String(reviews) : undefined,
            specialties: specialties != null ? String(specialties) : undefined,
            additional_information: additional_information != null ? String(additional_information) : undefined,
            authorized: authorized != null ? String(authorized) : undefined,
        } as ServiceProvider;
    };

    const providerHasValidData = (provider: any): boolean => {
        const nameCandidate = provider?.name || provider?.business_name || provider?.businessName || provider?.title || provider?.company || provider?.provider || provider?.store;
        return !!(nameCandidate && String(nameCandidate).trim() !== '');
    };

    // Get all providers (before filtering) to check if service section should show
    // Handle both array format and potential string/object formats
    const getProvidersArray = (providers: any): ServiceProvider[] => {
        if (!providers) return [];
        if (Array.isArray(providers)) return providers as ServiceProvider[];
        if (typeof providers === 'string') {
            try {
                const parsed = JSON.parse(providers);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        if (typeof providers === 'object') {
            // Common container keys
            const keys = ['providers','results','items','pros','list'];
            for (const k of keys) {
                if (Array.isArray((providers as any)[k])) return (providers as any)[k];
            }
        }
        return [];
    };

    const allProvidersRaw = [
        // Keep legacy Yelp fallback for older stored responses.
        ...getProvidersArray(service?.localPros?.yelpAPIResults),
        ...getProvidersArray(service?.localPros?.serpAPIResults),
        ...getProvidersArray(service?.localPros?.googleSearchResults),
        ...getProvidersArray(service?.providers),
        ...getProvidersArray(service?.localProviders),
        ...getProvidersArray(service?.local_pros),
        ...getProvidersArray(service?.results),
        ...getProvidersArray(service?.nearbyProviders),
    ];
    
    // Filter providers to show only those with meaningful data
    const allProviders = (allProvidersRaw
        .filter(providerHasValidData)
        .map(normalizeProvider)
        .filter(Boolean) as ServiceProvider[])
        .slice(0, 10);

    const needsClarification = !!(triage?.needs_clarification === true);
    const hasClarificationQuestions = !!(needsClarification && Array.isArray(triage?.clarification_questions) && triage.clarification_questions.length > 0);
    const hasTriage = !!(triage?.diagnosis && typeof triage.diagnosis === 'string' && triage.diagnosis.trim() !== '');
    const hasCheckpointSummary = !!(checkpointSummary && (
        checkpointSummary.checkpointsAnalyzed || 
        (checkpointSummary.issuesDetected && checkpointSummary.issuesDetected.length > 0) ||
        checkpointSummary.overallCondition ||
        (checkpointSummary.locations && checkpointSummary.locations.length > 0)
    ));
    const hasCoverage = !needsClarification && !!(coverage && (coverage.warrantyInfo || coverage.insuranceInfo));
    const hasDIY = !needsClarification && !!(diy && (
        diy.diySteps?.summary || 
        (diy.diySteps?.steps && diy.diySteps.steps.length > 0) ||
        (diy.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0) ||
        (diy.recommendedProducts?.products && diy.recommendedProducts.products.length > 0)
    ));
    const hasProviders = allProvidersRaw.length > 0; // Check raw providers count, not filtered
    const hasService = !needsClarification && hasProviders;
    const hasCostEstimates = !needsClarification && !!(cost && cost.costEstimates);
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
        console.log('Service Recommendations Debug:', {
            serviceExists: !!service,
            rawProvidersCount: allProvidersRaw.length,
            filteredProvidersCount: allProviders.length,
            hasProviders: hasProviders,
            hasServiceSection: hasService,
            serviceKeys: service ? Object.keys(service) : [],
            localProsExists: !!service?.localPros,
            localProsKeys: service?.localPros ? Object.keys(service.localPros) : [],
            serpAPIResults: service?.localPros?.serpAPIResults ? (Array.isArray(service.localPros.serpAPIResults) ? service.localPros.serpAPIResults.length : typeof service.localPros.serpAPIResults) : 'missing',
            firstProvider: allProvidersRaw.length > 0 ? allProvidersRaw[0] : null,
            fullServiceData: service
        });
    }

    // Currency helper
    const toCurrency = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
            const stripped = value.replace(/[^0-9.\-]/g, '');
            if (stripped === '') return value;
            const num = Number(stripped);
            if (isNaN(num)) return value;
            return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
        if (typeof value === 'number') {
            return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
        return '';
    };

    // Service: render cost estimates
    const isPrimitive = (v: any) => v === null || ['string','number','boolean'].includes(typeof v);
    const renderPrimitive = (v: any) => {
        if (v === null || v === undefined) return <span className="text-muted-foreground">N/A</span>;
        if (typeof v === 'number') return <span>{toCurrency(v) || String(v)}</span>;
        if (typeof v === 'string') return <span>{v}</span>;
        if (typeof v === 'boolean') return <span>{v ? 'Yes' : 'No'}</span>;
        return <span>{String(v)}</span>;
    };

    const renderRecursiveDetails = (title: string, value: any, keyPath: string): React.ReactNode => {
        if (value === null || value === undefined) return null;
        // Known tables (array of objects) → simple table
        if (Array.isArray(value) && value.length > 0 && value.every(v => v && typeof v === 'object' && !Array.isArray(v))) {
            const headers = Array.from(new Set(value.flatMap((row: any) => Object.keys(row))));
            return (
                <AccordionItem value={`${keyPath}-table`} className="border rounded-lg">
                    <AccordionTrigger className="text-sm px-3 hover:no-underline">
                        <div className="flex items-center gap-2"><span className="font-semibold">{title}</span></div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-0 pb-3 px-3">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border rounded">
                                <thead>
                                    <tr className="bg-muted/40">
                                        {headers.map(h => (<th key={h} className="text-left p-2 capitalize">{h.split('_').join(' ')}</th>))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {value.map((row: any, idx: number) => (
                                        <tr key={idx} className="border-t">
                                            {headers.map(h => (
                                                <td key={h} className="p-2 align-top">
                                                    {isPrimitive(row[h]) ? renderPrimitive(row[h]) : <code className="text-xs">{JSON.stringify(row[h])}</code>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            );
        }

        // Array of primitives → list
        if (Array.isArray(value) && value.every(isPrimitive)) {
            return (
                <AccordionItem value={`${keyPath}-list`} className="border rounded-lg">
                    <AccordionTrigger className="text-sm px-3 hover:no-underline"><span className="font-semibold">{title}</span></AccordionTrigger>
                    <AccordionContent className="pt-0 pb-3 px-3">
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {value.map((v, i) => (<li key={i}>{renderPrimitive(v)}</li>))}
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            );
        }

        // Object → nested accordion with key/value
        if (typeof value === 'object' && !Array.isArray(value)) {
            const entries = Object.entries(value as Record<string, any>);
            return (
                <AccordionItem value={`${keyPath}-obj`} className="border rounded-lg">
                    <AccordionTrigger className="text-sm px-3 hover:no-underline"><span className="font-semibold">{title}</span></AccordionTrigger>
                    <AccordionContent className="pt-0 pb-3 px-3">
                        <Accordion type="multiple" className="space-y-2">
                            {entries.map(([k, v]) => (
                                <div key={k}>
                                    {isPrimitive(v) ? (
                                        <div className="flex items-start justify-between py-1 text-sm">
                                            <span className="font-medium mr-3 capitalize">{k.split('_').join(' ')}</span>
                                            <span className="text-right">{renderPrimitive(v)}</span>
                                        </div>
                                    ) : (
                                        renderRecursiveDetails(k.split('_').join(' '), v, `${keyPath}-${k}`)
                                    )}
                                </div>
                            ))}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            );
        }

        // Primitive → simple row
        return (
            <AccordionItem value={`${keyPath}-val`} className="border rounded-lg">
                <AccordionTrigger className="text-sm px-3 hover:no-underline"><span className="font-semibold">{title}</span></AccordionTrigger>
                <AccordionContent className="pt-0 pb-3 px-3 text-sm">{renderPrimitive(value)}</AccordionContent>
            </AccordionItem>
        );
    };

    // Cost estimates removed from analysis output; related parsing/rendering omitted

    const diagnosisPreview = !needsClarification && typeof triage?.diagnosis === 'string'
        ? getPreviewText(triage.diagnosis)
        : undefined;
    const clarificationPreview = needsClarification
        ? getPreviewText(triage?.message || triage?.diagnosis)
        : undefined;
    const displayTitle = rawTitle || (needsClarification ? clarificationPreview : diagnosisPreview);

    return (
        <div className="space-y-4">
            {displayTitle && (
                <div className="rounded-lg border bg-muted/40 px-4 py-3">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">
                        {displayTitle}
                    </h2>
                </div>
            )}
        <Accordion type="single" collapsible defaultValue={hasCheckpointSummary ? "checkpoint-summary" : "triage"} className="w-full space-y-2">
            {(hasTriage || needsClarification) && (
                <AccordionItem value="triage" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Stethoscope className="h-5 w-5 text-blue-600" />
                            <span className="font-semibold">
                                {needsClarification ? "Clarification Needed" : "Triage Summary"}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0">
                        {needsClarification && hasClarificationQuestions ? (
                            <div className="space-y-4">
                                {triage.message && (
                                    <p className="text-sm text-muted-foreground mb-3">
                                        {triage.message}
                                    </p>
                                )}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Please provide more information:</h4>
                                    <ol className="list-decimal pl-6 space-y-2">
                                        {triage.clarification_questions.map((question: string, index: number) => (
                                            <li key={index} className="text-sm">
                                                {question}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        ) : hasTriage ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {String(triage!.diagnosis!)}
                            </ReactMarkdown>
                        ) : null}
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasCheckpointSummary && (
                <AccordionItem value="checkpoint-summary" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            <span className="font-semibold">Checkpoint Summary</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="space-y-3">
                            {checkpointSummary?.checkpointsAnalyzed && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Checkpoints Analyzed:</span>
                                    <span className="text-sm font-semibold">{checkpointSummary.checkpointsAnalyzed}</span>
                                </div>
                            )}
                            {checkpointSummary?.queryType && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Query Type:</span>
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {checkpointSummary.queryType}
                                    </Badge>
                                </div>
                            )}
                            {checkpointSummary?.locations && checkpointSummary.locations.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Locations:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {checkpointSummary.locations.map((location, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                {location}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {checkpointSummary?.dateRange && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Date Range:</span>
                                    <span className="text-sm">{checkpointSummary.dateRange}</span>
                                </div>
                            )}
                            {checkpointSummary?.overallCondition && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Overall Condition:</span>
                                    <span className="text-sm">{checkpointSummary.overallCondition}</span>
                                </div>
                            )}
                            {checkpointSummary?.issuesDetected && checkpointSummary.issuesDetected.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Issues Detected:</span>
                                    <ul className="list-disc pl-5 space-y-1 flex-1">
                                        {checkpointSummary.issuesDetected.map((issue, idx) => (
                                            <li key={idx} className="text-sm">{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {analysis?.checkpointDetails && Array.isArray(analysis.checkpointDetails) && analysis.checkpointDetails.length > 0 && (
                <AccordionItem value="checkpoint-details" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Info className="h-5 w-5 text-blue-600" />
                            <span className="font-semibold">Checkpoint Details</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <Accordion type="multiple" className="space-y-2">
                            {analysis.checkpointDetails.map((checkpoint: any, idx: number) => 
                                renderRecursiveDetails(
                                    checkpoint.name || `Checkpoint ${idx + 1}`,
                                    checkpoint,
                                    `checkpoint-detail-${idx}`
                                )
                            )}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {analysis?.insights && typeof analysis.insights === 'object' && Object.keys(analysis.insights).length > 0 && (
                <AccordionItem value="checkpoint-insights" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Lightbulb className="h-5 w-5 text-yellow-600" />
                            <span className="font-semibold">Insights & Recommendations</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="space-y-3">
                            {analysis.insights.changes && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Changes Observed</h4>
                                    <p className="text-sm">{analysis.insights.changes}</p>
                                </div>
                            )}
                            {analysis.insights.patterns && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Patterns Identified</h4>
                                    <p className="text-sm">{analysis.insights.patterns}</p>
                                </div>
                            )}
                            {analysis.insights.recommendations && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Recommendations</h4>
                                    <p className="text-sm">{analysis.insights.recommendations}</p>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasCoverage && (
                <AccordionItem value="coverage" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                            <span className="font-semibold">Coverage Analysis</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0">
                        {coverage?.warrantyInfo && (
                            <div className="space-y-2 mb-4">
                                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Warranty Information</h4>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {extractTextFromCoverageInfo(coverage.warrantyInfo)}
                                </ReactMarkdown>
                            </div>
                        )}
                        {coverage?.insuranceInfo && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Insurance Information</h4>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {extractTextFromCoverageInfo(coverage.insuranceInfo)}
                                </ReactMarkdown>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasDIY && (
                <AccordionItem value="diy" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Wrench className="h-5 w-5 text-orange-600" />
                            <span className="font-semibold">DIY Recommendations</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0 space-y-4">
                        {diy?.diySteps?.summary && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Summary</h4>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {String(diy.diySteps.summary)}
                                </ReactMarkdown>
                            </div>
                        )}
                        {/* DIY cost estimates removed */}
                        
                        {diy?.diySteps?.steps && diy.diySteps.steps.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Step-by-Step Instructions</h4>
                                <ol className="list-decimal pl-6 space-y-2">
                                    {diy.diySteps.steps.map((s: any, idx: number) => (
                                        <li key={idx} className="text-sm">{s.description}</li>
                                    ))}
                                </ol>
                            </div>
                        )}
                        
                        {diy?.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                    <Youtube className="h-4 w-4" /> Video Tutorials
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {diy.youtubeSearch.videos.map((v: any, i: number) => {
                                        const id = getYouTube_VideoId(v.url);
                                        return (
                                            <div key={i} className="space-y-2">
                                                {id ? (
                                                    <iframe
                                                        src={`https://www.youtube.com/embed/${id}`}
                                                        frameBorder="0"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        title={v.title || `YouTube video ${i+1}`}
                                                        className="w-full max-w-full aspect-video rounded-md border"
                                                    />
                                                ) : (
                                                    <a 
                                                        href={v.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-blue-600 dark:text-blue-400 underline break-words block"
                                                    >
                                                        {v.title || v.url}
                                                    </a>
                                                )}
                                                {v.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-3">{v.description}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {(() => {
                            // Handle both formats:
                            // 1. Direct format: recommendedProducts.products (extracted by diy agent)
                            // 2. Category format: recommendedProducts.DIY.products (direct from shopping agent)
                            let products: Product[] = [];
                            if (diy?.recommendedProducts?.products && Array.isArray(diy.recommendedProducts.products)) {
                                products = diy.recommendedProducts.products;
                            } else if (diy?.recommendedProducts?.DIY?.products && Array.isArray(diy.recommendedProducts.DIY.products)) {
                                products = diy.recommendedProducts.DIY.products;
                            } else if (diy?.recommendedProducts && typeof diy.recommendedProducts === 'object') {
                                // Try to find any category with products
                                const categoryKeys = Object.keys(diy.recommendedProducts);
                                for (const key of categoryKeys) {
                                    const category = (diy.recommendedProducts as any)[key];
                                    if (category?.products && Array.isArray(category.products)) {
                                        products = category.products;
                                        break;
                                    }
                                }
                            }
                            
                            return products.length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" /> Recommended Products
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {products.map((product: Product, index: number) => (
                                            <ProductCard key={index} product={product} />
                                        ))}
                                    </div>
                                </div>
                            ) : null;
                        })()}
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasService && (
                <AccordionItem value="service" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <TrendingUp className="h-5 w-5 text-purple-600" />
                            <span className="font-semibold">Service Recommendations</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0 space-y-4">
                        {/* Show local pros section - always show if service data exists */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Local Service Providers
                            </h4>
                            {allProviders.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {allProviders.map((provider, index) => (
                                        <ServiceProviderCard key={index} provider={provider} />
                                    ))}
                                </div>
                            ) : hasProviders ? (
                                <p className="text-sm text-muted-foreground italic">
                                    Service providers were found but need additional processing to display full details.
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    No service providers found for this location. Try searching with a specific address or area.
                                </p>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasCostEstimates && (
                <AccordionItem value="cost-estimates" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <DollarSign className="h-5 w-5 text-purple-600" />
                            <span className="font-semibold">Cost Estimates</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0 space-y-3">
                        {typeof cost.costEstimates === 'string' ? (
                            <p className="text-sm whitespace-pre-wrap break-words">{cost.costEstimates}</p>
                        ) : (
                            <div className="text-sm space-y-2">
                                {cost.costEstimates.repair_type && (
                                    <p className="text-muted-foreground">{String(cost.costEstimates.repair_type)}</p>
                                )}
                                {cost.costEstimates.DIY?.cost_range && (
                                    <p><span className="font-medium">DIY Range:</span> {String(cost.costEstimates.DIY.cost_range)}</p>
                                )}
                                {cost.costEstimates.Service?.cost_range && (
                                    <p><span className="font-medium">Pro Range:</span> {String(cost.costEstimates.Service.cost_range)}</p>
                                )}
                                {Array.isArray(cost.costEstimates.DIY?.includes) && cost.costEstimates.DIY.includes.length > 0 && (
                                    <div>
                                        <p className="font-medium">DIY Includes:</p>
                                        <ul className="list-disc pl-5">
                                            {cost.costEstimates.DIY.includes.map((it: any, i: number) => (
                                                <li key={i}>{String(it)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {Array.isArray(cost.costEstimates.Service?.includes) && cost.costEstimates.Service.includes.length > 0 && (
                                    <div>
                                        <p className="font-medium">Pro Includes:</p>
                                        <ul className="list-disc pl-5">
                                            {cost.costEstimates.Service.includes.map((it: any, i: number) => (
                                                <li key={i}>{String(it)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
        </div>
    );
};


const getYouTube_VideoId = (url: string) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      if (urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v');
      }
      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.split('/')[2].split('?')[0];
      }
      if (urlObj.pathname.startsWith('/shorts/')) {
        return urlObj.pathname.split('/shorts/')[1].split('?')[0];
      }
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
  } catch (e) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
  }
};

const isGoogleMapsDirectionsUrl = (url: string) => {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes('google.') && urlObj.pathname.startsWith('/maps/dir/');
    } catch (e) {
        return false;
    }
}

const extractText = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') {
    return node.value || '';
  }
  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
};

const findChild = (node: any, test: (node: any) => boolean): any => {
  if (!node || !node.children) return null;
  for (const child of node.children) {
    if (typeof child !== 'object' || child === null) continue;
    if (test(child)) return child;
    const found = findChild(child, test);
    if (found) return found;
  }
  return null;
};

const isYoutubeListItem = (node: any): boolean => {
  if (!node || node.tagName !== 'li') {
    return false;
  }
  const link = findChild(node, n => n.tagName === 'a' && n.properties && !!getYouTube_VideoId(n.properties.href));
  if (link) return true;

  const codeBlock = findChild(node, n => n.tagName === 'code');
  if (codeBlock) {
    const codeContent = extractText(codeBlock);
    if (getYouTube_VideoId(codeContent)) return true;
  }
  
  return false;
};

const markdownRenderers: any = {
  code({node, inline, className, children, ...props}: any) {
      if (inline) {
          const codeContent = String(children).trim();
          const videoId = getYouTube_VideoId(codeContent);
          if (videoId) {
              const parent = (node as any).parent;
              const isStandalone = parent && parent.type === 'element' && parent.tagName === 'p' && parent.children.length === 1;
              if (isStandalone) {
                return (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Embedded YouTube video"
                      className="w-full max-w-full aspect-video rounded-md my-2"
                    ></iframe>
                );
              }
          }
      }
      return <code className={className} {...props}>{children}</code>;
  },
  ul: ({ node, ...props }: any) => {
     if (!node) return <ul {...props} />;
     const isYouTubeList = Array.isArray(node.children) && node.children.some(isYoutubeListItem);

     if (isYouTubeList) {
         return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{props.children}</div>
     }
     return <ul {...props} />
  },
  li: ({ node, ...props }: any) => {
     if (!node) return <li {...props} />;
     
     const linkNode = findChild(node, (n: any) => n.tagName === 'a' && n.properties);
     const codeNode = findChild(node, (n: any) => n.tagName === 'code');
     
     let videoId: string | null = null;
     let urlToExclude = '';
     
     if (linkNode) {
        videoId = getYouTube_VideoId(linkNode.properties.href);
        urlToExclude = linkNode.properties.href;
     } else if (codeNode) {
        const codeContent = extractText(codeNode);
        videoId = getYouTube_VideoId(codeContent);
        urlToExclude = codeContent;
     }

     if (videoId) {
        const title = extractText(node)
          .replace(urlToExclude, '')
          .replace(/\[\]/g,'')
          .replace(/:/,'')
          .trim();
        
        return (
          <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Embedded YouTube video"
          className="w-full aspect-video rounded-md my-2"
          ></iframe>
         );
     }
     return <li {...props} />
  },
  p: ({ node, ...props }: any) => {
    if (!node) return <p {...props} />;
    const linkNode = findChild(node, (n: any) => n.tagName === 'a' && n.properties);
    if (!linkNode) return <p {...props} className="break-words" />;
    const videoId = getYouTube_VideoId(linkNode.properties.href);

    if (videoId && node.children.length > 0) {
       const title = extractText(node).replace(linkNode.properties.href, '').replace(/\[\]/g,'').trim();
       
       return (
        <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded YouTube video"
        className="w-full max-w-full aspect-video rounded-md my-2"
        ></iframe>
       );
    }
    return <p {...props} className="break-words" />;
},
a: ({node, ...props}: any) => {
  if (!node) return <a {...props} />;
  const href = props.href || '';
  if (isGoogleMapsDirectionsUrl(href)) {
    try {
        const text = extractText(node);
        const url = new URL(href);
        const destination = url.searchParams.get('daddr');
        
        // This is the implementation for "Your Location" as the starting point
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=Your+Location&destination=${encodeURIComponent(destination || '')}`;

        return (
            <Button asChild variant="outline" size="sm" className="not-prose my-2">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                    <Map className="mr-2 h-4 w-4" />
                    {text.trim().startsWith('http') ? 'View Directions' : text}
                </a>
            </Button>
        )
    } catch(e) {
      // Fallback for invalid URL
    }
  }

  const videoId = getYouTube_VideoId(href);
  
  const parent = (node as any).parent;
  const isStandalone = parent && parent.tagName === 'p' && parent.children.length === 1;

   if (videoId && isStandalone) {
     return (
        <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded YouTube video"
            className="w-full max-w-full aspect-video rounded-md my-2"
        ></iframe>
     )
  }
  if (videoId) return null;

  return <a {...props} target="_blank" rel="noopener noreferrer" className="break-all">{props.children}</a>;
}
}


type Props = {
  message: Message;
  isLoading?: boolean;
  context?: 'property' | null;
};

const ChatMessageComponent = ({ message, isLoading = false, context }: Props) => {
  const isUser = message.role === "user";
  const [isMediaLoaded, setIsMediaLoaded] = React.useState(false);
  const { toast } = useToast();
  
  const bubbleRef = React.useRef<HTMLDivElement>(null);

  const handleCopy = useCallback((event: React.ClipboardEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      event.preventDefault();
      const selectedHtml = selection.getRangeAt(0).cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(selectedHtml);
      const whatsappText = htmlToWhatsapp(tempDiv.innerHTML);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(whatsappText).then(() => {
          toast({ title: "Selection copied!" });
        }).catch(() => {
          toast({ variant: "destructive", title: "Copy failed" });
        });
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = whatsappText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          toast({ title: "Selection copied!" });
        } catch {
          toast({ variant: "destructive", title: "Copy failed" });
        }
        document.body.removeChild(textArea);
      }
    }
  }, [toast]);

  const isAgentStatusMessage = !!message.agentSteps && message.agentSteps.length > 0;
  const trimmedAssistantContent =
    typeof message.content === 'string' ? message.content.trim() : '';
  const hasAssistantResponse = !isUser && trimmedAssistantContent.length > 0;
  /** Only show "Thinking..." while a step is actively executing — not when steps are all terminal but body text is still empty. */
  const hasExecutingAgentStep =
    message.agentSteps?.some((s) => s.status === 'executing') ?? false;
  const showThinkingStrip =
    !isUser && !hasAssistantResponse && hasExecutingAgentStep;
  const showLoadingIndicator =
    isLoading && !isUser && !message.content && !isAgentStatusMessage;
  const fileData = message.file;

  const handleCopyClick = () => {
    const whatsappFormattedText = markdownToWhatsapp(message.content);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(whatsappFormattedText).then(() => {
        toast({
          title: "Message copied!",
        });
      }, (err) => {
        toast({
          variant: "destructive",
          title: "Copy failed",
          description: "Could not copy message to clipboard.",
        });
      });
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = whatsappFormattedText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({ title: "Message copied!" });
      } catch {
        toast({
          variant: "destructive",
          title: "Copy failed",
          description: "Could not copy message to clipboard.",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const renderDocumentList = () => {
    if (!message.documents || message.documents.length === 0) return null;

    return (
        <div className="space-y-2 mt-2 not-prose">
            <p className="text-xs font-semibold text-muted-foreground">Context Documents:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.documents.map((doc, index) => {
                    const Icon = docTypeIcons[doc.type] || FileText;
                    return (
                        <div key={index} className="flex items-center gap-2 bg-background/50 p-2 rounded-md border text-xs">
                            <Icon className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate text-foreground" title={doc.name}>{doc.name}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }

  const renderFilePreview = () => {
    if (!fileData) return null;

    const isImage = fileData.type.startsWith("image/");
    const isVideo = fileData.type.startsWith("video/");

    if (isImage) {
      return (
        <div className="relative h-[200px] w-[200px] max-w-xs">
          {!isMediaLoaded && (
             <div className="w-full h-full rounded-md space-y-2 p-2 bg-white flex flex-col justify-center">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[70%]" />
             </div>
          )}
          <Image
            src={fileData.url}
            alt={fileData.name}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            onLoad={() => setIsMediaLoaded(true)}
            className={cn(
              "rounded-md object-cover transition-opacity duration-500",
              "absolute inset-0",
              isMediaLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      );
    }
    
    if (isVideo) {
      return (
         <div className="relative w-full max-w-full">
          {!isMediaLoaded && (
             <div className="w-full aspect-video rounded-md space-y-2 p-2 bg-white flex flex-col justify-center">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-full" />
             </div>
          )}
          <video
            src={fileData.url}
            controls
            onLoadedData={() => setIsMediaLoaded(true)}
            className={cn("w-full rounded-md transition-opacity duration-500", isMediaLoaded ? "opacity-100" : "opacity-0")}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    
    if (isUser) {
        return (
          <div className="flex flex-row items-center justify-start gap-4 rounded-lg bg-secondary/80 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-secondary/20">
                <File className="h-8 w-8 shrink-0 text-secondary-foreground" />
            </div>
            <span className="text-sm font-medium break-all text-secondary-foreground">{fileData.name}</span>
          </div>
        )
    }

    return (
      <div className="relative w-48 h-48">
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 rounded-md border bg-background/50 text-foreground">
          <File className="h-8 w-8" />
          <span className="text-xs font-medium text-center break-all text-white">{fileData.name}</span>
        </div>
      </div>
    );
  };
  
  const bubbleStyle = !isUser ? { borderRadius: '18px 18px 18px 6px' } : {};
  const isMediaOnly = (fileData?.type.startsWith('image/') || fileData?.type.startsWith('video/')) && !message.content;

  let structuredData: StructuredResponseData | null = null;
  let fallbackParsedJson: any | null = null;

  const jsonToMarkdown = (data: any, level: number = 3): string => {
    const heading = (text: string, lvl: number) => `${'#'.repeat(Math.min(6, lvl))} ${text}`;
    const toInline = (val: any): string => {
      if (val === null || val === undefined) return '`null`';
      if (typeof val === 'string') return val.includes('\n') ? `\n\n${val}\n\n` : val;
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      if (Array.isArray(val)) return val.length === 0 ? '[]' : `${val.length} items`;
      if (typeof val === 'object') return Object.keys(val).length === 0 ? '{}' : `${Object.keys(val).length} fields`;
      return String(val);
    };

    const isHomogeneousObjectArray = (arr: any[]): boolean => {
      if (arr.length === 0) return false;
      return arr.every(it => it && typeof it === 'object' && !Array.isArray(it));
    };

    if (Array.isArray(data)) {
      if (isHomogeneousObjectArray(data)) {
        const headers = Array.from(new Set(data.flatMap(obj => Object.keys(obj))));
        const lines: string[] = [];
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
        data.forEach((row) => {
          lines.push(`| ${headers.map(h => toInline((row as any)[h] ?? '')).join(' | ')} |`);
        });
        return lines.join('\n');
      }
      return data.map((it: any) => `- ${toInline(it)}`).join('\n');
    }

    if (typeof data === 'object' && data) {
      const sections: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object') {
          sections.push(heading(String(key), level));
          sections.push(jsonToMarkdown(value, level + 1));
          sections.push('');
        } else {
          sections.push(`- **${key}**: ${toInline(value)}`);
        }
      }
      return sections.join('\n');
    }

    return toInline(data);
  };
    try {
        if (!isUser && message.content) {
          let contentToParse = message.content.trim();
          
          // Debug logging to help diagnose parsing issues
          console.log('=== ChatMessage Content Parsing ===');
          console.log('Content length:', contentToParse.length);
          console.log('Has ```json:', contentToParse.includes('```json'));
          console.log('Has ```markdown:', contentToParse.includes('```markdown'));
          console.log('First 300 chars:', contentToParse.substring(0, 300));
          console.log('===================================');
          
          // Helper function to check if parsed JSON has structured data keys
          const hasStructuredDataKeys = (parsed: any): boolean => {
              if (!parsed || typeof parsed !== 'object') return false;
              // Check for nested structure (analysis.*)
              if (parsed.analysis && typeof parsed.analysis === 'object') {
                  return !!(parsed.analysis.triageResult || parsed.analysis.coverageResult || 
                           parsed.analysis.diyResults || parsed.analysis.serviceResults ||
                           parsed.analysis.checkpointSummary || parsed.analysis.checkpointDetails);
              }
              // Check for flat structure
              return !!(parsed.triageResult || parsed.diyResults || parsed.serviceResults || 
                       parsed.coverageResult || parsed.checkpointSummary || parsed.checkpointDetails);
          };
          
          // Method 1: PRIORITY - Extract JSON from ```json code block (for dual-format responses)
          // This ensures we only read from the JSON code block and ignore any markdown that follows
          const jsonCodeBlockRegex = /```json\s*\n?([\s\S]*?)```/;
          const jsonCodeBlockMatch = contentToParse.match(jsonCodeBlockRegex);
          if (jsonCodeBlockMatch) {
              const codeContent = jsonCodeBlockMatch[1].trim();
              if (codeContent.startsWith('{') || codeContent.startsWith('[')) {
                  try {
                      const parsed = JSON.parse(codeContent);
                      if (hasStructuredDataKeys(parsed)) {
                          structuredData = parsed;
                          if (process.env.NODE_ENV === 'development') {
                              console.log('✓ Parsed JSON from ```json code block (Method 1 - Dual Format)');
                          }
                      } else if (parsed && typeof parsed === 'object') {
                          fallbackParsedJson = parsed;
                      }
                  } catch (e) {
                      if (process.env.NODE_ENV === 'development') {
                          console.warn('Failed to parse JSON from ```json code block:', e);
                      }
                  }
              }
          }
          
          // Method 2: If no ```json code block found, try generic code blocks (``` ... ```)
          if (!structuredData) {
              const genericCodeBlockRegex = /```[^`]*\s*\n?([\s\S]*?)```/g;
              let codeBlockMatch;
              
              // Try all code blocks (but skip if we already found JSON code block)
              while ((codeBlockMatch = genericCodeBlockRegex.exec(contentToParse)) !== null) {
                  const codeContent = codeBlockMatch[1].trim();
                  if (codeContent.startsWith('{') || codeContent.startsWith('[')) {
                      try {
                          const parsed = JSON.parse(codeContent);
                          if (hasStructuredDataKeys(parsed)) {
                              structuredData = parsed;
                              if (process.env.NODE_ENV === 'development') {
                                  console.log('✓ Parsed JSON from generic code block (Method 2)');
                              }
                              break; // Stop after finding valid JSON
                          }
                      } catch {
                          // Not valid JSON in this block
                      }
                  }
              }
          }
          
          // Method 3: If no code block found, try direct JSON parsing (pure JSON response)
          if (!structuredData && contentToParse.startsWith('{') && contentToParse.endsWith('}')) {
              try {
                  const parsed = JSON.parse(contentToParse);
                  if (hasStructuredDataKeys(parsed)) {
                      structuredData = parsed;
                      if (process.env.NODE_ENV === 'development') {
                          console.log('✓ Parsed JSON directly from content (Method 3 - Pure JSON)');
                      }
                  } else if (parsed && typeof parsed === 'object') {
                      fallbackParsedJson = parsed;
                  }
              } catch {
                  // Not pure JSON, continue with other methods
              }
          }
              
          // Method 4: Fallback - Try to find JSON object directly from content (only if no code block found)
          // This is a fallback for responses that don't use code blocks
          // NOTE: We only do this if we haven't found JSON in a code block to avoid parsing markdown
          if (!structuredData && !jsonCodeBlockMatch) {
              // More aggressive regex to match JSON objects with our keys
              const patterns = [
                  // Match complete JSON objects that might span multiple lines
                  /\{[^{}]*(?:"analysis"|"triageResult"|"diyResults"|"serviceResults"|"coverageResult")[^{}]*\}/,
                  // Try to find the first { and match until balanced closing }
                  /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/
              ];
              
              for (const pattern of patterns) {
                  const objectMatches = contentToParse.match(new RegExp(pattern.source, 'g'));
                  if (objectMatches) {
                      for (const match of objectMatches) {
                          try {
                              const parsed = JSON.parse(match);
                              if (hasStructuredDataKeys(parsed)) {
                                  structuredData = parsed;
                                  if (process.env.NODE_ENV === 'development') {
                                      console.log('✓ Parsed JSON from pattern match (Method 4 - Fallback)');
                                  }
                                  break;
                              }
                          } catch {
                              // Continue trying
                          }
                      }
                      if (structuredData) break;
                  }
              }
              
              // Method 5: Last resort - Try to extract JSON by finding the first { and last matching }
              // Only if no code block was detected (to avoid parsing markdown)
              if (!structuredData && contentToParse.includes('{')) {
                  const firstBrace = contentToParse.indexOf('{');
                  const lastBrace = contentToParse.lastIndexOf('}');
                  if (firstBrace < lastBrace) {
                      const potentialJson = contentToParse.substring(firstBrace, lastBrace + 1);
                      try {
                          const parsed = JSON.parse(potentialJson);
                          if (hasStructuredDataKeys(parsed)) {
                              structuredData = parsed;
                              if (process.env.NODE_ENV === 'development') {
                                  console.log('✓ Parsed JSON from brace matching (Method 5 - Last Resort)');
                              }
                          }
                      } catch {
                          // Try cleaning common issues
                          try {
                              // Remove comments, fix trailing commas, etc.
                              let cleaned = potentialJson
                                  .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
                                  .replace(/\/\/.*$/gm, '') // Remove line comments
                                  .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                                  .replace(/\\(?!["\\/bfnrtu])/g, '\\\\'); // Fix escape sequences
                              
                              const parsed = JSON.parse(cleaned);
                              if (hasStructuredDataKeys(parsed)) {
                                  structuredData = parsed;
                                  if (process.env.NODE_ENV === 'development') {
                                      console.log('✓ Parsed JSON after cleaning (Method 5b)');
                                  }
                              }
                          } catch {
                              // Final fallback - give up
                          }
                      }
                  }
              }
          }
          
          // Debug logging
        if (structuredData) {
            if (process.env.NODE_ENV === 'development') {
                const sd: any = structuredData;
                const serviceData = sd?.analysis?.serviceResults || sd?.serviceResults;
                console.log('✓ Successfully parsed structured data:', {
                    hasAnalysis: !!sd?.analysis,
                    hasTriage: !!(sd?.analysis?.triageResult || sd?.triageResult),
                    hasDiy: !!(sd?.analysis?.diyResults || sd?.diyResults),
                    hasService: !!(sd?.analysis?.serviceResults || sd?.serviceResults),
                    hasCoverage: !!(sd?.analysis?.coverageResult || sd?.coverageResult),
                    structure: sd?.analysis ? 'nested' : 'flat',
                    serviceDataDetails: serviceData ? {
                        hasCostEstimates: !!serviceData.costEstimates,
                        hasLocalPros: !!serviceData.localPros,
                        localProsKeys: serviceData.localPros ? Object.keys(serviceData.localPros) : [],
                        serpCount: Array.isArray(serviceData.localPros?.serpAPIResults) ? serviceData.localPros.serpAPIResults.length : 'not array',
                    } : null
                });
            }
        } else if (process.env.NODE_ENV === 'development') {
              const hasJsonMarkers = message.content.includes('"analysis"') || 
                                     message.content.includes('"triageResult"') || 
                                     message.content.includes('"serviceResults"') ||
                                     message.content.includes('"diyResults"') ||
                                     message.content.includes('"coverageResult"');
              if (hasJsonMarkers) {
                  console.warn('⚠ Detected JSON markers but failed to parse structured data. Content preview:', message.content.substring(0, 500));
                  console.warn('Full content length:', message.content.length);
              }
          }
        }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
          console.error('Exception parsing structured data:', e);
      }
        // Not a JSON object, treat as plain text
    }

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        { "justify-end": isUser },
      )}
    >
      <div className="hidden sm:block">
        {!isUser && <ChatAvatar message={message} context={context} />}
      </div>
      <div className={cn(
          "flex flex-col max-w-full sm:max-w-[calc(100%-4rem)] group relative",
          structuredData ? 'w-full md:w-5/6 lg:w-4/5' : 'w-fit'
      )} ref={bubbleRef} onCopy={handleCopy}>
          <div
            style={bubbleStyle}
            className={cn(
              "max-w-full shadow-sm flex flex-col",
              "animate-message-in",
              { "self-end": isUser },
              {
                "rounded-lg": isUser,
                "bg-muted border":
                  !isUser && !showThinkingStrip && !showLoadingIndicator && !structuredData,
                "bg-transparent border-0 shadow-none":
                  showThinkingStrip || showLoadingIndicator || structuredData
              },
              (isUser && message.content) && "bg-secondary text-secondary-foreground",
              fileData && message.content ? "gap-2" : "",
              isMediaOnly ? 'p-0 bg-transparent' : (fileData || (showLoadingIndicator && !message.content)) ? "p-2" : structuredData ? "" : "px-4 py-2.5"
            )}
          >
            {!isUser &&
              hasAssistantResponse &&
              !showLoadingIndicator &&
              !structuredData && (
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopyClick}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy message</span>
                </Button>
            )}
            {showThinkingStrip ? (
              <div className="flex items-center gap-2 rounded-lg border bg-background/50 px-4 py-3 text-sm shadow-sm">
                <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-primary" />
                <span className="bg-gradient-to-r from-primary via-muted-foreground to-primary bg-clip-text text-transparent animate-text-gradient">
                  Thinking...
                </span>
              </div>
            ) : showLoadingIndicator ? (
               <div className="flex items-center justify-start p-2">
                <svg width="45" height="24" viewBox="0 0 45 24" fill="currentColor" className="text-muted-foreground">
                    <circle cx="6.75" cy="12" r="3.75">
                        <animate attributeName="r" from="3.75" to="3.75" begin="0s" dur="0.8s" values="3.75;5.25;3.75" calcMode="linear" repeatCount="indefinite" />
                        <animate attributeName="fill-opacity" from="1" to="1" begin="0s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                    </circle>
                    <circle cx="22.5" cy="12" r="3.75">
                        <animate attributeName="r" from="3.75" to="3.75" begin="0.2s" dur="0.8s" values="3.75;5.25;3.75" calcMode="linear" repeatCount="indefinite" />
                        <animate attributeName="fill-opacity" from="1" to="1" begin="0.2s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                    </circle>
                    <circle cx="38.25" cy="12" r="3.75">
                        <animate attributeName="r" from="3.75" to="3.75" begin="0.4s" dur="0.8s" values="3.75;5.25;3.75" calcMode="linear" repeatCount="indefinite" />
                        <animate attributeName="fill-opacity" from="1" to="1" begin="0.4s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                    </circle>
                </svg>
               </div>
            ) : structuredData ? (
                <StructuredResponse data={structuredData} />
            ) : (
                <>
                {renderFilePreview()}
                {message.content && (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    {isUser ? (
                      <p className="whitespace-pre-wrap break-words text-secondary-foreground">{message.content}</p>
                    ) : (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={markdownRenderers}
                      >
                        {fallbackParsedJson ? jsonToMarkdown(fallbackParsedJson) : message.content}
                      </ReactMarkdown>
                    )}
                     {renderDocumentList()}
                  </div>
                )}
                </>
            )}
          </div>
        </div>
      {isUser && (
        <div className="hidden sm:block">
          <ChatAvatar message={message} />
        </div>
      )}
    </div>
  );
}

export const ChatMessage = React.memo(ChatMessageComponent);
