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
} from 'lucide-react-native';
import { AssetMemBrandIcon } from '@/components/AssetMemBrandIcon';

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
    desc: 'Save local pros the AI recommends and find them again in My pros from chat.',
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
    title: 'Repair Guidance',
    desc: 'Get clear next steps, cost ranges, and product ideas without reading long reports.',
    icon: DollarSign,
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
    desc: 'Save providers, share a chat link, and check your timeline whenever you need to follow up.',
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: LANDING_COLORS.background }} edges={['top', 'bottom']}>
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
              issues, and guide you on repairs and costs while connecting you with local pros.
            </Text>

            {/* CTA Buttons */}
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                marginBottom: 48,
                paddingHorizontal: 20,
                width: '100%',
              }}>
              <TouchableOpacity
                onPress={handleGetStarted}
                style={{
                  flex: 1,
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
                scenario: 'Monitor basement moisture over 6-month winter',
                icon: TrendingUp,
                color: LANDING_COLORS.primary,
                steps: [
                  'Create monthly checkpoints with photos',
                  'AI detects score drop: 78 → 65',
                  'Platform identifies moisture increase',
                  'Get preventive recommendations',
                ],
                result: 'Caught early, prevented $5K+ damage',
              },
              {
                title: 'Insurance Claim Documentation',
                scenario: 'Storm damage to roof requires proof',
                icon: FileText,
                color: LANDING_COLORS.primary,
                steps: [
                  'Auto-compare before/after photos',
                  'AI detects missing shingles, damage',
                  'Build a dated before-and-after story with photos',
                  'Share comparisons and notes with your adjuster',
                ],
                result: 'Claim approved in 3 days',
              },
              {
                title: 'Home Inspection Follow-up',
                scenario: '50-page report with 15 issues',
                icon: FileText,
                color: LANDING_COLORS.primary,
                steps: [
                  'Upload PDF → AI indexes issues',
                  'Ask: "Critical issues?" → Get list',
                  'Chat: "Cost to fix roof?" → Estimate',
                  'Find roofers, compare quotes',
                ],
                result: 'Negotiated 20% discount',
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
              {
                title: 'Preventive Maintenance',
                scenario: 'Proactive care to avoid repairs',
                icon: CheckCircle,
                color: LANDING_COLORS.primary,
                steps: [
                  'Monthly photos show cabinets slowly wearing down',
                  'Trends highlight what may need work soon',
                  'AI suggests refinishing before a full replacement',
                  'Share a chat link with your contractor and plan the budget',
                ],
                result: '$1.2K refinish vs $8K replacement',
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
              Specialized agents work together—starting with your timeline photos, then
              pulling in warranty checks, repair steps, local pros, and cost estimates when you
              need them
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
                title: 'Working Together',
                desc: 'Everything stays connected—your photos, documents, saved providers, and past chats feed into one clear answer.',
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
              Docs mode answers from your inspection reports, warranties, manuals, and policies.
              Timeline mode uses your photos plus optional repair, coverage, cost, and provider help.
              Pick the mode that fits your question.
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
              Simple monthly plans with a fair amount of AI chat, document uploads, and photo
              analysis. See what you have left anytime in Settings.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://asset-mem.com#pricing')}
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
                  marginBottom: 16,
                  textDecorationLine: 'underline',
                }}>
                support@asset-mem.com
              </Text>
            </TouchableOpacity>
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
