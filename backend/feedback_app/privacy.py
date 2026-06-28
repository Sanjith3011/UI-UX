from django.conf import settings


def get_privacy_policy() -> dict:
    ai_provider = getattr(settings, 'AI_PROVIDER', 'groq').upper()
    zdr_enabled = getattr(settings, 'GROQ_ZDR_ENABLED', False)

    return {
        'title': 'Privacy Policy — UI/UX Feedback Analyzer',
        'last_updated': '2026-06-05',
        'sections': [
            {
                'heading': 'What we collect',
                'content': [
                    'Account information: username and email (for registration and login).',
                    'Project metadata: project titles and descriptions you create.',
                    'Uploaded screenshots: design images you submit for UI/UX analysis.',
                    'AI feedback: scores and written analysis generated from your uploads.',
                    'Usage metadata: standard server logs (timestamps, request sizes).',
                ],
            },
            {
                'heading': 'What we send to third-party AI',
                'content': [
                    f'UI-related source code extracted from your ZIP (HTML, CSS, JS/TS, JSX/TSX, Vue, etc.) is sent to {ai_provider} for analysis.',
                    'Design screenshots are sent to the AI vision API for UI/UX review.',
                    'We filter out node_modules, build folders, and other non-source directories before sending data.',
                    'We do not intentionally send your full ZIP — only selected text files up to configured limits.',
                    'Your original ZIP file is deleted from our server after processing completes.',
                ],
            },
            {
                'heading': 'What we store',
                'content': [
                    'AI-generated feedback (markdown analysis and UI/UX scores).',
                    'Per-file analysis summaries (not your full source code).',
                    'Uploaded design screenshots until you delete them.',
                    'We do not permanently store your full project source code after analysis.',
                ],
            },
            {
                'heading': 'Third-party AI data handling (Groq)',
                'content': [
                    'Groq processes your data on their servers to generate AI responses.',
                    'Per Groq documentation, inference inputs/outputs are not retained by default.',
                    'Groq may retain reliability logs for up to 30 days unless Zero Data Retention (ZDR) is enabled.',
                    f'ZDR on this deployment: {"Enabled (configured by administrator)" if zdr_enabled else "Administrator should enable at console.groq.com/settings/data-controls"}',
                    'Groq states they do not train models on API customer data.',
                    'See: https://console.groq.com/docs/your-data',
                ],
            },
            {
                'heading': 'Retention',
                'content': [
                    'Your data is kept until you delete it or delete your account data.',
                    'Processed ZIP archives are removed from disk after analysis.',
                    'You can delete project feedback or individual designs at any time.',
                    'Use "Delete All My Data" to remove all projects, uploads, and analysis from our servers.',
                ],
            },
            {
                'heading': 'Your rights',
                'content': [
                    'Delete individual project feedback or design analyses from the project page.',
                    'Delete all your data using the "Delete All My Data" button in the navigation bar.',
                    'Stop using the service at any time — you control what you upload.',
                    'Before uploading, remove .env files, API keys, passwords, and credentials from your ZIP.',
                ],
            },
            {
                'heading': 'Security measures',
                'content': [
                    'ZIP uploads are scanned for .env files, credential filenames, and common secret patterns before analysis.',
                    'Uploads containing detected secrets are blocked automatically.',
                    'Authentication uses JWT tokens; projects are scoped to your account only.',
                ],
            },
        ],
        'contact': 'For privacy questions, contact your system administrator.',
        'groq_zdr_url': 'https://console.groq.com/settings/data-controls',
    }
