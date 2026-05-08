#!/usr/bin/env python3
"""Generate HomeApp PPTX presentation from PRESENTATION.md content."""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Brand colors
DARK_BG = RGBColor(0x1A, 0x23, 0x32)
ACCENT_BLUE = RGBColor(0x3B, 0x82, 0xF6)
LIGHT_BLUE = RGBColor(0x60, 0xA5, 0xFA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xE5, 0xE7, 0xEB)
MED_GRAY = RGBColor(0x9C, 0xA3, 0xAF)
GREEN = RGBColor(0x10, 0xB9, 0x81)
ORANGE = RGBColor(0xF5, 0x9E, 0x0B)
RED = RGBColor(0xEF, 0x44, 0x44)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

W = prs.slide_width
H = prs.slide_height

def set_slide_bg(slide, color=DARK_BG):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_shape_bg(slide, left, top, width, height, color):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape

def add_text_box(slide, left, top, width, height, text, font_size=18,
                 color=WHITE, bold=False, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox

def add_bullet_list(slide, left, top, width, height, items, font_size=16,
                    color=LIGHT_GRAY, bullet_color=ACCENT_BLUE):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        p.space_after = Pt(6)
        p.level = 0
    return txBox

def add_section_header(slide, title, subtitle=None):
    set_slide_bg(slide)
    # Accent line
    add_shape_bg(slide, Inches(0.8), Inches(2.8), Inches(1.5), Pt(4), ACCENT_BLUE)
    add_text_box(slide, Inches(0.8), Inches(3.0), Inches(11), Inches(1.5),
                 title, font_size=40, color=WHITE, bold=True)
    if subtitle:
        add_text_box(slide, Inches(0.8), Inches(4.3), Inches(11), Inches(1),
                     subtitle, font_size=20, color=MED_GRAY)

def add_content_slide(slide, title, bullets_left, bullets_right=None):
    set_slide_bg(slide)
    # Title bar
    add_shape_bg(slide, Inches(0), Inches(0), W, Inches(1.2), RGBColor(0x11, 0x18, 0x27))
    add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.8),
                 title, font_size=28, color=WHITE, bold=True)
    # Accent line under title
    add_shape_bg(slide, Inches(0.8), Inches(1.15), Inches(2), Pt(3), ACCENT_BLUE)

    if bullets_right:
        add_bullet_list(slide, Inches(0.8), Inches(1.5), Inches(5.5), Inches(5.5), bullets_left)
        add_bullet_list(slide, Inches(6.8), Inches(1.5), Inches(5.5), Inches(5.5), bullets_right)
    else:
        add_bullet_list(slide, Inches(0.8), Inches(1.5), Inches(11), Inches(5.5), bullets_left)

# ─── SLIDE 1: Title ───
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
set_slide_bg(slide)
add_shape_bg(slide, Inches(0), Inches(0), Inches(0.15), H, ACCENT_BLUE)
add_text_box(slide, Inches(1.5), Inches(1.8), Inches(10), Inches(1.2),
             "HomeApp", font_size=60, color=WHITE, bold=True)
add_text_box(slide, Inches(1.5), Inches(3.2), Inches(10), Inches(0.8),
             "AI-Powered Home Care & Property Diagnostics Platform",
             font_size=28, color=LIGHT_BLUE)
add_shape_bg(slide, Inches(1.5), Inches(4.3), Inches(3), Pt(3), ACCENT_BLUE)
highlights = [
    "Multi-Agent AI System  |  Google Vertex AI",
    "Cross-Platform  |  Mobile (iOS/Android) + Web",
    "Multimodal Analysis  |  Images, Videos, Documents",
    "Cloud-Native  |  Google Cloud Platform + Firebase",
]
add_bullet_list(slide, Inches(1.5), Inches(4.6), Inches(10), Inches(2.5),
                highlights, font_size=18, color=MED_GRAY)

# ─── SLIDE 2: Problem Statement ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Problem Statement",
    [
        "Information Overload — manuals, warranties, online resources scattered everywhere",
        "Diagnostic Complexity — visual issues need expert analysis; repair vs replace uncertainty",
        "Service Discovery — finding trusted local providers, comparing costs",
    ],
    [
        "DIY Guidance — lack of step-by-step instructions and safety assessment",
        "Document Management — warranties and manuals misplaced when needed most",
        "No Single Platform — homeowners juggle multiple apps, sites, and phone calls",
    ])

