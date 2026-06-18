import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Animated,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { Text } from '../components/ui/text';
import { Icon } from '../components/ui/icon';
import {
  Zap,
  CheckCircle,
  TrendingUp,
  FileText,
  Settings,
  DollarSign,
  ArrowRight,
  Share2,
  Building2,
  Shield,
  MapPin,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react-native';
import { AssetMemBrandIcon } from '@/components/AssetMemBrandIcon';
import { LandingDemoVideoModal } from '@/components/landing/LandingDemoVideoModal';
import { openExternalWebUrl } from '@/lib/open-external-url';
import { getWebAppOrigin } from '@/lib/expo-extra';
import { getYouTubeVideoId } from '@/lib/youtube-utils';
import { DEFAULT_LANDING_DEMO_VIDEO_URLS } from '@/lib/landing-demo-video-constants';
import {
  getEnterpriseConfigFromEnv,
  getEnterpriseMailtoHref,
  type EnterpriseConfig,
} from '@/lib/enterprise-config';
import { fetchLandingRemoteConfig } from '@/lib/landing-remote-config';
import { LANDING_COLORS } from '@/lib/landing-theme';
import { LandingGradientText } from '@/components/landing/landing-gradient-text';
import {
  LandingGradientBadge,
  LandingHeroBackground,
  LandingSectionBackground,
  withHexAlpha,
} from '@/components/landing/landing-backgrounds';

// Keep in sync with apps/webapp/src/lib/site.ts
const SITE_HERO_HEADLINE_PRIMARY = 'Timeline Intelligence';
const SITE_HERO_DESCRIPTION =
  'Track every asset change over time with AI for maintenance, claims, compliance, and reporting.';
const SITE_FOOTER_TAGLINE = SITE_HERO_DESCRIPTION;

/** Show back-to-top when within this many px of the scroll bottom. */
const SCROLL_TOP_NEAR_BOTTOM_PX = 120;
/** Ignore back-to-top until the user has scrolled past the hero. */
const SCROLL_TOP_MIN_OFFSET_PX = 240;

/** Wordmark AI cap height ≈ lowercase m in AssetMem (18px when brand is 24px). */
const HERO_BRAND_FONT_SIZE = 24;
const HERO_BRAND_AI_FONT_SIZE = Math.round(HERO_BRAND_FONT_SIZE * 0.75);

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Capture the property',
    desc: 'Structured photos and documents on site—per home or across a portfolio.',
  },
  {
    step: 2,
    title: 'See what changed',
    desc: 'AI condition scoring and answers grounded in your evidence.',
  },
  {
    step: 3,
    title: 'Know what to do',
    desc: 'AI-suggested costs, repair paths, and coverage context without tab-hopping.',
  },
  {
    step: 4,
    title: 'Prove it later',
    desc: 'Formal reports and share links for owners, tenants, or adjusters.',
  },
] as const;

const AI_EVIDENCE_IN = [
  'Field & inspection photos',
  'Policies & vendor records',
  'Team questions',
  'Condition over time',
] as const;

const AI_FOCUSED_ANALYSIS = [
  'Coverage & policies',
  'Repair guidance',
  'Vendor matches',
  'Cost outlook',
  'Change detection',
] as const;

const AI_CLEAR_OUTPUTS = [
  'Condition score',
  'Fix first',
  'Repair playbook',
  'Budget outlook',
  'Trusted vendors',
  'Shareable reports',
] as const;

