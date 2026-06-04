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
    title: 'Checkpoint Timeline',
    desc: 'Capture recurring walkthroughs, compare before/after states, and maintain a visual history for every area.',
    icon: Zap,
  },
  {
    title: 'Property Checkpoints',
    desc: 'Condition scoring and trend tracking that help you prioritize repairs and preventive tasks.',
    icon: ImageIcon,
  },
  {
    title: 'Chat with Your Documents',
    desc: 'Ask questions about your warranties, manuals, inspection reports, and policies—get instant answers with citations.',
    icon: FileText,
  },
  {
    title: 'Photo and Video Comparisons',
    desc: 'Review changes across checkpoints with visual diffs, similarity scoring, and contextual notes.',
    icon: ImageIcon,
  },
  {
    title: 'Service Marketplace',
    desc: 'Discover and connect with local providers based on checkpoint findings and maintenance priorities.',
    icon: Settings,
  },
  {
    title: 'Maintenance Planning',
    desc: 'Turn checkpoint trends into repair priorities, budget forecasts, and scheduling plans.',
    icon: DollarSign,
  },
];

const steps = [
  {
    step: 1,
    title: 'Upload & Connect',
    desc: 'Add documents, photos, videos, and create property checkpoints. Everything syncs to your unified platform.',
  },
  {
    step: 2,
    title: 'Platform Intelligence',
    desc: 'Platform intelligence analyzes checkpoint history and documents to highlight maintenance priorities.',
  },
  {
    step: 3,
    title: 'Unified Insights',
    desc: 'Get comprehensive answers: chat with documents, compare checkpoints, find services, and estimate costs—all integrated.',
  },
  {
    step: 4,
    title: 'Manage & Track',
    desc: 'Monitor property health, share with contractors, and keep everything organized in one place.',
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
                Home Care Platform
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
              A comprehensive platform centered on property checkpoints, condition timelines,
              document intelligence, and service planning, all working together to simplify your
              home care journey.
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
              help homeowners stay ahead
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
                  'Generate professional report',
                  'Export PDF for insurance adjuster',
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
                  'Share one visual timeline with your contractor and family',
                ],
                result: 'Kept everyone aligned with one source of truth',
              },
              {
                title: 'Preventive Maintenance',
                scenario: 'Proactive care to avoid repairs',
                icon: CheckCircle,
                color: LANDING_COLORS.primary,
                steps: [
                  'Monthly checkpoints track cabinets',
                  'Platform shows -0.5 pts/month decline',
                  'AI suggests refinishing in 3-6 months',
                  'Share timeline, get quote',
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
              Our multi-agent system is anchored on checkpoint intelligence: retrieve relevant
              property history first, then orchestrate coverage, DIY, service, and cost planning
              from the same checkpoint context
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            {[
              {
                title: 'Checkpoint Agent',
                desc: 'Retrieves relevant checkpoints using semantic vector search, then orchestrates coverage, DIY, service, and cost planning from the same checkpoint context.',
                icon: FileText,
              },
              {
                title: 'Coverage Agent',
                desc: 'Checks warranties, insurance policies, and service contracts using checkpoint context and supporting documents.',
                icon: CheckCircle,
              },
              {
                title: 'DIY Agent',
                desc: 'Provides step-by-step repair guidance aligned to checkpoint findings, required tools, safety notes, and effort estimates.',
                icon: Settings,
              },
              {
                title: 'Service Agent',
                desc: 'Finds local providers based on checkpoint location and condition details, with relevance for the required work.',
                icon: TrendingUp,
              },
              {
                title: 'Cost Agent',
                desc: 'Estimates costs from checkpoint evidence, comparing DIY and professional options with clearer budget planning.',
                icon: DollarSign,
              },
              {
                title: 'Platform Orchestration',
                desc: 'Checkpoint retrieval and checkpoint analysis coordinate downstream agents so recommendations stay grounded in timeline data.',
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
                  Your Visual Timeline
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
                  title: 'Visual Timeline',
                  desc: 'Capture photos/videos of property areas over time; track condition with before/after comparisons; AI-powered analysis; automatic room/area detection.',
                  icon: ImageIcon,
                },
                {
                  title: 'AI-Powered Analysis',
                  desc: 'Condition scoring (0–100); damage detection and severity; detected items/features; issue categories (critical, major, moderate, minor); cost estimates.',
                  icon: TrendingUp,
                },
                {
                  title: 'Automatic Comparison',
                  desc: 'Intelligent comparison with previous checkpoints; visual diff and similarity scoring; change detection; configurable comparison preferences.',
                  icon: CheckCircle,
                },
                {
                  title: 'Timeline (Before/After)',
                  desc: 'Visual timeline showing checkpoint changes over time with before/after comparisons and condition context.',
                  icon: Clock,
                },
                {
                  title: 'Property Health Metrics',
                  desc: 'Overall condition score and trend; issues summary by severity; deterioration rate; predictive maintenance insights.',
                  icon: TrendingUp,
                },
                {
                  title: 'Real-Time & Scalable',
                  desc: 'Non-blocking creation; real-time UI updates; built to scale.',
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
                INTELLIGENT DOCUMENT CHAT
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
              Talk to Your{'\n'}
              <Text style={{ fontWeight: 'bold', color: LANDING_COLORS.primary }}>Documents</Text>
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
              Upload your home inspection reports, warranties, manuals, and policies—then chat with
              them naturally
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
              From data upload to actionable insights—everything connected in one unified platform
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
                Home Care Platform
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
              Join thousands of homeowners and property managers using our unified platform for all
              their home care needs
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
