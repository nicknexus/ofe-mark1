// Single source of truth for the Terms of Service copy.
// Rendered two ways: the acceptance gate (TermsOfServicePage) and the public
// page at /tos (PublicTermsPage). Edit the text here and both stay in sync.

export interface TermsSection {
    /** Anchor slug — used by the public page's table of contents. */
    id: string
    heading: string
    paragraphs: string[]
    /** Legal-convention all-caps blocks (warranty disclaimer, liability cap). */
    uppercase?: boolean
}

export const TERMS_EFFECTIVE_DATE = 'February 1st, 2026'
export const TERMS_LAST_UPDATED = 'February 22nd, 2026'

export const TERMS_INTRO = `These Terms of Service ("Terms") govern access to and use of the NexusImpacts.ai platform, including all related websites, dashboards, applications, software, APIs, tools, and services (collectively, the "Service"), operated by Nexus Impacts Technologies Inc., a corporation organized under the laws of British Columbia, Canada ("Nexus," "we," "us," or "our"). By accessing or using the Service, creating an account, or clicking to accept these Terms, you agree to be legally bound by them. If you do not agree, you may not use the Service.`

export const TERMS_SECTIONS: TermsSection[] = [
    {
        id: 'eligibility',
        heading: '1. Eligibility and Authority',
        paragraphs: [
            `You must be at least the age of majority in your jurisdiction to use the Service. If you are creating or administering an organizational account, you represent and warrant that you have the authority to bind the organization to these Terms. If you are accessing the Service as an employee, contractor, volunteer, or member of an organization, you represent that you are authorized by the organization to use the Service on its behalf and that your use is subject to these Terms.`,
            `The organization identified in the account is responsible for ensuring that only authorized individuals are granted access and for all activity conducted under its organizational account. Each individual user is responsible for maintaining the confidentiality of their credentials and for all activity conducted under their individual login.`,
        ],
    },
    {
        id: 'description',
        heading: '3. Description of the Service',
        paragraphs: [
            `The Service provides a technology platform enabling organizations to create, manage, and publicly display impact-related information, including but not limited to metrics, impact claims, evidence, images, documents, reports, and related data ("Content"). Nexus provides infrastructure only and does not independently verify, audit, guarantee, or endorse user-submitted Content unless explicitly agreed in writing.`,
        ],
    },
    {
        id: 'public-accessibility',
        heading: '4. Public Accessibility',
        paragraphs: [
            `You acknowledge and agree that Content submitted to the Service may be publicly accessible and viewable worldwide, including via search engines and third-party indexing systems. Public Content may be copied, scraped, redistributed, archived, downloaded, or otherwise used by third parties without Nexus's knowledge or control. Nexus assumes no responsibility or liability for third-party use, misuse, reliance upon, or interpretation of publicly accessible Content. You are solely responsible for determining whether Content is appropriate for public disclosure.`,
        ],
    },
    {
        id: 'user-content',
        heading: '5. User Content; Representations and Warranties',
        paragraphs: [
            `You retain ownership of your Content. By submitting Content, you represent and warrant that you own or have obtained all necessary rights, licenses, consents, and permissions to upload and authorize its use as contemplated by these Terms, including all required consents from identifiable individuals and guardians of minors where applicable. You further warrant that your Content complies with all applicable laws and does not infringe any intellectual property, privacy, publicity, contractual, or other third-party rights.`,
        ],
    },
    {
        id: 'prohibited',
        heading: '6. Prohibited Content and Conduct',
        paragraphs: [
            `You agree not to upload, post, transmit, or make available Content that is unlawful, fraudulent, deceptive, defamatory, harassing, threatening, abusive, hateful, discriminatory, violent, exploitative, sexually explicit, pornographic, sexually suggestive involving minors, or otherwise harmful. You may not post graphic violence, exploitative imagery, content promoting abuse, or any material that could reasonably endanger individuals or vulnerable populations. You may not upload sensitive personal data unless lawfully permitted and properly consented. Nexus reserves sole discretion to determine whether Content violates these standards.`,
        ],
    },
    {
        id: 'license',
        heading: '7. License to Nexus',
        paragraphs: [
            `By submitting Content, you grant Nexus a worldwide, non-exclusive, royalty-free, perpetual, transferable, sublicensable license to host, store, reproduce, modify for formatting and display, publish, publicly display, distribute, and otherwise use the Content for purposes of operating, maintaining, improving, securing, and promoting the Service. This includes use in marketing, promotional materials, educational materials, case studies, investor materials, public communications, and sales communications for both Nexus and your organization. This license survives termination with respect to materials already created or distributed.`,
        ],
    },
    {
        id: 'termination',
        heading: '8. Suspension, Restriction, and Termination',
        paragraphs: [
            `Nexus Impacts Technologies Inc. may, at any time and in its sole discretion, suspend, restrict, disable, remove, de-index, or terminate any account or Content, or take any action deemed necessary to protect the integrity, safety, legality, or reputation of the Service. This includes circumstances where Nexus reasonably believes Content or conduct is unlawful, suspicious, sexually inappropriate, exploitative, harmful, misleading, reputationally damaging, or inconsistent with the mission or standards of the platform. Nexus may take such action immediately and without prior notice. Where appropriate, Nexus may attempt to contact the account holder before permanent deletion; however, Nexus is under no obligation to provide advance notice where immediate action is deemed necessary.`,
        ],
    },
    {
        id: 'indemnification',
        heading: '9. Indemnification and Liability for Harm',
        paragraphs: [
            `You agree to indemnify, defend, and hold harmless Nexus Impacts Technologies Inc., its directors, officers, employees, affiliates, contractors, and agents from and against any and all claims, liabilities, damages, losses, costs, fines, penalties, regulatory actions, and expenses (including legal fees) arising out of or related to: (a) your Content; (b) your use of the Service; (c) your violation of these Terms; (d) violation of any law; or (e) any reputational harm, loss of revenue, regulatory scrutiny, business interruption, or public relations damage suffered by Nexus arising from your Content or conduct.`,
        ],
    },
    {
        id: 'warranties',
        heading: '10. Disclaimer of Warranties',
        uppercase: true,
        paragraphs: [
            `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXUS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, NON-INFRINGEMENT, AND SECURITY. NEXUS DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.`,
        ],
    },
    {
        id: 'liability',
        heading: '11. Limitation of Liability',
        uppercase: true,
        paragraphs: [
            `TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXUS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, BUSINESS OPPORTUNITY, GOODWILL, OR REPUTATION. NEXUS SHALL NOT BE LIABLE FOR THIRD-PARTY USE OR MISUSE OF PUBLICLY ACCESSIBLE CONTENT. WHERE LIABILITY CANNOT BE EXCLUDED BY LAW, NEXUS'S LIABILITY SHALL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW.`,
        ],
    },
    {
        id: 'compliance',
        heading: '12. Compliance with Laws',
        paragraphs: [
            `The Service is operated from Canada but may be accessed globally. You are responsible for compliance with all laws applicable to your use of the Service in your jurisdiction, including privacy, fundraising, charity, export control, and sanctions laws.`,
        ],
    },
    {
        id: 'modifications',
        heading: '13. Modifications to Terms',
        paragraphs: [
            `Nexus Impacts Technologies Inc. may modify or update these Terms at any time, in its sole discretion. Updated Terms will be posted within the Service with a revised "Last Updated" date. Modifications are effective upon posting unless otherwise stated. Continued use of the Service after modifications constitutes acceptance of the revised Terms.`,
        ],
    },
    {
        id: 'governing-law',
        heading: '14. Governing Law',
        paragraphs: [
            `These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without regard to conflict-of-law principles. Any dispute shall be resolved exclusively in the courts located in British Columbia, Canada, unless otherwise required by applicable law.`,
        ],
    },
    {
        id: 'entire-agreement',
        heading: '15. Entire Agreement; Severability',
        paragraphs: [
            `These Terms constitute the entire agreement between you and Nexus Impacts Technologies Inc. regarding the Service and supersede all prior agreements. If any provision is found unenforceable, the remaining provisions remain in full force and effect.`,
        ],
    },
    {
        id: 'contact',
        heading: '16. Contact',
        paragraphs: [
            `Legal inquiries may be directed to the Nexus Impacts Inc. team through contact options available on the website nexusimpacts.ai.`,
        ],
    },
]