# ─── SLIDE 3: Solution Overview ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Solution Overview — HomeApp Platform",
    [
        "Analyzes multimodal inputs (photos, videos, documents) using Gemini 2.5 Flash",
        "Retrieves relevant info from user documents and knowledge base via RAG",
        "Recommends DIY solutions, service providers, and products",
        "Estimates costs — DIY vs professional, location-aware pricing",
        "Provides comprehensive warranty & insurance coverage analysis",
    ],
    [
        "Instant Diagnostics — AI-powered analysis in seconds",
        "Personalized Guidance — based on your documents and location",
        "Cost Transparency — compare DIY vs. professional service costs",
        "Trusted Providers — authorized and highly-rated local services",
        "Document Intelligence — your docs become searchable knowledge",
    ])

# ─── SLIDE 4: Architecture ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_shape_bg(slide, Inches(0), Inches(0), W, Inches(1.2), RGBColor(0x11, 0x18, 0x27))
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.8),
             "Platform Architecture", font_size=28, color=WHITE, bold=True)
add_shape_bg(slide, Inches(0.8), Inches(1.15), Inches(2), Pt(3), ACCENT_BLUE)

# Architecture boxes
layers = [
    ("Client Layer", "Mobile App (Expo RN)  •  Web App (Next.js)  •  Telegram Bot", Inches(0.8), Inches(1.6), Inches(11.5), Inches(1.0), ACCENT_BLUE),
    ("Firebase Layer", "Authentication  •  Firestore (Real-time DB)  •  Cloud Storage", Inches(0.8), Inches(2.8), Inches(11.5), Inches(1.0), RGBColor(0xF5, 0x9E, 0x0B)),
    ("API Gateway", "FastAPI Proxy on Cloud Run  •  Request Routing  •  SSE Streaming", Inches(0.8), Inches(4.0), Inches(11.5), Inches(1.0), GREEN),
    ("AI Layer", "Vertex AI Reasoning Engine  •  Multi-Agent Orchestration  •  RAG Corpus", Inches(0.8), Inches(5.2), Inches(5.5), Inches(1.0), RGBColor(0xA7, 0x8B, 0xFA)),
    ("Workers", "Cloud Functions (Gen2)  •  Pub/Sub Triggers  •  Checkpoint Analysis  •  Metrics  •  RAG Import", Inches(6.5), Inches(5.2), Inches(5.8), Inches(1.0), RGBColor(0xF4, 0x72, 0xB6)),
]
for label, desc, l, t, w, h, color in layers:
    box = add_shape_bg(slide, l, t, w, h, RGBColor(0x1F, 0x2A, 0x3D))
    box.line.color.rgb = color
    box.line.width = Pt(2)
    add_text_box(slide, l + Inches(0.2), t + Inches(0.05), w - Inches(0.4), Inches(0.4),
                 label, font_size=16, color=color, bold=True)
    add_text_box(slide, l + Inches(0.2), t + Inches(0.45), w - Inches(0.4), Inches(0.5),
                 desc, font_size=13, color=LIGHT_GRAY)

# Arrows between layers (simple down-pointing triangles)
for y in [Inches(2.65), Inches(3.85), Inches(5.05)]:
    shape = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(6.4), y, Inches(0.3), Inches(0.15))
    shape.fill.solid()
    shape.fill.fore_color.rgb = MED_GRAY
    shape.line.fill.background()

# ─── SLIDE 5: Key Features — Checkpoints ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Key Feature: Property Checkpoints & Condition Tracking",
    [
        "Visual Timeline — capture photos/videos of property areas over time",
        "AI-Powered Analysis — condition scoring (0–100), damage detection, room detection",
        "Automatic Comparison — visual diff with similarity scoring, change detection",
        "Property Health Metrics — overall score, trend analysis, deterioration rate",
    ],
    [
        "Issue Categorization — critical, major, moderate, minor severity levels",
        "Cost Estimates — repair/maintenance cost breakdown per issue",
        "Async Processing — Pub/Sub + Cloud Functions, non-blocking (202 Accepted)",
        "Real-time Updates — Firestore listeners push results to UI instantly",
    ])