const USE_CASES: ReadonlyArray<{
  title: string;
  scenario: string;
  icon: LucideIcon;
  color: string;
  steps: readonly string[];
  result: string;
}> = [
  {
    title: 'Portfolio inspection cadence',
    scenario: 'Capture spring and fall walkthroughs for each area',
    icon: Zap,
    color: LANDING_COLORS.accent,
    steps: [
      'Capture structured walkthrough photos for roof, exterior, basement, and HVAC',
      'Track AI-scored condition shifts by area across each season',
      'Highlight recurring moisture and weather-related wear',
      'Build a clear maintenance backlog before issues escalate',
    ],
    result: 'Proactive portfolio plan that prevented in-season surprises',
  },
  {
    title: 'Early risk detection across units',
    scenario: 'Monitor basement moisture over 6-month winter period',
    icon: TrendingUp,
    color: LANDING_COLORS.primary,
    steps: [
      'Capture monthly walkthrough photos',
      'AI detects condition score drop: 78 → 65 (attention needed)',
      'AI highlights increased moisture and wall staining',
      'Get preventive maintenance recommendations before major damage',
    ],
    result: 'Caught water issue early, prevented $5,000+ damage',
  },
  {
    title: 'Turnover documentation at scale',
    scenario: 'Document condition at lease start and end for security deposits',
    icon: FileText,
    color: LANDING_COLORS.accent,
    steps: [
      'Capture move-in walkthroughs room by room',
      'At move-out, generate a comparison report with before/after photos',
      'Review issue tables and change callouts automatically',
      'Share the report with your landlord or tenant',
    ],
    result: 'Resolved deposit dispute with dated, AI-verified evidence',
  },
  {
    title: 'Claims evidence for adjusters',
    scenario: 'Storm damage to roof requires insurance claim proof',
    icon: FileText,
    color: LANDING_COLORS.primary,
    steps: [
      'Platform compares before/after evidence from prior walkthroughs',
      'AI detects: missing shingles, damaged flashing, water damage',
      'Generate a formal report with photos, issue tables, and change highlights',
      'Share the report and comparisons with your insurance adjuster',
    ],
    result: 'Claim approved in 3 days with AI-verified documentation',
  },
  {
    title: 'Vendor handoff',
    scenario: 'Share AI findings with contractors without granting account access',
    icon: Share2,
    color: LANDING_COLORS.primary,
    steps: [
      'Run issue analysis on captured evidence',
      'Generate a formal report or share a secure evidence link',
      'Contractor reviews evidence without a login',
      'Everyone works from the same AI-verified source of truth',
    ],
    result: 'Faster approvals with less back-and-forth email',
  },
  {
    title: 'Renovation Progress Tracking',
    scenario: 'Track kitchen and bath updates across contractor visits',
    icon: Settings,
    color: LANDING_COLORS.accent,
    steps: [
      'Capture before/after walkthroughs for each milestone',
      'Use AI comparisons to track workmanship and finish quality over time',
      'Attach invoices, warranties, and notes to each milestone',
      'Share a secure evidence link with your contractor or family',
    ],
    result: 'Kept everyone aligned with one source of truth',
  },
];

const ENTERPRISE_SEGMENTS: ReadonlyArray<{
  title: string;
  desc: string;
  icon: LucideIcon;
  path: string;
}> = [
  {
    title: 'Property managers, rentals & hospitality',
    desc: 'Portfolio-wide turnovers, walkthroughs, and maintenance evidence.',
    icon: Building2,
    path: '/solutions/property-managers',
  },
  {
    title: 'Insurers & adjusters',
    desc: 'Carrier-grade claim packs with timestamped photos, condition metrics, and formal reports.',
    icon: Shield,
    path: '/solutions/insurance',
  },
  {
    title: 'Service & field teams',
    desc: 'Dispatch-ready mobile capture, on-site AI analysis, and report handoffs to operations.',
    icon: MapPin,
    path: '/solutions/field-teams',
  },
  {
    title: 'Prop-tech platforms',
    desc: 'Embeddable evidence layer and document intelligence—co-designed with your product team.',
    icon: LayoutGrid,
    path: '/solutions/platform',
  },
];

const ENTERPRISE_INCLUDED = [
  'Standardized field capture with AI condition scores across properties',
  'Audit-ready reports for claims, turnovers, and portfolio reviews',
  'Document intelligence on inspections, policies, and vendor records',
  'Secure share links for reports, evidence packs, and stakeholder review',
] as const;

const ENTERPRISE_CO_DESIGNED = [
  'Workflow templates for your team',
  'Portfolio rollups and reporting cadence',
  'Integrations with your existing tools',
] as const;

function SectionBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: LANDING_COLORS.primaryLight,
        borderWidth: 1,
        borderColor: LANDING_COLORS.primaryBorder,
        marginBottom: 24,
      }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
        {label}
      </Text>
    </View>
  );
}

function PipelineConnector() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
      <View
        style={{
          width: 2,
          height: 20,
          borderRadius: 1,
          backgroundColor: 'rgba(34,211,238,0.5)',
        }}
      />
      <ChevronDown size={14} color={LANDING_COLORS.primary} style={{ marginTop: -2 }} />
    </View>
  );
}

