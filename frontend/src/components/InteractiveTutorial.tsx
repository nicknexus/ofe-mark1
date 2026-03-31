import React, { useEffect, useState } from 'react'
import { X, ChevronRight, ChevronLeft, Target, BarChart3, TrendingUp, FileText, Link2, Settings, Globe, Sparkles } from 'lucide-react'
import { useTutorial } from '../context/TutorialContext'

interface Slide {
    title: string
    subtitle: string
    description: string
    bullets: string[]
    icon: React.ComponentType<any>
    image?: string
}

const BRAND = '#c0dfa1'
const BRAND_DARK = '#90b171'

const SLIDES: Slide[] = [
    {
        title: 'Welcome to Nexus Impacts AI',
        subtitle: '',
        description: '',
        bullets: [],
        icon: Sparkles
    },
    {
        title: 'Initiatives',
        subtitle: 'Your Projects & Programs',
        description: 'Initiatives are the top-level container for everything you do. Think of them as your main projects or programs.',
        bullets: [
            'Each initiative has its own metrics, evidence, and reports',
            'Examples: "Youth Training 2025", "Clean Water Project"',
            'You can run multiple initiatives at once'
        ],
        icon: Target,
        image: '/initativetut.png'
    },
    {
        title: 'Metrics',
        subtitle: 'What You Measure',
        description: 'Metrics are the specific things you want to track — like "People Trained" or "Wells Built". Each metric lives inside an initiative.',
        bullets: [
            'Define what you\'re measuring and the unit (people, hours, etc.)',
            'Categorise as Input, Output, or Impact',
            'View progress over time with charts'
        ],
        icon: BarChart3,
        image: '/metricstut.png'
    },
    {
        title: 'Impact Claims',
        subtitle: 'Your Results — Linked by Date & Location',
        description: 'Impact claims record what you actually achieved. Each claim captures a value, a date (or date range), and a location — this is how everything connects.',
        bullets: [
            'Record results: "50 people trained on March 15th in Nairobi"',
            'Date and location are the link between claims and evidence',
            'Claims stack up over time to show your total impact'
        ],
        icon: TrendingUp,
        image: '/impactsclaimtut.png'
    },
    {
        title: 'Evidence',
        subtitle: 'Prove Your Impact',
        description: 'Evidence is the proof behind your claims — photos, documents, receipts, videos. Evidence is automatically matched to impact claims by date and location.',
        bullets: [
            'Upload photos, PDFs, videos, or any document',
            'Evidence auto-links to claims with matching dates & locations',
            'Strong evidence = credible impact reporting'
        ],
        icon: FileText,
        image: '/evidencetut.png'
    },
    {
        title: 'Account Settings',
        subtitle: 'Your Organisation Profile',
        description: 'Set up your organisation\'s identity in Account Settings. This information is used in your public page and AI-generated reports.',
        bullets: [
            'Set your mission statement and organisation description',
            'Upload your logo and branding colours',
            'Manage your subscription and team members'
        ],
        icon: Settings,
        image: '/brandingtut.png'
    },
    {
        title: 'Go Public',
        subtitle: 'Share Your Impact With the World',
        description: 'Make your initiatives public so donors, partners, and the community can see your verified impact data and stories.',
        bullets: [
            'Toggle any initiative to public from its settings',
            'Get a shareable link to your public impact page',
            'Public pages show metrics, evidence, and stories beautifully'
        ],
        icon: Globe,
        image: '/publicvis.png'
    }
]

