

import { cn } from "@/lib/utils";
import type { Message, ServiceProvider, StructuredResponseData, Product, RecommendedProducts, CostEstimates } from "@/lib/types";
import { ChatAvatar } from "./chat-avatar";
import Image from "next/image";
import { File, Map, Building, Home, ShieldCheck, ReceiptText, Search, FileKey, FileText, Lightbulb, Copy, Star, Users, Phone, Mail, CheckCircle, Info, Wrench, Youtube, ExternalLink, ShoppingCart, DollarSign } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";
import { AgentStatus } from "./agent-status";
import { useToast } from "@/hooks/use-toast";
import { markdownToWhatsapp, htmlToWhatsapp } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "../ui/badge";

const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: ReceiptText,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileText,
};

const ServiceProviderCard = ({ provider }: { provider: ServiceProvider }) => {
  
 
    const primaryLink = provider.link || provider.website;
    const primaryLinkLabel = provider.link?.includes('yelp.com') ? 'View on Yelp' : 'Website';

    const isPrimaryLinkValid = primaryLink && (primaryLink.startsWith('http://') || primaryLink.startsWith('https://'));
    const isDirectionsLinkValid = provider.directions && (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

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
            <CardDescription className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1 text-sm text-yellow-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span>{provider.ratings?.split('/')[0] || 'N/A'}</span>
                </div>
                <span className="text-muted-foreground text-xs">
                     ({provider.reviews && !provider.reviews.toLowerCase().includes('review') 
                        ? provider.reviews 
                        : `${provider.reviews || '0'} reviews`})
                </span>
            </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3">
             <p className="text-sm text-muted-foreground line-clamp-3">
              {provider.additional_information || 'No additional information available.'}
            </p>
            <div className="text-sm space-y-2">
                <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className='min-w-0'>{provider.contact_info || 'Not available'}</span>
                </div>
                <div className="flex items-start gap-2 min-w-0">
                    <Map className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="line-clamp-1 min-w-0">{provider.location || 'Not available'}</span>
                </div>
            </div>
            {provider.specialties && (
                <div className="space-y-1 pt-1 min-w-0">
                    <h4 className="text-xs font-semibold text-muted-foreground">Specialties</h4>
                    <p className="text-xs text-foreground break-words">{provider.specialties}</p>
                </div>
            )}
        </CardContent>
        <CardFooter className="flex gap-2 mt-auto pt-4">
            {isPrimaryLinkValid && <Button variant="outline" size="sm" asChild><a href={primaryLink} target="_blank" rel="noopener noreferrer">{primaryLinkLabel}</a></Button>}
            {isDirectionsLinkValid && <Button variant="default" size="sm" asChild><a href={provider.directions} target="_blank" rel="noopener noreferrer">Directions</a></Button>}
        </CardFooter>
    </Card>
)};

