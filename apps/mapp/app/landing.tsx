import React, { useEffect, useState } from 'react';
import { View, ScrollView, Image, Animated, TouchableOpacity, Linking } from 'react-native';
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
  Home,
} from 'lucide-react-native';

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
    title: 'Instant Diagnostics',
    desc: 'AI-powered analysis that integrates with your property history and documents for contextual insights.',
    icon: Zap,
  },
  {
    title: 'Property Checkpoints',
    desc: 'Visual timeline with condition tracking that connects to diagnostics and service recommendations across the platform.',
    icon: ImageIcon,
  },
  {
    title: 'Chat with Your Documents',
    desc: 'Ask questions about your warranties, manuals, inspection reports, and policies—get instant answers with citations.',
    icon: FileText,
  },
  {
    title: 'Multimodal Analysis',
    desc: 'Unified AI analysis of photos, videos, and documents that enriches your entire platform experience.',
    icon: ImageIcon,
  },
  {
    title: 'Service Marketplace',
    desc: 'Seamlessly discover and connect with local providers based on your property diagnostics and needs.',
    icon: Settings,
  },
  {
    title: 'Integrated Cost Analysis',
    desc: 'Platform intelligence that combines diagnostics, coverage, and market data for accurate cost estimates.',
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
    desc: 'AI agents analyze across all your data—documents, checkpoints, and diagnostics work together seamlessly.',
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
    <ScrollView
      style={{ flex: 1, backgroundColor: LANDING_COLORS.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Hero Section */}
        <View
          style={{
            backgroundColor: LANDING_COLORS.background,
            paddingTop: 60,
            paddingBottom: 40,
            paddingHorizontal: 20,
          }}>
          <View style={{ alignItems: 'center' }}>
            {/* Logo/Brand */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: LANDING_COLORS.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                <Icon as={Home} size={20} style={{ color: LANDING_COLORS.white }} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '300', color: LANDING_COLORS.foreground }}>
                HomeGeek <Text style={{ fontWeight: 'bold' }}>AI</Text>
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
              HomeGeek{'\n'}
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
              }}>
              Your Complete{'\n'}
              <Text style={{ fontWeight: '500' }}>Home Care Platform</Text>
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
              A comprehensive platform that integrates AI diagnostics, property tracking, document
              intelligence, and service discovery—all working together seamlessly to simplify your
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
              See How HomeGeek{'\n'}
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
              From emergency repairs to preventive maintenance, see how our platform helps
              homeowners every day
            </Text>
          </View>

          <View style={{ gap: 24 }}>
            {[
              {
                title: 'Emergency Leak Repair',
                scenario: 'Water leak discovered under kitchen sink at 10 PM',
                icon: Zap,
                color: LANDING_COLORS.accent,
                steps: [
                  'Upload video → AI diagnoses loose P-trap',
                  'Get DIY guide + parts list ($25-50)',
                  'Find 3 emergency plumbers nearby',
                  'Compare: DIY $35 vs Pro $280-420',
                ],
                result: 'Fixed in 30 min, saved $350',
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
                title: 'HVAC System Diagnosis',
                scenario: 'AC not cooling during heatwave',
                icon: Settings,
                color: LANDING_COLORS.accent,
                steps: [
                  'Upload photos of AC + thermostat',
                  'AI diagnoses refrigerant leak',
                  'Check warranty: 2 years remaining',
                  'Get 5 authorized technicians',
                ],
                result: 'Warranty covered $800 repair',
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
              A unified platform where AI diagnostics, property tracking, document management, and
              service discovery work together seamlessly
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
                AI-POWERED INTELLIGENCE
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
              Our multi-agent AI system powers the entire platform, with specialized agents that
              share data and insights across all services
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            {[
              {
                title: 'Triage Agent',
                desc: 'Analyzes your issue to understand the problem, severity, and urgency. Identifies affected areas and determines the best course of action.',
                icon: FileText,
              },
              {
                title: 'Coverage Agent',
                desc: 'Searches your warranties, insurance policies, and service contracts to determine if your issue is covered.',
                icon: CheckCircle,
              },
              {
                title: 'DIY Agent',
                desc: 'Provides step-by-step instructions for fixing issues yourself. Includes tools, materials, safety precautions, and time estimates.',
                icon: Settings,
              },
              {
                title: 'Service Agent',
                desc: 'Finds qualified local service providers for your issue using location-based search with ratings and reviews.',
                icon: TrendingUp,
              },
              {
                title: 'Cost Agent',
                desc: 'Provides transparent cost estimates comparing DIY vs. professional service options with material costs and labor estimates.',
                icon: DollarSign,
              },
              {
                title: 'Platform Orchestration',
                desc: 'All agents share insights across the platform, connecting your diagnostics, documents, checkpoints, and services into one unified intelligence system.',
                icon: Zap,
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
                  desc: 'Visual timeline showing property condition changes over time with before/after photo comparisons and condition tracking.',
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
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: LANDING_COLORS.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10,
                }}>
                <Icon as={Home} size={16} style={{ color: LANDING_COLORS.white }} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '300', color: LANDING_COLORS.foreground }}>
                HomeGeek <Text style={{ fontWeight: 'bold' }}>AI</Text>
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                textAlign: 'center',
                color: LANDING_COLORS.mutedForeground,
              }}>
              © {new Date().getFullYear()} HomeGeek AI. All rights reserved.
            </Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}
