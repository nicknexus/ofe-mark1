import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowLeft, ArrowUp, Heart, Scale } from "lucide-react";
import {
    TERMS_EFFECTIVE_DATE,
    TERMS_LAST_UPDATED,
    TERMS_INTRO,
    TERMS_SECTIONS,
} from "../content/termsOfService";

/**
 * Public, read-only Terms of Service at /tos.
 *
 * Shares its copy with the signup acceptance gate (TermsOfServicePage) via
 * content/termsOfService — this page is presentation only and never asks for
 * acceptance.
 */
export default function PublicTermsPage() {
    const { scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
    const [activeId, setActiveId] = useState<string>(TERMS_SECTIONS[0]?.id ?? "");
    const [showTop, setShowTop] = useState(false);

    // Highlight the section currently nearest the top of the viewport.
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.id);
            },
            { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
        );
        TERMS_SECTIONS.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 600);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="min-h-screen bg-background">
            {/* Scroll progress */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-0.5 bg-accent origin-left z-50"
                style={{ scaleX: progress }}
            />

            {/* Header */}
            <header className="relative overflow-hidden bg-ink">
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-seafoam/40 to-transparent" />
                <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-[42rem] rounded-full bg-sage/10 blur-3xl" />

                <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-16 sm:pb-20">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                        Back to Nexus
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-10"
                    >
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/70">
                            <Scale className="w-3.5 h-3.5 text-seafoam" />
                            Legal
                        </span>

                        <h1 className="mt-4 text-4xl sm:text-5xl font-fraunces font-light text-white leading-tight">
                            Terms of Service
                        </h1>

                        <p className="mt-4 max-w-2xl text-white/60 leading-relaxed">
                            The agreement between your organization and Nexus Impacts Technologies Inc.
                            covering access to and use of the platform.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/45">
                            <span>Effective {TERMS_EFFECTIVE_DATE}</span>
                            <span className="hidden sm:inline text-white/20">·</span>
                            <span>Last updated {TERMS_LAST_UPDATED}</span>
                        </div>
                    </motion.div>
                </div>
            </header>

            {/* Body */}
            <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
                <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-14">
                    {/* Table of contents */}
                    <nav aria-label="Contents" className="hidden lg:block">
                        <div className="sticky top-12">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                                Contents
                            </p>
                            <ul className="space-y-0.5 border-l border-border/60">
                                {TERMS_SECTIONS.map((section) => {
                                    const active = activeId === section.id;
                                    return (
                                        <li key={section.id}>
                                            <a
                                                href={`#${section.id}`}
                                                className={`block -ml-px border-l-2 pl-4 py-1.5 text-sm leading-snug transition-colors ${
                                                    active
                                                        ? "border-accent text-foreground font-medium"
                                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                                }`}
                                            >
                                                {section.heading}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </nav>

                    {/* Content */}
                    <main className="min-w-0">
                        <p className="text-lg text-foreground/80 leading-relaxed pb-10 mb-10 border-b border-border/60">
                            {TERMS_INTRO}
                        </p>

                        <div className="space-y-12">
                            {TERMS_SECTIONS.map((section) => (
                                <section key={section.id} id={section.id} className="scroll-mt-24">
                                    <h2 className="text-xl sm:text-2xl font-fraunces font-normal text-foreground mb-4">
                                        {section.heading}
                                    </h2>
                                    <div
                                        className={`space-y-4 leading-relaxed ${
                                            section.uppercase
                                                ? "text-[13px] tracking-wide text-muted-foreground"
                                                : "text-[15px] text-foreground/75"
                                        }`}
                                    >
                                        {section.paragraphs.map((text, i) => (
                                            <p key={i}>{text}</p>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <div className="mt-16 pt-8 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Heart className="w-4 h-4 text-accent fill-current" />
                                Nexus Impacts Technologies Inc.
                            </p>
                            <Link
                                to="/"
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 group"
                            >
                                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                                Back to Nexus
                            </Link>
                        </div>
                    </main>
                </div>
            </div>

            {/* Back to top */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Back to top"
                className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-accent text-accent-foreground shadow-lg border border-accent/50 flex items-center justify-center transition-all active:scale-95 ${
                    showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                }`}
            >
                <ArrowUp className="w-5 h-5" />
            </button>
        </div>
    );
}