function ChipGrid({ items, accentIndex }: { items: readonly string[]; accentIndex?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((label, i) => {
        const isAccent = accentIndex === i;
        return (
          <View
            key={label}
            style={{
              width: '47%',
              flexGrow: 1,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isAccent ? 'rgba(249,115,22,0.35)' : LANDING_COLORS.border,
              backgroundColor: isAccent ? 'rgba(249,115,22,0.07)' : 'rgba(20,20,28,0.8)',
              paddingHorizontal: 10,
              paddingVertical: 10,
            }}>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 15,
                color: isAccent ? '#fdba74' : LANDING_COLORS.foreground,
              }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const webAppOrigin = getWebAppOrigin();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const showScrollTopRef = useRef(false);
  const { height: windowHeight } = useWindowDimensions();
  const heroMinHeight = Math.round(windowHeight * 0.88);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string>(DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile);
  const [enterpriseConfig, setEnterpriseConfig] = useState<EnterpriseConfig>(() =>
    getEnterpriseConfigFromEnv(),
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLandingRemoteConfig = async () => {
      const remote = await fetchLandingRemoteConfig();
      if (!cancelled) {
        setDemoVideoUrl(remote.demoVideos.mobile);
        setEnterpriseConfig(remote.enterprise);
      }
    };

    void loadLandingRemoteConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: LANDING_COLORS.background,
        }}
      />
    );
  }

  const handleGetStarted = () => {
    if (user) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/auth/login');
    }
  };

  const handleWatchDemo = () => {
    if (getYouTubeVideoId(demoVideoUrl)) {
      setDemoVisible(true);
      return;
    }
    void openExternalWebUrl(demoVideoUrl);
  };

  const openEnterpriseMailto = () => {
    void Linking.openURL(getEnterpriseMailtoHref(enterpriseConfig.enterpriseEmail));
  };

  const handleLandingScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nextVisible =
      contentOffset.y > SCROLL_TOP_MIN_OFFSET_PX &&
      distanceFromBottom <= SCROLL_TOP_NEAR_BOTTOM_PX;
    if (nextVisible === showScrollTopRef.current) {
      return;
    }
    showScrollTopRef.current = nextVisible;
    setShowScrollTop(nextVisible);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: LANDING_COLORS.background }} edges={['top', 'bottom']}>
      <LandingDemoVideoModal
        visible={demoVisible}
        onClose={() => setDemoVisible(false)}
        videoUrl={demoVideoUrl}
      />
      <ScrollView
        ref={scrollRef}
        onScroll={handleLandingScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        style={{ flex: 1, backgroundColor: LANDING_COLORS.background }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Hero — full-viewport first screen; fade-in only applies here */}
          <LandingHeroBackground
            style={{ minHeight: heroMinHeight }}
            contentStyle={{
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 28,
              paddingBottom: 36,
              justifyContent: 'space-between',
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View style={{ marginRight: 12, flexShrink: 0 }}>
                <AssetMemBrandIcon variant="mark" size="md" markTheme="landing" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                <Text
                  style={{
                    fontSize: HERO_BRAND_FONT_SIZE,
                    fontWeight: '300',
                    color: LANDING_COLORS.foreground,
                    lineHeight: HERO_BRAND_FONT_SIZE,
                    includeFontPadding: false,
                  }}>
                  AssetMem
                </Text>
                <LandingGradientText
                  inline
                  style={{
                    fontSize: HERO_BRAND_AI_FONT_SIZE,
                    fontWeight: '700',
                    letterSpacing: 0.4,
                  }}>
                  AI
                </LandingGradientText>
              </View>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', paddingVertical: 32 }}>
              <Text
                style={{
                  fontSize: 52,
                  fontWeight: '300',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 24,
                  lineHeight: 58,
                  textAlign: 'center',
                }}>
                Timeline{'\n'}Intelligence
              </Text>

              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 28,
                  color: LANDING_COLORS.foreground60,
                  textAlign: 'center',
                  maxWidth: 340,
                }}>
                {SITE_HERO_DESCRIPTION}
              </Text>
            </View>

            <View style={{ gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={handleGetStarted}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 18,
                  paddingHorizontal: 32,
                  borderRadius: 12,
                  backgroundColor: LANDING_COLORS.primary,
                  gap: 8,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: LANDING_COLORS.background }}>
                  {user ? 'Dashboard' : 'Get Started'}
                </Text>
                <Icon as={ArrowRight} size={20} style={{ color: LANDING_COLORS.background }} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleWatchDemo}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 18,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: LANDING_COLORS.border,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: LANDING_COLORS.foreground }}>
                  Watch Demo
                </Text>
              </TouchableOpacity>
            </View>
          </LandingHeroBackground>
        </Animated.View>

          {/* How It Works */}
          <LandingSectionBackground
            backgroundColor={LANDING_COLORS.workflowSection}
            variant="workflow"
            style={{ paddingTop: 64, paddingBottom: 64, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <SectionBadge label="THE WORKFLOW" />
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '300',
                  textAlign: 'center',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 8,
                  lineHeight: 40,
                }}>
                From site visit to
              </Text>
              <LandingGradientText
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: 40,
                  marginBottom: 16,
                }}>
                evidence teams trust
              </LandingGradientText>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 24,
                }}>
                One AI-assisted workflow for a single home or a portfolio—capture, understand, act,
                and share without losing context.
              </Text>
            </View>

            <View style={{ gap: 28 }}>
              {WORKFLOW_STEPS.map((item) => (
                <View key={item.step} style={{ alignItems: 'center' }}>
                  <View style={{ marginBottom: 12 }}>
                    <LandingGradientBadge>
                      <Text style={{ fontSize: 20, fontWeight: 'bold', color: LANDING_COLORS.white }}>
                        {item.step}
                      </Text>
                    </LandingGradientBadge>
                  </View>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: LANDING_COLORS.foreground,
                      marginBottom: 8,
                      textAlign: 'center',
                    }}>
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 22,
                      color: LANDING_COLORS.mutedForeground,
                      textAlign: 'center',
                    }}>
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </LandingSectionBackground>

          {/* AI Intelligence Layer */}
          <LandingSectionBackground
            backgroundColor={LANDING_COLORS.background}
            variant="ai-pipeline"
            style={{ paddingTop: 64, paddingBottom: 64, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 32, paddingHorizontal: 4 }}>
              <SectionBadge label="AI INTELLIGENCE LAYER" />
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '300',
                  textAlign: 'center',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 8,
                  lineHeight: 40,
                }}>
                Spot changes early.
              </Text>
              <LandingGradientText
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: 40,
                  marginBottom: 16,
                }}>
                Move with confidence.
              </LandingGradientText>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 24,
                  maxWidth: 340,
                }}>
                Photos, documents, and questions feed one coordinated layer—from condition signals
                to prioritized next steps your team can act on.
              </Text>
            </View>

            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(34,211,238,0.15)',
                backgroundColor: 'rgba(12,18,32,0.7)',
                overflow: 'hidden',
              }}>
              <View
                style={{
                  padding: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: LANDING_COLORS.mutedForeground,
                    marginBottom: 12,
                  }}>
                  Evidence in
                </Text>
                <ChipGrid items={AI_EVIDENCE_IN} />
              </View>

              <PipelineConnector />

              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(34,211,238,0.35)',
                  backgroundColor: 'rgba(34,211,238,0.07)',
                  padding: 16,
                }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#a5f3fc', marginBottom: 4 }}>
                  AI smart coordination
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(165,243,252,0.6)', lineHeight: 18 }}>
                  Reads context across the property, surfaces what matters, routes to the right
                  analysis
                </Text>
              </View>

              <PipelineConnector />

              <View
                style={{
                  padding: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: LANDING_COLORS.mutedForeground,
                    marginBottom: 12,
                  }}>
                  Focused analysis
                </Text>
                <ChipGrid items={AI_FOCUSED_ANALYSIS} accentIndex={4} />
              </View>

              <PipelineConnector />

              <View style={{ padding: 20 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#67e8f9',
                    marginBottom: 12,
                  }}>
                  Clear outputs
                </Text>
                <ChipGrid items={AI_CLEAR_OUTPUTS} />
              </View>
            </View>
          </LandingSectionBackground>

          {/* Use Cases */}
          <LandingSectionBackground
            backgroundColor={LANDING_COLORS.background}
            variant="use-cases"
            style={{ paddingTop: 64, paddingBottom: 64, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <SectionBadge label="REAL-WORLD APPLICATIONS" />
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '300',
                  textAlign: 'center',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 8,
                  lineHeight: 40,
                }}>
                See How AssetMem
              </Text>
              <LandingGradientText
                variant="cyan-white"
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: 40,
                  marginBottom: 16,
                }}>
                Solves Real Problems
              </LandingGradientText>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 24,
                }}>
                From routine walkthroughs to claims documentation, see how one evidence workflow
                supports single homes and multi-property operations.
              </Text>
            </View>

            <View style={{ gap: 24 }}>
              {USE_CASES.map((useCase) => (
                <View
                  key={useCase.title}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: LANDING_COLORS.border,
                    backgroundColor: 'rgba(20,20,28,0.6)',
                    padding: 20,
                  }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginBottom: 16,
                    }}>
                    <View style={{ flexShrink: 0 }}>
                      <LandingGradientBadge
                        size={48}
                        borderRadius={12}
                        colors={[useCase.color, withHexAlpha(useCase.color, '99')]}>
                        <Icon as={useCase.icon} size={24} style={{ color: LANDING_COLORS.white }} />
                      </LandingGradientBadge>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: LANDING_COLORS.foreground,
                          marginBottom: 4,
                        }}>
                        {useCase.title}
                      </Text>
                      <Text
                        style={{ fontSize: 13, fontWeight: '500', color: LANDING_COLORS.mutedForeground }}>
                        {useCase.scenario}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 10, marginBottom: 16 }}>
                    {useCase.steps.map((step, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: LANDING_COLORS.primary20,
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                          }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: LANDING_COLORS.primary }}>
                            {idx + 1}
                          </Text>
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 13,
                            lineHeight: 19,
                            color: LANDING_COLORS.foreground90,
                          }}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View
                    style={{
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: LANDING_COLORS.border,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}>
                    <Icon as={CheckCircle} size={18} style={{ color: useCase.color, marginTop: 1 }} />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: '600',
                        color: useCase.color,
                        lineHeight: 18,
                      }}>
                      {useCase.result}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </LandingSectionBackground>

          {/* Enterprise */}
          <LandingSectionBackground
            backgroundColor={LANDING_COLORS.workflowSection}
            variant="enterprise"
            style={{ paddingTop: 64, paddingBottom: 64, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 32, paddingHorizontal: 4 }}>
              <SectionBadge label="FOR ENTERPRISE" />
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '300',
                  textAlign: 'center',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 8,
                  lineHeight: 40,
                }}>
                Built for
              </Text>
              <LandingGradientText
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: 40,
                  marginBottom: 16,
                }}>
                property operations{'\u00A0'}teams
              </LandingGradientText>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 24,
                  marginBottom: 12,
                  maxWidth: 340,
                }}>
                See how AssetMem captures evidence, generates audit-ready reports, and answers
                questions across a portfolio—with room to co-design workflows that fit your team.
              </Text>
              <TouchableOpacity onPress={() => void openExternalWebUrl(`${webAppOrigin}/solutions`)}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: LANDING_COLORS.primary,
                    textDecorationLine: 'underline',
                  }}>
                  Explore solutions by segment →
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 24, marginBottom: 24 }}>
              {ENTERPRISE_SEGMENTS.map((segment) => (
                <TouchableOpacity
                  key={segment.title}
                  onPress={() => void openExternalWebUrl(`${webAppOrigin}${segment.path}`)}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: LANDING_COLORS.border,
                    backgroundColor: 'rgba(20,20,28,0.6)',
                    padding: 20,
                  }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}>
                    <View style={{ flexShrink: 0 }}>
                      <LandingGradientBadge size={48} borderRadius={12}>
                        <Icon as={segment.icon} size={24} style={{ color: LANDING_COLORS.white }} />
                      </LandingGradientBadge>
                    </View>
                    <View style={{ flex: 1, paddingTop: 2 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: LANDING_COLORS.foreground,
                          marginBottom: 4,
                          lineHeight: 24,
                        }}>
                        {segment.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 19,
                          color: LANDING_COLORS.mutedForeground,
                        }}>
                        {segment.desc}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ gap: 16, marginBottom: 32 }}>
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                  backgroundColor: 'rgba(20,20,28,0.5)',
                  padding: 16,
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: LANDING_COLORS.primary,
                    marginBottom: 12,
                  }}>
                  Included today
                </Text>
                {ENTERPRISE_INCLUDED.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <Text style={{ color: LANDING_COLORS.primary }}>✓</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: LANDING_COLORS.foreground, lineHeight: 18 }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                  backgroundColor: 'rgba(20,20,28,0.5)',
                  padding: 16,
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: LANDING_COLORS.mutedForeground,
                    marginBottom: 12,
                  }}>
                  Co-designed with you
                </Text>
                {ENTERPRISE_CO_DESIGNED.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <Text style={{ color: LANDING_COLORS.mutedForeground }}>→</Text>
                    <Text
                      style={{ flex: 1, fontSize: 13, color: LANDING_COLORS.mutedForeground, lineHeight: 18 }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ alignItems: 'center', gap: 16, paddingHorizontal: 12 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: LANDING_COLORS.mutedForeground,
                  textAlign: 'center',
                  lineHeight: 22,
                  maxWidth: 300,
                }}>
                Share a bit about your team
              </Text>
              <TouchableOpacity
                onPress={openEnterpriseMailto}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 10,
                  backgroundColor: LANDING_COLORS.primary,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: LANDING_COLORS.background }}>
                  Get in touch
                </Text>
              </TouchableOpacity>
            </View>
          </LandingSectionBackground>

          {/* Pricing */}
          <LandingSectionBackground
            backgroundColor={LANDING_COLORS.background}
            variant="pricing"
            style={{ paddingTop: 64, paddingBottom: 64, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center' }}>
              <SectionBadge label="PRICING" />
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '300',
                  textAlign: 'center',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 8,
                  lineHeight: 40,
                }}>
                Choose
              </Text>
              <LandingGradientText
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: 40,
                  marginBottom: 16,
                }}>
                your plan
              </LandingGradientText>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 24,
                  marginBottom: 28,
                  maxWidth: 340,
                }}>
                Free, Plus, and Pro for everyday property care.{'\n'}
                Enterprise for portfolios and field operations.
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(`${webAppOrigin}#pricing`)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 28,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: LANDING_COLORS.border,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: LANDING_COLORS.foreground }}>
                  View plans on the web
                </Text>
              </TouchableOpacity>
            </View>
          </LandingSectionBackground>

          {/* Footer */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: LANDING_COLORS.border,
              backgroundColor: LANDING_COLORS.background,
              paddingTop: 48,
              paddingBottom: 40,
              paddingHorizontal: 20,
            }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ marginRight: 10, flexShrink: 0 }}>
                  <AssetMemBrandIcon variant="mark" size="sm" markTheme="landing" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '300',
                      lineHeight: 18,
                      includeFontPadding: false,
                      color: LANDING_COLORS.foreground,
                    }}>
                    AssetMem
                  </Text>
                  <LandingGradientText
                    inline
                    style={{
                      fontSize: Math.round(18 * 0.75),
                      fontWeight: 'bold',
                      letterSpacing: 0.4,
                    }}>
                    AI
                  </LandingGradientText>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  textAlign: 'center',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 22,
                  marginBottom: 20,
                }}>
                {SITE_FOOTER_TAGLINE}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${enterpriseConfig.supportEmail}`)}>
                <Text
                  style={{
                    fontSize: 14,
                    color: LANDING_COLORS.primary,
                    marginBottom: 20,
                    textDecorationLine: 'underline',
                  }}>
                  {enterpriseConfig.supportEmail}
                </Text>
              </TouchableOpacity>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: 16,
                  marginBottom: 20,
                }}>
                {[
                  { label: 'Solutions', href: `${webAppOrigin}/solutions` },
                  { label: 'About', href: `${webAppOrigin}/about` },
                  { label: 'Privacy', href: `${webAppOrigin}/privacy` },
                  { label: 'Terms', href: `${webAppOrigin}/terms` },
                  { label: 'Delete account', href: `${webAppOrigin}/account-deletion` },
                ].map((link) => (
                  <TouchableOpacity key={link.label} onPress={() => Linking.openURL(link.href)}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: LANDING_COLORS.mutedForeground,
                        textDecorationLine: 'underline',
                      }}>
                      {link.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12, textAlign: 'center', color: LANDING_COLORS.mutedForeground }}>
                © {new Date().getFullYear()} AssetMem AI. All rights reserved.
              </Text>
            </View>
          </View>
      </ScrollView>
      {showScrollTop ? (
        <TouchableOpacity
          onPress={scrollToTop}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
          style={{
            position: 'absolute',
            right: 20,
            bottom: insets.bottom + 16,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: LANDING_COLORS.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: LANDING_COLORS.primaryBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 6,
          }}>
          <Icon as={ChevronUp} size={22} style={{ color: LANDING_COLORS.background }} />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}