# ─── SLIDE 6: Key Features — Diagnostics & Coverage ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Key Features: Diagnostics, Coverage & Cost Estimation",
    [
        "Multimodal Diagnostics — upload photos/videos → Gemini 2.5 Flash analysis",
        "Intelligent Triage — severity assessment, urgency recommendations, follow-ups",
        "Coverage Analysis — warranty & insurance retrieval from user documents",
        "Document Intelligence — semantic search, citations, multi-document synthesis",
    ],
    [
        "AI-Powered Cost Estimation (NEW) — Gemini + Google Search grounding",
        "Location-Aware Pricing — regional multipliers (e.g. SF = 1.4×)",
        "Service Provider Calibration — weights: 70% AI + 30% real provider data",
        "DIY vs Professional Comparison — materials, labor, time, savings breakdown",
        "Confidence Scoring — automatic fallback to hardcoded library when low",
    ])

# ─── SLIDE 7: Key Features — DIY, Service, Documents ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Key Features: DIY, Service Providers & Document RAG",
    [
        "DIY — step-by-step repair guidance, YouTube tutorials, safety tips",
        "Product Recommendations — curated items with pricing, vendor, reviews, links",
        "Shopping Agent — reusable across contexts (DIY, Professional, etc.)",
    ],
    [
        "Service Discovery — SerpAPI + SerpAPI, authorized centers, ratings, contact info",
        "Document Upload — PDFs, images, videos → auto-indexed to RAG corpus",
        "Document Q&A — ask natural language questions, get answers with citations",
        "Knowledge Base — general RAG corpus for reference materials",
    ])

# ─── SLIDE 8: Multi-Agent Architecture ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_shape_bg(slide, Inches(0), Inches(0), W, Inches(1.2), RGBColor(0x11, 0x18, 0x27))
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.8),
             "Multi-Agent AI System", font_size=28, color=WHITE, bold=True)
add_shape_bg(slide, Inches(0.8), Inches(1.15), Inches(2), Pt(3), ACCENT_BLUE)

# Root agent
root_box = add_shape_bg(slide, Inches(4.5), Inches(1.5), Inches(4.3), Inches(0.7), RGBColor(0x1F, 0x2A, 0x3D))
root_box.line.color.rgb = ACCENT_BLUE
root_box.line.width = Pt(2)
add_text_box(slide, Inches(4.7), Inches(1.55), Inches(3.9), Inches(0.6),
             "Root Property Agent (Orchestrator)", font_size=15, color=ACCENT_BLUE, bold=True)

# Analysis Agent branch
agents_left = [
    ("Analysis Agent", "Multimodal Diagnostics", ACCENT_BLUE),
    ("Triage Agent", "Gemini 2.5 Flash analysis", LIGHT_BLUE),
    ("Coverage Agent", "Warranty/insurance lookup", LIGHT_BLUE),
    ("DIY Agent", "Guides + YouTube + Shopping", LIGHT_BLUE),
    ("Service Agent", "SerpAPI + SerpAPI providers", LIGHT_BLUE),
    ("Cost Agent", "AI cost estimation", LIGHT_BLUE),
    ("Shopping Agent", "Product recommendations", LIGHT_BLUE),
]

y = Inches(2.5)
for name, desc, color in agents_left:
    is_parent = name == "Analysis Agent"
    box = add_shape_bg(slide, Inches(0.5), y, Inches(5.5), Inches(0.55), RGBColor(0x1F, 0x2A, 0x3D))
    box.line.color.rgb = color
    box.line.width = Pt(1.5 if is_parent else 1)
    fs = 14 if is_parent else 12
    add_text_box(slide, Inches(0.7), y + Pt(2), Inches(2.2), Inches(0.4),
                 name, font_size=fs, color=color, bold=is_parent)
    add_text_box(slide, Inches(3.0), y + Pt(2), Inches(2.8), Inches(0.4),
                 desc, font_size=11, color=MED_GRAY)
    y += Inches(0.65)

