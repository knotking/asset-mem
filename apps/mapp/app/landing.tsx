import React, { useEffect, useState } from 'react';
import { View, ScrollView, Image, Animated, TouchableOpacity, Linking, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { Icon } from '../components/ui/icon';
import {
  Zap,
  CheckCircle,
  TrendingUp,
  ImageIcon,
  FileText,
  Settings,
  DollarSign,
  Clock,
  ArrowRight,
  Users,
  Share2,
  Home,
  ClipboardList,
} from 'lucide-react-native';
import { AssetMemBrandIcon } from '@/components/AssetMemBrandIcon';
import { LandingDemoVideoModal } from '@/components/landing/LandingDemoVideoModal';
import { openExternalWebUrl } from '@/lib/open-external-url';
import { getYouTubeVideoId } from '@/lib/youtube-utils';

// Dark theme - landing page only (matching webapp)
const LANDING_COLORS = {
  primary: '#22d3ee',
  primaryHover: 'rgba(34, 211, 238, 0.9)',
  primaryLight: 'rgba(34, 211, 238, 0.1)',
  primaryBorder: 'rgba(34, 211, 238, 0.2)',
  primary20: 'rgba(34, 211, 238, 0.2)',
  primary10: 'rgba(34, 211, 238, 0.1)',
  background: '#0a0a0f',
  backgroundOverlay: 'rgba(10, 10, 15, 0.85)',
  background95: 'rgba(10, 10, 15, 0.95)',
  foreground: '#fafafa',
  foreground90: 'rgba(250, 250, 250, 0.9)',
  foreground70: 'rgba(250, 250, 250, 0.7)',
  foreground60: 'rgba(250, 250, 250, 0.6)',
  card: '#14141c',
  cardOverlay: 'rgba(20, 20, 28, 0.5)',
  muted: '#14141c',
  muted30: 'rgba(255, 255, 255, 0.08)',
  mutedForeground: 'rgba(255, 255, 255, 0.65)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderOverlay: 'rgba(255, 255, 255, 0.1)',
  border50: 'rgba(255, 255, 255, 0.12)',
  secondary: '#22d3ee',
  secondaryLight: 'rgba(34, 211, 238, 0.1)',
  secondaryBorder: 'rgba(34, 211, 238, 0.2)',
  accent: '#f97316',
  accentLight: 'rgba(249, 115, 22, 0.1)',
  accent10: 'rgba(249, 115, 22, 0.1)',
  white: 'rgb(255, 255, 255)',
};

const features = [
  {
    title: 'Timeline',
    desc: 'Take photos and videos over time and build a visual history for every room and area.',
    icon: Zap,
  },
  {
    title: 'Property Checkpoints',
    desc: 'See simple condition scores and trends so you know what needs attention first.',
    icon: ImageIcon,
  },
  {
    title: 'Two Ways to Chat',
    desc: 'Ask about your documents, or chat about photos from your timeline. Switch anytime.',
    icon: FileText,
  },
  {
    title: 'Before & After Comparisons',
    desc: 'Line up two visits side by side and clearly see what changed.',
    icon: ImageIcon,
  },
  {
    title: 'My pros',
    desc: 'Save local pros the AI recommends and find them again on the property Details tab.',
    icon: Users,
  },
  {
    title: 'Share Your Answers',
    desc: 'Send a read-only link to a chat so contractors or family can see what the AI found.',
    icon: Share2,
  },
  {
    title: 'Multiple Properties',
    desc: 'Manage every home or rental from one account—each with its own timeline, docs, and chats.',
    icon: Home,
  },
  {
    title: 'Property Reports',
    desc: 'Turn checkpoint photos into branded PDFs—snapshot for showings, comparison for move-in/out, or insurance documentation. Share or download.',
    icon: FileText,
  },
  {
    title: 'Repair Guidance',
    desc: 'Get clear next steps, cost ranges, and product ideas without reading long reports.',
    icon: DollarSign,
  },
];

const reportPurposes = [
  {
    title: 'Showing / listing',
    desc: 'Single-date condition snapshot with executive summary, room status, and headline metrics—ideal before or after a showing.',
  },
  {
    title: 'Move-in / move-out',
    desc: 'Compare two periods with before/after photos, issue tables, and visual-diff callouts—built for security deposits and lease records.',
  },
  {
    title: 'Insurance / claim',
    desc: 'Document damage with photos, metrics, and change highlights in a formal PDF you can attach to a claim or share with an adjuster.',
  },
];

const steps = [
  {
    step: 1,
    title: 'Add Your Property',
    desc: 'Create a property, upload documents, and take your first photos. Add as many properties as you need.',
  },
  {
    step: 2,
    title: 'Ask Questions',
    desc: 'Chat with your paperwork or your timeline photos. Turn on extra help for coverage, repairs, costs, or local pros.',
  },
  {
    step: 3,
    title: 'Get Clear Answers',
    desc: 'See costs, repair steps, comparisons, and provider ideas in one easy-to-read conversation.',
  },
  {
    step: 4,
    title: 'Stay Organized',
    desc: 'Save providers, generate PDF reports, share chat or report links, and check your timeline whenever you need to follow up.',
  },
];

const WEB_APP_BASE = 'https://asset-mem.com';
const DEMO_VIDEO_URL = 'https://youtu.be/vh0J8DWupkI';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [demoVisible, setDemoVisible] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: LANDING_COLORS.background,
        }}>
        {/* Minimal loading state */}
      </View>
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
    if (getYouTubeVideoId(DEMO_VIDEO_URL)) {
      setDemoVisible(true);
      return;
    }
    void openExternalWebUrl(DEMO_VIDEO_URL);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: LANDING_COLORS.background }} edges={['top', 'bottom']}>
    <LandingDemoVideoModal
      visible={demoVisible}
      onClose={() => setDemoVisible(false)}
      videoUrl={DEMO_VIDEO_URL}
    />
    <ScrollView
      style={{ flex: 1, backgroundColor: LANDING_COLORS.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Hero Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 20,
            paddingBottom: 40,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center' }}>
            {/* Logo/Brand */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
              <View style={{ marginRight: 12, flexShrink: 0 }}>
                <AssetMemBrandIcon variant="mark" size="md" markTheme="landing" />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '300',
                  color: LANDING_COLORS.foreground,
                  lineHeight: 32,
                  flexShrink: 0,
                  includeFontPadding: false,
                }}>
                AssetMem <Text style={{ fontWeight: 'bold' }}>AI</Text>
              </Text>
            </View>

            {/* Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: LANDING_COLORS.primaryLight,
                borderWidth: 1,
                borderColor: LANDING_COLORS.primaryBorder,
                marginBottom: 36,
                gap: 8,
              }}>
              <Icon as={Zap} size={16} style={{ color: LANDING_COLORS.primary }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                AI-POWERED INNOVATION
              </Text>
            </View>

            {/* Main Heading */}
            <Text
              style={{
                fontSize: 48,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 24,
                lineHeight: 56,
                paddingHorizontal: 10,
              }}>
              AssetMem{'\n'}
              <Text
                style={{
                  fontWeight: 'bold',
                  color: LANDING_COLORS.primary,
                }}>
                AI
              </Text>
            </Text>

            <Text
              style={{
                fontSize: 24,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground90,
                marginBottom: 16,
                paddingHorizontal: 10,
                lineHeight: 32,
              }}>
              Your Complete{'\n'}
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '300',
                  color: LANDING_COLORS.foreground90,
                }}>
                Property Care Platform
              </Text>
            </Text>

            <Text
              style={{
                fontSize: 18,
                textAlign: 'center',
                color: LANDING_COLORS.foreground60,
                marginBottom: 48,
                paddingHorizontal: 20,
                lineHeight: 28,
              }}>
              AI agents analyze your property photos and documents, rate condition over time, flag
              issues, generate formal PDF reports, and guide you on repairs and costs while
              connecting you with local pros.
            </Text>

            {/* CTA Buttons */}
            <View
              style={{
                flexDirection: 'column',
                gap: 12,
                marginBottom: 48,
                paddingHorizontal: 20,
                width: '100%',
              }}>
              <TouchableOpacity
                onPress={handleGetStarted}
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 20,
                  paddingHorizontal: 32,
                  borderRadius: 12,
                  backgroundColor: LANDING_COLORS.primary,
                  shadowColor: LANDING_COLORS.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
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
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 20,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: LANDING_COLORS.border,
                  gap: 8,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: LANDING_COLORS.foreground }}>
                  Watch Demo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Use Cases Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                marginBottom: 36,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                REAL-WORLD APPLICATIONS
              </Text>
            </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 20,
                paddingHorizontal: 10,
                lineHeight: 40,
              }}>
              See How AssetMem{'\n'}
              <Text style={{ fontWeight: 'bold', color: LANDING_COLORS.primary }}>
                Solves Real Problems
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 20,
                lineHeight: 24,
                marginBottom: 16,
              }}>
              From routine walkthroughs to seasonal planning, see how checkpoint-driven workflows
              help homeowners and landlords stay ahead
            </Text>
          </View>

          <View style={{ gap: 24 }}>
            {[
              {
                title: 'Seasonal Property Walkthrough',
                scenario: 'Capture spring and fall walkthroughs for each area',
                icon: Zap,
                color: LANDING_COLORS.accent,
                steps: [
                  'Create checkpoints for roof, exterior, basement, and HVAC',
                  'Track condition shifts by area across each season',
                  'Highlight recurring moisture and weather-related wear',
                  'Build a clear maintenance backlog before issues escalate',
                ],
                result: 'Built a proactive plan that prevented in-season surprises',
              },
              {
                title: 'Property Condition Tracking',
                scenario: 'Monitor basement moisture over 6-month winter period',
                icon: TrendingUp,
                color: LANDING_COLORS.primary,
                steps: [
                  'Create monthly checkpoints with photos',
                  'AI detects condition score drop: 78 → 65 (attention needed)',
                  'Platform identifies increased moisture + wall staining',
                  'Get preventive maintenance recommendations before major damage',
                ],
                result: 'Caught water issue early, prevented $5,000+ damage',
              },
              {
                title: 'Rental Move-In / Move-Out',
                scenario: 'Document condition at lease start and end for security deposits',
                icon: FileText,
                color: LANDING_COLORS.accent,
                steps: [
                  'Capture move-in checkpoints room by room',
                  'At move-out, generate a comparison report with before/after photos',
                  'Review issue tables and visual-diff callouts automatically',
                  'Share the PDF with your landlord or tenant',
                ],
                result: 'Resolved deposit dispute with dated, AI-verified evidence',
              },
              {
                title: 'Insurance Claim Documentation',
                scenario: 'Storm damage to roof requires insurance claim proof',
                icon: FileText,
                color: LANDING_COLORS.primary,
                steps: [
                  'Platform auto-compares before/after checkpoint photos',
                  'AI detects: missing shingles, damaged flashing, water damage',
                  'Generate a formal PDF report with photos, issue tables, and change highlights',
                  'Share the report and comparisons with your insurance adjuster',
                ],
                result: 'Claim approved in 3 days with AI-verified documentation',
              },
              {
                title: 'Home Inspection Follow-up',
                scenario: '50-page inspection report with 15 issues to address',
                icon: FileText,
                color: LANDING_COLORS.primary,
                steps: [
                  'Upload inspection PDF → AI indexes all issues',
                  'Ask: "What are the critical issues?" → Get prioritized list',
                  'Chat: "Cost to fix the roof?" → $4,500-$7,200 estimate',
                  'Find local roofers, compare quotes, check warranty coverage',
                ],
                result: 'Prioritized repairs, negotiated 20% discount with quotes',
              },
              {
                title: 'Renovation Progress Tracking',
                scenario: 'Track kitchen and bath updates across contractor visits',
                icon: Settings,
                color: LANDING_COLORS.accent,
                steps: [
                  'Capture before/after checkpoints for each milestone',
                  'Compare workmanship and finish quality over time',
                  'Attach invoices, warranties, and notes to each checkpoint',
                  'Share a read-only chat link with your contractor or family',
                ],
                result: 'Kept everyone aligned with one source of truth',
              },
            ].map((useCase) => (
              <View
                key={useCase.title}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                  backgroundColor: 'rgba(20,20,28,0.6)',
                  padding: 20,
                }}>
                {/* Icon and Title */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 16,
                  }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: useCase.color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}>
                    <Icon as={useCase.icon} size={24} style={{ color: LANDING_COLORS.white }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: LANDING_COLORS.foreground,
                        marginBottom: 4,
                        lineHeight: 24,
                      }}>
                      {useCase.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: LANDING_COLORS.mutedForeground,
                        lineHeight: 18,
                      }}>
                      {useCase.scenario}
                    </Text>
                  </View>
                </View>

                {/* Steps */}
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {useCase.steps.map((step, idx) => (
                    <View
                      key={idx}
                      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
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
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: LANDING_COLORS.primary,
                          }}>
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

                {/* Result */}
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
        </View>

        {/* Features Section */}
        <View
          style={{
            backgroundColor: '#0f0f14',
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                marginBottom: 36,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                INTEGRATED PLATFORM SERVICES
              </Text>
            </View>
            <Text
              style={{
                fontSize: 36,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 20,
                paddingHorizontal: 10,
                lineHeight: 44,
              }}>
              Everything You Need{'\n'}
              <Text style={{ fontWeight: 'bold' }}>In One Platform</Text>
            </Text>
            <Text
              style={{
                fontSize: 18,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 20,
                lineHeight: 26,
              }}>
              A unified platform where checkpoints, timeline insights, document management, and
              service planning work together seamlessly
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            {features.map((feature, i) => (
              <View
                key={feature.title}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  backgroundColor: 'rgba(20,20,28,0.6)',
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: LANDING_COLORS.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}>
                    <Icon as={feature.icon} size={28} style={{ color: LANDING_COLORS.white }} />
                  </View>
                  <View style={{ flex: 1, paddingTop: 2 }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: LANDING_COLORS.foreground,
                        marginBottom: 8,
                        lineHeight: 26,
                      }}>
                      {feature.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        lineHeight: 22,
                        color: LANDING_COLORS.mutedForeground,
                      }}>
                      {feature.desc}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Property Reports Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                marginBottom: 36,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                FORMAL PDF REPORTS
              </Text>
            </View>
            <Text
              style={{
                fontSize: 36,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 20,
                paddingHorizontal: 10,
                lineHeight: 44,
              }}>
              Turn Checkpoints Into{'\n'}
              <Text style={{ fontWeight: 'bold', color: LANDING_COLORS.primary }}>
                Shareable Reports
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 20,
                lineHeight: 24,
              }}>
              Generate branded PDFs from your timeline—frozen at generation time so what you share
              stays accurate. Pick a purpose, preview sections, then download or send a link.
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            {reportPurposes.map((item) => (
              <View
                key={item.title}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                  backgroundColor: 'rgba(20,20,28,0.6)',
                  padding: 20,
                }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: LANDING_COLORS.foreground,
                    marginBottom: 8,
                    lineHeight: 24,
                  }}>
                  {item.title}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 22,
                    color: LANDING_COLORS.mutedForeground,
                  }}>
                  {item.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* AI Agents Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                marginBottom: 36,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                CHECKPOINT-POWERED INTELLIGENCE
              </Text>
            </View>
            <Text
              style={{
                fontSize: 36,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 20,
                paddingHorizontal: 10,
                lineHeight: 44,
              }}>
              Platform Intelligence{'\n'}
              <Text style={{ fontWeight: 'bold' }}>Powered by AI Agents</Text>
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 20,
                lineHeight: 24,
              }}>
              Specialized agents work together—starting with your timeline photos or saved
              reports, then pulling in warranty checks, repair steps, local pros, and cost
              estimates when you need them
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            {[
              {
                title: 'Timeline Agent',
                desc: 'Looks at your photos and past visits first, then brings in other help when you ask a question.',
                icon: FileText,
              },
              {
                title: 'Coverage Agent',
                desc: 'Checks warranties, insurance, and service contracts against what your photos and documents show.',
                icon: CheckCircle,
              },
              {
                title: 'DIY Agent',
                desc: 'Walks you through fixes step by step, including tools, safety tips, and helpful product ideas.',
                icon: Settings,
              },
              {
                title: 'Service Agent',
                desc: 'Suggests nearby pros that fit the issue shown in your photos and notes.',
                icon: TrendingUp,
              },
              {
                title: 'Cost Agent',
                desc: 'Gives rough cost ranges and compares doing it yourself versus hiring someone.',
                icon: DollarSign,
              },
              {
                title: 'Report Agent',
                desc: 'Answers questions about saved property reports you attach in chat—using the frozen snapshot captured when each PDF was generated.',
                icon: ClipboardList,
              },
              {
                title: 'Working Together',
                desc: 'Everything stays connected—your photos, documents, saved reports, saved providers, and past chats feed into one clear answer.',
                icon: ImageIcon,
              },
            ].map((agent, i) => (
              <View
                key={agent.title}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  backgroundColor: 'rgba(20,20,28,0.6)',
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: LANDING_COLORS.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}>
                    <Icon as={agent.icon} size={28} style={{ color: LANDING_COLORS.white }} />
                  </View>
                  <View style={{ flex: 1, paddingTop: 2 }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: LANDING_COLORS.foreground,
                        marginBottom: 8,
                        lineHeight: 26,
                      }}>
                      {agent.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        lineHeight: 22,
                        color: LANDING_COLORS.mutedForeground,
                      }}>
                      {agent.desc}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Timeline Feature Details - Property Checkpoints */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ gap: 40 }}>
            <View>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '300',
                  color: LANDING_COLORS.foreground,
                  marginBottom: 16,
                  lineHeight: 40,
                }}>
                Property Checkpoints:{'\n'}
                <Text style={{ fontWeight: 'bold', color: LANDING_COLORS.primary }}>
                  Your Timeline
                </Text>
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '300',
                  color: LANDING_COLORS.mutedForeground,
                  lineHeight: 26,
                }}>
                Photos, scores, before/after—and health metrics that help you stay ahead.
              </Text>
            </View>

            <View style={{ gap: 20 }}>
              {[
                {
                  title: 'Timeline Capture',
                  desc: 'Snap photos and videos over time, spot changes with before-and-after views, and let AI summarize what it sees.',
                  icon: ImageIcon,
                },
                {
                  title: 'AI-Powered Analysis',
                  desc: 'Get a simple condition score, see what looks damaged, and understand how serious each issue is.',
                  icon: TrendingUp,
                },
                {
                  title: 'Automatic Comparison',
                  desc: 'Compare a new visit to an older one and see what changed—with settings you can adjust anytime.',
                  icon: CheckCircle,
                },
                {
                  title: 'Timeline Comparisons',
                  desc: 'Scroll through your history and open side-by-side views whenever you need proof of progress or damage.',
                  icon: Clock,
                },
                {
                  title: 'Property Health Metrics',
                  desc: 'See how your property is doing overall, which issues matter most, and whether things are getting better or worse.',
                  icon: TrendingUp,
                },
                {
                  title: 'Always Up to Date',
                  desc: 'New photos and results show up right away—no need to refresh or wait around.',
                  icon: Zap,
                },
                {
                  title: 'Property Reports',
                  desc: 'Generate branded PDF snapshots or before/after comparison reports from your checkpoints—ready to share with insurers, tenants, or buyers.',
                  icon: FileText,
                },
              ].map((block, i) => (
                <View
                  key={block.title}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 16,
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(20,20,28,0.4)',
                    borderWidth: 1,
                    borderColor: LANDING_COLORS.border,
                  }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: LANDING_COLORS.primary20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}>
                    <Icon as={block.icon} size={24} style={{ color: LANDING_COLORS.primary }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: LANDING_COLORS.foreground,
                        marginBottom: 4,
                        lineHeight: 24,
                      }}>
                      {block.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        lineHeight: 20,
                        color: LANDING_COLORS.mutedForeground,
                      }}>
                      {block.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Document Chat Showcase Section */}
        <View
          style={{
            backgroundColor: '#0f0f14',
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                marginBottom: 36,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                TWO WAYS TO CHAT
              </Text>
            </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 20,
                paddingHorizontal: 10,
                lineHeight: 40,
              }}>
              Chat with Your{'\n'}
              <Text style={{ fontWeight: 'bold', color: LANDING_COLORS.primary }}>Docs or Photos</Text>
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 20,
                lineHeight: 24,
                marginBottom: 32,
              }}>
              <Text style={{ fontWeight: '600', color: LANDING_COLORS.foreground90 }}>Docs mode</Text>{' '}
              answers from your inspection reports, warranties, manuals, and policies—with sources
              cited.{' '}
              <Text style={{ fontWeight: '600', color: LANDING_COLORS.foreground90 }}>
                Timeline mode
              </Text>{' '}
              uses your photos and optional repair, coverage, cost, and provider help. Pick the mode
              that fits your question.
            </Text>
          </View>

          {/* Chat Example */}
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: LANDING_COLORS.border,
              backgroundColor: 'rgba(20,20,28,0.6)',
              padding: 20,
              marginBottom: 32,
            }}>
            <View style={{ gap: 16 }}>
              {/* User message */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View
                  style={{
                    maxWidth: '85%',
                    backgroundColor: LANDING_COLORS.primary,
                    borderRadius: 16,
                    padding: 12,
                  }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: '500', color: LANDING_COLORS.background }}>
                    What issues were found in my home inspection report?
                  </Text>
                </View>
              </View>

              {/* AI response */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '90%',
                    backgroundColor: LANDING_COLORS.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: LANDING_COLORS.border50,
                    padding: 12,
                  }}>
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 20,
                      color: LANDING_COLORS.foreground,
                      marginBottom: 12,
                    }}>
                    Based on your home inspection report, here are the key issues:
                  </Text>
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ color: LANDING_COLORS.accent, fontSize: 13 }}>•</Text>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          lineHeight: 19,
                          color: LANDING_COLORS.foreground90,
                        }}>
                        <Text style={{ fontWeight: 'bold' }}>Roof:</Text> Missing shingles on north
                        side, 5-7 years remaining life
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ color: LANDING_COLORS.accent, fontSize: 13 }}>•</Text>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          lineHeight: 19,
                          color: LANDING_COLORS.foreground90,
                        }}>
                        <Text style={{ fontWeight: 'bold' }}>HVAC:</Text> Air handler showing wear,
                        service within 6 months
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ color: LANDING_COLORS.accent, fontSize: 13 }}>•</Text>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          lineHeight: 19,
                          color: LANDING_COLORS.foreground90,
                        }}>
                        <Text style={{ fontWeight: 'bold' }}>Plumbing:</Text> Minor leak under
                        kitchen sink
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: LANDING_COLORS.border,
                    }}>
                    <Text style={{ fontSize: 11, color: LANDING_COLORS.mutedForeground }}>
                      📄 Citations: Home_Inspection_Report.pdf, Pages 3-7
                    </Text>
                  </View>
                </View>
              </View>

              {/* Follow-up question */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View
                  style={{
                    maxWidth: '85%',
                    backgroundColor: LANDING_COLORS.primary,
                    borderRadius: 16,
                    padding: 12,
                  }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: '500', color: LANDING_COLORS.background }}>
                    What's the estimated cost to fix the roof?
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Document Types */}
          <View style={{ gap: 16 }}>
            {[
              {
                title: 'Home Inspection Reports',
                desc: 'Quickly find issues, recommendations, and cost estimates from lengthy inspection documents.',
                icon: FileText,
              },
              {
                title: 'Warranty Coverage',
                desc: "Ask what's covered, expiration dates, and claim procedures without reading pages of fine print.",
                icon: CheckCircle,
              },
              {
                title: 'Appliance Manuals',
                desc: 'Get troubleshooting steps, maintenance schedules, and specifications instantly from your manuals.',
                icon: FileText,
              },
              {
                title: 'Insurance Policies',
                desc: 'Understand your coverage, deductibles, and exclusions through simple conversational queries.',
                icon: DollarSign,
              },
            ].map((item) => (
              <View
                key={item.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: 'rgba(20,20,28,0.4)',
                  borderWidth: 1,
                  borderColor: LANDING_COLORS.border,
                }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: LANDING_COLORS.primary20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}>
                  <Icon as={item.icon} size={20} style={{ color: LANDING_COLORS.primary }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: 'bold',
                      color: LANDING_COLORS.foreground,
                      marginBottom: 4,
                      lineHeight: 22,
                    }}>
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      color: LANDING_COLORS.mutedForeground,
                    }}>
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                marginBottom: 36,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                PLATFORM WORKFLOW
              </Text>
            </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 20,
                paddingHorizontal: 10,
                lineHeight: 40,
              }}>
              How the Platform Works
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 20,
                lineHeight: 24,
              }}>
              From your first photo to a clear plan—everything stays in one place
            </Text>
          </View>

          <View style={{ gap: 28 }}>
            {steps.map((item) => (
              <View
                key={item.step}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 20,
                }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    backgroundColor: LANDING_COLORS.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: LANDING_COLORS.white }}>
                    {item.step}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingTop: 6 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: LANDING_COLORS.foreground,
                      marginBottom: 8,
                      lineHeight: 24,
                    }}>
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 22,
                      color: LANDING_COLORS.mutedForeground,
                    }}>
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: LANDING_COLORS.primaryLight,
                borderWidth: 1,
                borderColor: LANDING_COLORS.primaryBorder,
                marginBottom: 24,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: LANDING_COLORS.primary }}>
                PRICING
              </Text>
            </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 16,
                lineHeight: 40,
              }}>
              Plans for homeowners and landlords
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                paddingHorizontal: 12,
                lineHeight: 24,
                marginBottom: 28,
              }}>
              Simple monthly plans with a fair amount of AI chat, document uploads, photo analysis,
              and property report generations. See what you have left anytime in Settings.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`${WEB_APP_BASE}#pricing`)}
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
        </View>

        {/* Final CTA Section */}
        <View
          style={{
            backgroundColor: '#0f0f14',
            paddingTop: 80,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 36,
                fontWeight: '300',
                textAlign: 'center',
                color: LANDING_COLORS.foreground,
                marginBottom: 24,
                paddingHorizontal: 10,
                lineHeight: 44,
              }}>
              Experience the Complete{'\n'}
              <Text style={{ fontWeight: 'bold', color: LANDING_COLORS.primary }}>
                Property Care Platform
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 18,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                marginBottom: 48,
                paddingHorizontal: 20,
                lineHeight: 26,
              }}>
              Join thousands of homeowners, landlords, and property managers using our unified platform for all
              their property care needs
            </Text>

            <TouchableOpacity
              onPress={handleGetStarted}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 24,
                paddingHorizontal: 48,
                borderRadius: 12,
                backgroundColor: LANDING_COLORS.primary,
                shadowColor: LANDING_COLORS.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 12,
                gap: 8,
              }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: LANDING_COLORS.background }}>
                {user ? 'Dashboard' : 'Get Started'}
              </Text>
              <Icon as={ArrowRight} size={24} style={{ color: LANDING_COLORS.background }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: LANDING_COLORS.border,
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 60,
            paddingBottom: 40,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ marginRight: 10, flexShrink: 0 }}>
                <AssetMemBrandIcon variant="mark" size="sm" markTheme="landing" />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '300',
                  color: LANDING_COLORS.foreground,
                  lineHeight: 24,
                  flexShrink: 0,
                  includeFontPadding: false,
                }}>
                AssetMem <Text style={{ fontWeight: 'bold' }}>AI</Text>
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
                lineHeight: 22,
                marginBottom: 20,
                paddingHorizontal: 8,
              }}>
              Photos, documents, and AI guidance for every property you manage.
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:support@asset-mem.com')}>
              <Text
                style={{
                  fontSize: 14,
                  color: LANDING_COLORS.primary,
                  marginBottom: 20,
                  textDecorationLine: 'underline',
                }}>
                support@asset-mem.com
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
                { label: 'About', href: `${WEB_APP_BASE}/about` },
                { label: 'Privacy', href: `${WEB_APP_BASE}/privacy` },
                { label: 'Terms', href: `${WEB_APP_BASE}/terms` },
                { label: 'Delete account', href: `${WEB_APP_BASE}/account-deletion` },
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
            <Text
              style={{
                fontSize: 12,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
              }}>
              © {new Date().getFullYear()} AssetMem AI. All rights reserved.
            </Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
    </SafeAreaView>
  );
}