export default function InteractiveTutorial() {
    const { isActive, currentSlide, totalSlides, nextSlide, prevSlide, goToSlide, closeTutorial } = useTutorial()
    const [isAnimating, setIsAnimating] = useState(false)
    const [direction, setDirection] = useState<'left' | 'right'>('right')
    const [displayedSlide, setDisplayedSlide] = useState(currentSlide)

    useEffect(() => {
        if (currentSlide !== displayedSlide) {
            setDirection(currentSlide > displayedSlide ? 'right' : 'left')
            setIsAnimating(true)
            const timer = setTimeout(() => {
                setDisplayedSlide(currentSlide)
                setIsAnimating(false)
            }, 200)
            return () => clearTimeout(timer)
        }
    }, [currentSlide, displayedSlide])

    useEffect(() => {
        if (!isActive) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') nextSlide()
            else if (e.key === 'ArrowLeft') prevSlide()
            else if (e.key === 'Escape') closeTutorial()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isActive, nextSlide, prevSlide, closeTutorial])

    if (!isActive) return null

    const slide = SLIDES[displayedSlide]
    const Icon = slide.icon
    const isFirst = currentSlide === 0
    const isLast = currentSlide === totalSlides - 1
    const isWelcome = displayedSlide === 0

    return (
        <div className="fixed inset-0 z-[100] flex flex-col h-dvh overflow-hidden">
            {/* Solid background — white/gray with blurry green accents */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f5f6f8 40%, #f0f1f4 100%)'
            }} />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-40 blur-[120px]" style={{ backgroundColor: BRAND }} />
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-30 blur-[100px]" style={{ backgroundColor: BRAND }} />
            <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full opacity-20 blur-[80px]" style={{ backgroundColor: BRAND }} />

            {/* Top bar — glass, hidden on welcome slide */}
            {!isWelcome && (
                <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0 bg-white/60 backdrop-blur-2xl border-b border-white/40">
                    <div className="flex items-center gap-2">
                        {SLIDES.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToSlide(i)}
                                className={`rounded-full transition-all duration-300 ${
                                    i === currentSlide ? 'w-7 h-2' : 'w-2 h-2'
                                }`}
                                style={{
                                    backgroundColor: i === currentSlide
                                        ? BRAND_DARK
                                        : i < currentSlide
                                        ? `${BRAND_DARK}60`
                                        : `${BRAND}80`
                                }}
                            />
                        ))}
                        <span className="ml-3 text-xs text-gray-400 font-medium">{currentSlide + 1} / {totalSlides}</span>
                    </div>
                    <button
                        onClick={closeTutorial}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white/60 hover:bg-white/80 border border-gray-200/60 rounded-lg transition-all duration-200"
                    >
                        Skip <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Scrollable content area */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto">
                <div className="flex items-center justify-center min-h-full px-5 md:px-10 py-6">
                    <div className={`w-full max-w-7xl transition-all duration-200 ease-out ${
                        isAnimating
                            ? `opacity-0 ${direction === 'right' ? 'translate-x-6' : '-translate-x-6'}`
                            : 'opacity-100 translate-x-0'
                    }`}>
                        {isWelcome ? (
                            <div className="flex flex-col items-center justify-center text-center">
                                <p
                                    className="text-lg sm:text-xl md:text-2xl font-newsreader font-light text-foreground mb-3"
                                    style={{
                                        opacity: 0,
                                        transform: 'translateY(12px)',
                                        animation: 'tutFadeUp 1s ease-out 0.3s forwards'
                                    }}
                                >
                                    Welcome to
                                </p>
                                <h1
                                    className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-newsreader font-light text-foreground leading-[1.1] whitespace-nowrap"
                                    style={{
                                        opacity: 0,
                                        transform: 'translateY(16px)',
                                        animation: 'tutFadeUp 1.2s ease-out 0.7s forwards'
                                    }}
                                >
                                    Nexus Impacts{' '}
                                    <span className="relative inline-block">
                                        <span className="relative z-10">AI</span>
                                        <svg className="absolute -bottom-1 md:-bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                                            <path d="M2 8C50 2 150 2 198 8" stroke="#c0dfa1" strokeWidth="4" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                </h1>
                                <button
                                    onClick={nextSlide}
                                    className="mt-8 flex items-center gap-1.5 px-6 py-3 text-white rounded-xl transition-all duration-200 font-semibold text-sm shadow-lg hover:opacity-90"
                                    style={{
                                        backgroundColor: BRAND_DARK,
                                        opacity: 0,
                                        transform: 'translateY(12px)',
                                        animation: 'tutFadeUp 1s ease-out 1.4s forwards'
                                    }}
                                >
                                    Let's Go
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <style>{`
                                    @keyframes tutFadeUp {
                                        to {
                                            opacity: 1;
                                            transform: translateY(0);
                                        }
                                    }
                                `}</style>
                            </div>
                        ) : (
                            /* Content slides — two columns on lg */
                            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 lg:gap-12 items-center">
                                <div className="order-2 lg:order-1">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-md border border-white/50" style={{ backgroundColor: `${BRAND}40` }}>
                                        <Icon className="w-5 h-5" style={{ color: BRAND_DARK }} />
                                    </div>

                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-1.5 tracking-tight">
                                        {slide.title}
                                    </h2>
                                    <p className="text-sm md:text-base font-medium mb-4" style={{ color: BRAND_DARK }}>
                                        {slide.subtitle}
                                    </p>
                                    <p className="text-sm md:text-base text-gray-500 leading-relaxed mb-5">
                                        {slide.description}
                                    </p>

                                    <div className="space-y-2">
                                        {slide.bullets.map((bullet, i) => (
                                            <div key={i} className="flex items-start gap-3 bg-white/50 backdrop-blur-xl border border-white/60 rounded-xl px-4 py-2.5 shadow-sm">
                                                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${BRAND}50` }}>
                                                    <span className="text-[10px] font-bold" style={{ color: BRAND_DARK }}>{i + 1}</span>
                                                </div>
                                                <p className="text-gray-500 text-sm leading-relaxed">{bullet}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {(displayedSlide === 3 || displayedSlide === 4) && (
                                        <div className="mt-5 p-3.5 rounded-xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-sm">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Link2 className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-xs font-semibold text-gray-600">How it connects</span>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                {displayedSlide === 3
                                                    ? 'Impact claims are linked to metrics by the metric they belong to, and matched to evidence by their date and location.'
                                                    : 'When you upload evidence with a date and location that matches an impact claim, they are automatically linked — proving your results.'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {slide.image && (
                                    <div className="order-1 lg:order-2">
                                        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl shadow-black/5 rounded-2xl overflow-hidden">
                                            <img
                                                key={displayedSlide}
                                                src={slide.image}
                                                alt={slide.title}
                                                className="w-full h-auto object-cover opacity-0 transition-opacity duration-700 ease-out"
                                                onLoad={(e) => { (e.target as HTMLImageElement).classList.replace('opacity-0', 'opacity-100') }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom nav — glass style */}
            <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0 bg-white/60 backdrop-blur-2xl border-t border-white/40">
                {/* Left side — skip on welcome, back on others */}
                <div>
                    {isWelcome ? (
                        <button
                            onClick={closeTutorial}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Skip tutorial
                        </button>
                    ) : !isFirst ? (
                        <button
                            onClick={prevSlide}
                            className="flex items-center gap-1.5 px-4 py-2 text-gray-500 hover:text-gray-700 bg-white/60 hover:bg-white/80 border border-gray-200/60 rounded-xl transition-all duration-200 font-medium text-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                    ) : <div />}
                </div>

                {/* Right side — nav button */}
                <div>
                    {isLast ? (
                        <button
                            onClick={closeTutorial}
                            className="flex items-center gap-1.5 px-5 py-2 text-white rounded-xl transition-all duration-200 font-semibold text-sm shadow-lg hover:opacity-90"
                            style={{ backgroundColor: BRAND_DARK }}
                        >
                            Get Started
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={nextSlide}
                            className="flex items-center gap-1.5 px-5 py-2 text-white rounded-xl transition-all duration-200 font-semibold text-sm shadow-lg hover:opacity-90"
                            style={{ backgroundColor: BRAND_DARK }}
                        >
                            {isFirst ? "Let's Go" : 'Next'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