# DocuLink Agent branch
agents_right = [
    ("DocuLink Agent", "Document Retrieval & Q&A", ORANGE),
    ("User Docs Agent", "User-uploaded documents", RGBColor(0xFB, 0xBF, 0x24)),
    ("Knowledge Base Agent", "General RAG corpus", RGBColor(0xFB, 0xBF, 0x24)),
    ("Checkpoint Agent", "Timeline queries & analysis", RGBColor(0xFB, 0xBF, 0x24)),
]

y = Inches(2.5)
for name, desc, color in agents_right:
    is_parent = name == "DocuLink Agent"
    box = add_shape_bg(slide, Inches(7.0), y, Inches(5.5), Inches(0.55), RGBColor(0x1F, 0x2A, 0x3D))
    box.line.color.rgb = color
    box.line.width = Pt(1.5 if is_parent else 1)
    fs = 14 if is_parent else 12
    add_text_box(slide, Inches(7.2), y + Pt(2), Inches(2.5), Inches(0.4),
                 name, font_size=fs, color=color, bold=is_parent)
    add_text_box(slide, Inches(9.8), y + Pt(2), Inches(2.5), Inches(0.4),
                 desc, font_size=11, color=MED_GRAY)
    y += Inches(0.65)

# RAG Engine at bottom right
rag_box = add_shape_bg(slide, Inches(7.0), y + Inches(0.2), Inches(5.5), Inches(0.55), RGBColor(0x1F, 0x2A, 0x3D))
rag_box.line.color.rgb = GREEN
rag_box.line.width = Pt(2)
add_text_box(slide, Inches(7.2), y + Inches(0.22), Inches(5), Inches(0.5),
             "Vertex AI RAG Engine", font_size=14, color=GREEN, bold=True)

# ─── SLIDE 9: Technology Stack ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Technology Stack",
    [
        "MOBILE — React Native 0.81 · Expo SDK 54 · NativeWind · Firebase SDK",
        "WEB — Next.js 15 · React 19 · Tailwind CSS · Radix UI · Genkit",
        "SHARED — TypeScript · @homeapp/common · React Contexts · Firebase Config",
        "API — FastAPI 0.116 · Python 3.11 · Uvicorn · Pydantic",
    ],
    [
        "AI / ML — Vertex AI Reasoning Engine · RAG Engine · Gemini 2.5 Flash · ADK",
        "CLOUD — Cloud Run · Cloud Functions Gen2 · Cloud Storage · Pub/Sub",
        "DATA — Firebase Auth · Firestore · Cloud Storage · Terraform · Docker",
        "INTEGRATIONS — SerpAPI · SerpAPI · YouTube API · Google Maps · Google Search",
    ])

# ─── SLIDE 10: Applications ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Applications — Mobile, Web & Shared Package",
    [
        "MOBILE APP (apps/mapp) — iOS, Android, Web via Expo",
        "  Camera integration, document picker, real-time chat",
        "  Checkpoints tab with timeline, comparison slider, health metrics",
        "  YouTube embedding, Maps integration, copy/share",
        "  NativeWind styling, Firebase SDK, Gifted Chat",
    ],
    [
        "WEB APP (apps/webapp) — Next.js 15, SSR + CSR",
        "  Responsive design, dark/light theme, data viz (Recharts)",
        "  Full checkpoint feature parity with mobile",
        "  Drag-and-drop upload, image carousel, interactive slider",
        "",
        "SHARED PACKAGE (apps/common)",
        "  React Contexts (Auth, Session, Property, Checkpoint)",
        "  Firebase config, types, platform-specific adapters",
    ])

# ─── SLIDE 11: Use Cases ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Use Cases",
    [
        "Property Condition Tracking — monthly checkpoints, trend analysis, maintenance planning",
        "HVAC System Diagnosis — photo upload → triage → warranty → DIY → providers → cost",
        "Insurance Claim Docs — before/after checkpoints with AI-verified damage assessment",
        "Document Q&A — \"What does my warranty cover?\" → RAG retrieval with citations",
    ],
    [
        "Leak Detection & Repair — video analysis → repair steps → parts → emergency plumber → cost",
        "Preventive Maintenance — health metrics dashboard, deterioration rate, proactive alerts",
        "Appliance Manual Lookup — \"How do I reset my dishwasher?\" → manual search → instructions",
        "AI Cost Estimation — location-aware pricing, provider calibration, DIY vs Pro comparison",
    ])