const ProductCard = ({ product }: { product: Product }) => {
    const isLinkValid = product.url && (product.url.startsWith('http://') || product.url.startsWith('https://'));

    return (
        <Card className="flex flex-col h-full w-full">
            <CardHeader>
                <CardTitle className="text-sm flex justify-between items-start">
                    <span className="line-clamp-2 flex-1">{product.product_name}</span>
                    {product.is_preferred_retailer && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200 shrink-0">
                            <Star className="h-3 w-3 fill-current" />
                            Recommended
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription className="flex items-center justify-between pt-1">
                    {product.vendor && (
                        <span className="text-xs text-muted-foreground">{product.vendor}</span>
                    )}
                    {product.rating && (
                        <div className="flex items-center gap-1 text-xs text-yellow-500">
                            <Star className="h-3 w-3 fill-current" />
                            <span>{product.rating}</span>
                        </div>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="space-y-2">
                    {product.item_price && (
                        <p className="text-lg font-semibold text-foreground">{product.item_price}</p>
                    )}
                    {product.reviews && (
                        <p className="text-xs text-muted-foreground">{product.reviews} reviews</p>
                    )}
                </div>
            </CardContent>
            {isLinkValid && (
                <CardFooter>
                    <Button variant="outline" size="sm" asChild className="w-full">
                        <a href={product.url!} target="_blank" rel="noopener noreferrer">
                            View Product <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
};

const CostEstimateSection = ({ estimate }: { estimate: NonNullable<StructuredResponseData['costEstimationResults']>['costEstimates'] }) => {
    if (!estimate) return null;

    return (
        <div className="space-y-4">
            {estimate.repair_type && (
                <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{estimate.repair_type}</h3>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {estimate.DIY && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">DIY Repair</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-2xl font-bold text-green-600">{estimate.DIY.cost_range}</div>
                            {estimate.DIY.includes && estimate.DIY.includes.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-muted-foreground">Includes:</p>
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {estimate.DIY.includes.map((item, idx) => (
                                            <li key={idx} className="text-muted-foreground">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {estimate.DIY.savings && (
                                <p className="text-sm text-green-600 font-semibold">{estimate.DIY.savings}</p>
                            )}
                            {estimate.DIY.complexity && (
                                <p className="text-xs text-muted-foreground">{estimate.DIY.complexity}</p>
                            )}
                        </CardContent>
                    </Card>
                )}
                
                {estimate.Service && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Professional Service</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-2xl font-bold text-blue-600">{estimate.Service.cost_range}</div>
                            {estimate.Service.includes && estimate.Service.includes.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-muted-foreground">Includes:</p>
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {estimate.Service.includes.map((item, idx) => (
                                            <li key={idx} className="text-muted-foreground">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {estimate.Service.benefits && (
                                <p className="text-sm text-blue-600 font-semibold">{estimate.Service.benefits}</p>
                            )}
                            {estimate.Service.complexity && (
                                <p className="text-xs text-muted-foreground">{estimate.Service.complexity}</p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {estimate.comparison && (
                <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            {estimate.comparison.diy_savings && (
                                <p className="text-sm">
                                    <span className="font-semibold">DIY Savings: </span>
                                    {estimate.comparison.diy_savings}
                                </p>
                            )}
                            {estimate.comparison.professional_benefits && (
                                <p className="text-sm">
                                    <span className="font-semibold">Professional Benefits: </span>
                                    {estimate.comparison.professional_benefits}
                                </p>
                            )}
                            {estimate.comparison.considerations && (
                                <p className="text-sm">
                                    <span className="font-semibold">Considerations: </span>
                                    {estimate.comparison.considerations}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {estimate.recommendation && (
                <Card className="border-l-4 border-l-primary">
                    <CardHeader>
                        <CardTitle className="text-base">Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm">
                            {estimate.recommendation.simple_repairs && (
                                <li>• {estimate.recommendation.simple_repairs}</li>
                            )}
                            {estimate.recommendation.complex_repairs && (
                                <li>• {estimate.recommendation.complex_repairs}</li>
                            )}
                            {estimate.recommendation.note && (
                                <li className="text-xs text-muted-foreground italic">Note: {estimate.recommendation.note}</li>
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const StructuredResponse = ({ data }: { data: StructuredResponseData }) => {
    const allProviders = [
        ...(data.serviceProviderResults?.yelpAPIResults || []),
        ...(data.serviceProviderResults?.serpAPIResults || []),
    ];

    const hasContent = (key: keyof NonNullable<StructuredResponseData['researchResults']>) =>
        data.researchResults?.[key] && data.researchResults[key]?.trim() !== '';
        
    const hasProviders = allProviders.length > 0;

    const hasProducts = 
        (data.productRecommendationsResults?.recommendedProducts?.DIY?.products?.length ?? 0) > 0 ||
        (data.productRecommendationsResults?.recommendedProducts?.Service?.products?.length ?? 0) > 0;

    const hasCostEstimate = !!data.costEstimationResults?.costEstimates;

    return (
        <Accordion type="single" collapsible defaultValue="summary" className="w-full">
            {hasContent('summaryOfFindings') && (
                <AccordionItem value="summary">
                    <AccordionTrigger className="text-sm sm:text-sm px-2">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Info className="h-4 w-4" />
                            <span>Summary</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words p-4 bg-background rounded-b-lg border-t">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.researchResults!.summaryOfFindings!}</ReactMarkdown>
                    </AccordionContent>
                </AccordionItem>
            )}
            {hasContent('yourDocuments') && (
                <AccordionItem value="coverage">
                    <AccordionTrigger className="text-sm sm:text-sm px-2">
                         <div className="flex items-center gap-2 flex-1 text-left">
                           <ShieldCheck className="h-4 w-4" />
                           <span>Coverage</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words p-4 bg-background rounded-b-lg border-t">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.researchResults!.yourDocuments!}</ReactMarkdown>
                    </AccordionContent>
                </AccordionItem>
            )}
            {(hasContent('googleSearch') || hasContent('youtubeSearch')) && (
                <AccordionItem value="diy">
                     <AccordionTrigger className="text-sm sm:text-sm px-2">
                        <div className="flex items-center gap-2 flex-1 text-left">
                          <Wrench className="h-4 w-4" />
                          <span>DIY Solutions</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words p-4 bg-background rounded-b-lg border-t">
                        {hasContent('googleSearch') && <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.researchResults!.googleSearch!}</ReactMarkdown>}
                        {hasContent('youtubeSearch') && <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownRenderers}>{data.researchResults!.youtubeSearch!}</ReactMarkdown>}
                    </AccordionContent>
                </AccordionItem>
            )}
            {hasProducts && (
                <AccordionItem value="products">
                    <AccordionTrigger className="text-sm sm:text-sm px-2">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <ShoppingCart className="h-4 w-4" />
                            <span>Product Recommendations</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-background rounded-b-lg border-t">
                        <div className="space-y-6">
                            {data.productRecommendationsResults?.recommendedProducts?.DIY?.products && data.productRecommendationsResults.recommendedProducts.DIY.products.length > 0 && (
                                <div>
                                    <h3 className="text-base font-semibold mb-2">DIY Products</h3>
                                    {data.productRecommendationsResults.recommendedProducts.DIY.description && (
                                        <p className="text-sm text-muted-foreground mb-3">{data.productRecommendationsResults.recommendedProducts.DIY.description}</p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {data.productRecommendationsResults.recommendedProducts.DIY.products.map((product, index) => (
                                            <ProductCard key={index} product={product} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {data.productRecommendationsResults?.recommendedProducts?.Service?.products && data.productRecommendationsResults.recommendedProducts.Service.products.length > 0 && (
                                <div>
                                    <h3 className="text-base font-semibold mb-2">Professional Service Products</h3>
                                    {data.productRecommendationsResults.recommendedProducts.Service.description && (
                                        <p className="text-sm text-muted-foreground mb-3">{data.productRecommendationsResults.recommendedProducts.Service.description}</p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {data.productRecommendationsResults.recommendedProducts.Service.products.map((product, index) => (
                                            <ProductCard key={index} product={product} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {data.productRecommendationsResults?.recommendedProducts?.recommended_retailers && data.productRecommendationsResults.recommendedProducts.recommended_retailers.length > 0 && (
                                <Card className="bg-blue-50 border-blue-200">
                                    <CardHeader>
                                        <CardTitle className="text-sm">Recommended Retailers</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {data.productRecommendationsResults.recommendedProducts.recommended_retailers.map((retailer, idx) => (
                                                <Badge key={idx} variant="secondary">{retailer}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            {data.productRecommendationsResults?.recommendedProducts?.shopping_tips && data.productRecommendationsResults.recommendedProducts.shopping_tips.length > 0 && (
                                <Card className="bg-muted/50">
                                    <CardHeader>
                                        <CardTitle className="text-sm">Shopping Tips</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="text-sm space-y-1 list-disc list-inside">
                                            {data.productRecommendationsResults.recommendedProducts.shopping_tips.map((tip, idx) => (
                                                <li key={idx} className="text-muted-foreground">{tip}</li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            {hasCostEstimate && (
                <AccordionItem value="costs">
                    <AccordionTrigger className="text-sm sm:text-sm px-2">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <DollarSign className="h-4 w-4" />
                            <span>Cost Estimates</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-background rounded-b-lg border-t">
                        <CostEstimateSection estimate={data.costEstimationResults?.costEstimates} />
                    </AccordionContent>
                </AccordionItem>
            )}
            {hasProviders && (
                <AccordionItem value="providers">
                    <AccordionTrigger className="text-sm sm:text-sm px-2">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Users className="h-4 w-4" />
                            <span>Service Providers</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-background rounded-b-lg border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allProviders.map((provider, index) => (
                                <ServiceProviderCard key={index} provider={provider} />
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
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
      navigator.clipboard.writeText(whatsappText).then(() => {
        toast({ title: "Selection copied!" });
      });
    }
  }, [toast]);

  const isAgentStatusMessage = !!message.agentSteps && message.agentSteps.length > 0;
  const showLoadingIndicator = isLoading && !isUser && !message.content && !isAgentStatusMessage;
  const fileData = message.file;

  const handleCopyClick = () => {
    const whatsappFormattedText = markdownToWhatsapp(message.content);
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
    try {
        if (!isUser && message.content) {
          const jsonRegex = /\*\*.*?\*\*\s*:\s*```json\s*\n([\s\S]*?)```/;
          const match = message.content.match(jsonRegex);
          
          let parsed: any = null;
          
          if (match && match[1]) {
              // sometimes json has markdown which has unescaped characters
              const cleaned = match[1].trim().replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
              parsed = JSON.parse(cleaned);
          } else {
              // Try parsing the entire content as JSON
              parsed = JSON.parse(message.content);
          }
          
          if (parsed && (parsed.researchResults || parsed.serviceProviderResults || parsed.productRecommendationsResults || parsed.costEstimationResults)) {
              structuredData = parsed;
          }
        }
    } catch (e) {
      console.log('Exception:', e)
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
                "bg-muted border": !isUser && !isAgentStatusMessage && !showLoadingIndicator && !structuredData,
                "bg-transparent border-0 shadow-none": isAgentStatusMessage || showLoadingIndicator || structuredData
              },
              (isUser && message.content) && "bg-secondary text-secondary-foreground",
              fileData && message.content ? "gap-2" : "",
              isMediaOnly ? 'p-0 bg-transparent' : (fileData || (showLoadingIndicator && !message.content)) ? "p-2" : structuredData ? "" : "px-4 py-2.5"
            )}
          >
            {!isUser && message.content && !showLoadingIndicator && !isAgentStatusMessage && !structuredData && (
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopyClick}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy message</span>
                </Button>
            )}
            {isAgentStatusMessage ? (
              <AgentStatus steps={message.agentSteps!} />
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
                        {message.content}
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