# ─── SLIDE 12: Deployment & Infrastructure ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Deployment & Infrastructure",
    [
        "Cloud Run — FastAPI proxy, auto-scaling",
        "Cloud Functions Gen2 — checkpoint analysis, metrics aggregation, RAG import",
        "Pub/Sub — checkpoint-analysis-topic, checkpoint-metrics-topic, user-upload-topic",
        "Vertex AI — Agent Engine, RAG Engine, Gemini 2.5 Flash",
        "Firebase — Auth, Firestore (real-time), Storage",
    ],
    [
        "Async Pipeline: App → API → Pub/Sub → Cloud Function → Gemini → Firestore → UI",
        "Horizontal Scaling — Cloud Run auto-scales; workers up to 10 instances",
        "Processing Capacity — 1,000+ checkpoints/minute",
        "Observability — OpenTelemetry, structured logging, Cloud Monitoring dashboards",
        "CI/CD — GitHub Actions for all deploys (agent, proxy, workers, webapp, mapp)",
    ])

# ─── SLIDE 13: Metrics & KPIs ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Key Metrics & Success Indicators",
    [
        "TECHNICAL",
        "  Response time < 5s for triage",
        "  Checkpoint analysis < 10s (async)",
        "  99.9% uptime target",
        "  10,000+ concurrent users",
        "  Room detection confidence 92%+",
    ],
    [
        "BUSINESS",
        "  Cost savings through DIY recommendations",
        "  Service provider conversion rate",
        "  Checkpoint creation frequency per property",
        "  Early issue detection rate",
        "  Insurance claim documentation usage",
        "  Overall condition score improvements",
    ])

# ─── SLIDE 14: Roadmap ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_content_slide(slide, "Future Roadmap",
    [
        "COMPLETED",
        "  Property Checkpoints — timeline, analysis, comparison, metrics",
        "  AI Cost Estimation — Gemini + Search grounding, location-aware pricing",
        "",
        "SHORT-TERM",
        "  Firestore vector search for semantic checkpoint queries",
        "  Chat ↔ Checkpoint deep links",
        "  Proactive AI notifications for property changes",
        "  Enhanced multimodal & batch processing",
    ],
    [
        "MEDIUM-TERM",
        "  Property mind map visualization",
        "  Professional PDF/Word report generation",
        "  Collaborative checkpoints (family & contractors)",
        "  Smart home / IoT integration",
        "",
        "LONG-TERM",
        "  Fine-tuned domain models for property analysis",
        "  Commercial property & vehicle diagnostics",
        "  Insurance claim automation",
        "  AR camera overlay & haptic visualizations",
    ])

# ─── SLIDE 15: Closing ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_shape_bg(slide, Inches(0), Inches(0), Inches(0.15), H, ACCENT_BLUE)
add_text_box(slide, Inches(1.5), Inches(2.0), Inches(10), Inches(1),
             "HomeApp", font_size=52, color=WHITE, bold=True)
add_text_box(slide, Inches(1.5), Inches(3.2), Inches(10), Inches(0.7),
             "Transforming how homeowners manage and maintain their properties.",
             font_size=24, color=LIGHT_BLUE)
add_shape_bg(slide, Inches(1.5), Inches(4.2), Inches(3), Pt(3), ACCENT_BLUE)
closing = [
    "Intelligent Diagnostics through multimodal AI",
    "Property Condition Tracking with checkpoint analysis",
    "Personalized Guidance via RAG-powered retrieval",
    "Cost Transparency with location-aware estimates",
    "Seamless Experience across mobile and web",
    "Scalable Infrastructure with async processing",
]
add_bullet_list(slide, Inches(1.5), Inches(4.6), Inches(10), Inches(2.5),
                closing, font_size=18, color=MED_GRAY)

# Save
output_path = "docs/HomeApp_Presentation.pptx"
prs.save(output_path)
print(f"Saved: {output_path}")
