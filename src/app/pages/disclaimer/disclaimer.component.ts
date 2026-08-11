import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-disclaimer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './disclaimer.component.html',
  styleUrls: ['./disclaimer.component.scss']
})
export class DisclaimerComponent {
  lastUpdated = 'July 2026';
  version = '1.0 (Beta)';

  sections = [
    {
      id: 'ai-accuracy',
      icon: '🤖',
      title: 'AI Accuracy & Limitations',
      color: 'amber',
      items: [
        'UniDocVerse uses large language models (LLMs) and machine learning pipelines to extract, classify, and summarize information from documents. These models can and do make mistakes — they may hallucinate facts, misread figures, miss clauses, or produce confident-sounding but incorrect output.',
        'Extraction accuracy varies significantly by document quality, scan resolution, font type, language, layout complexity, and document category. Results on scanned or hand-written documents are particularly unreliable.',
        'Summaries are AI-generated condensations and may omit critical terms, conditions, exclusions, or context that a human reviewer would catch.',
        'Numeric values — premium amounts, coverage limits, deductibles, loan balances, tax figures — must always be verified against the original source document. The AI may transpose digits, misread formatting, or conflate similar values.',
        'Classification (e.g. "Insurance Policy", "Tax Return", "Lease Agreement") is probabilistic. Documents with non-standard formats may be misclassified, which can cause incorrect analysis pipelines to be applied.',
      ]
    },
    {
      id: 'not-professional-advice',
      icon: '⚖️',
      title: 'Not Professional or Legal Advice',
      color: 'rose',
      items: [
        'Nothing produced by UniDocVerse — including summaries, extracted terms, insights, risk flags, compliance scores, or AI-generated answers — constitutes legal, financial, insurance, tax, medical, or regulatory advice.',
        'UniDocVerse is not a licensed attorney, CPA, insurance broker, financial advisor, or medical professional. Its output does not create any professional relationship between the user and Anthropic, Ollama, or the developers of this software.',
        'You should always consult a qualified, licensed professional before making any decision that carries legal, financial, insurance, or health consequences.',
        'In regulated industries (insurance, healthcare, finance, real estate), decisions informed by this software must be reviewed and validated by a licensed individual before being acted upon, communicated to clients, or submitted to any regulator.',
      ]
    },
    {
      id: 'compliance',
      icon: '📋',
      title: 'Regulatory & Compliance Risk',
      color: 'rose',
      items: [
        'UniDocVerse has not been certified, audited, or approved for use in regulated workflows under HIPAA, GDPR, SOC 2, ISO 27001, FINRA, SEC, NAIC, or any other regulatory framework.',
        'Users operating in regulated environments bear full responsibility for ensuring that their use of this software complies with all applicable laws, regulations, and internal policies.',
        'AI-generated compliance summaries or risk scores do not guarantee actual compliance. They are heuristic indicators only and may miss newly enacted rules, jurisdiction-specific requirements, or document-specific nuances.',
        'Do not use AI-extracted data as the basis for regulatory filings, court submissions, client disclosures, coverage decisions, underwriting decisions, claims adjudication, or any other compliance-sensitive action without independent human verification.',
        'The developers of UniDocVerse accept no liability for compliance failures, regulatory penalties, or legal consequences arising from reliance on output produced by this software.',
      ]
    },
    {
      id: 'testing',
      icon: '🧪',
      title: 'Testing Coverage & Known Gaps',
      color: 'amber',
      items: [
        'This software is in active development (Beta). It has not been exhaustively tested across all document types, verticals, languages, or real-world edge cases.',
        'Document verticals with limited testing include: supply chain manifests, multi-jurisdiction legal contracts, healthcare lab reports, government regulatory filings, and multi-language mixed documents.',
        'Performance and accuracy on documents with complex tables, nested structures, watermarks, rotated pages, low-resolution scans, or non-Latin scripts is significantly lower than on clean, standard-format PDFs.',
        'The ReAct AI agent feature (phi3:mini) is experimental. Agent-generated action plans, tool calls, and decisions should not be executed in production workflows without human review at every step.',
        'We actively want to improve coverage. If you encounter incorrect output, please report it via the Feedback button so it can be included in future evaluation sets.',
      ]
    },
    {
      id: 'data-privacy',
      icon: '🔒',
      title: 'Data Privacy & Security',
      color: 'blue',
      items: [
        'By default, UniDocVerse processes documents locally on your own machine. No document content is sent to external cloud services unless you have explicitly configured a cloud LLM endpoint.',
        'If you use a cloud model endpoint (e.g. Anthropic Claude API, OpenAI), document content and extracted text will be transmitted to that third-party service under their respective privacy policies.',
        'Do not upload documents containing Protected Health Information (PHI), Personally Identifiable Information (PII), Payment Card Industry (PCI) data, or other regulated sensitive data unless your deployment has been specifically configured and reviewed for compliance with the applicable standards.',
        'The developers of this software are not responsible for data breaches, unauthorized access, or regulatory violations resulting from improper deployment or configuration.',
        'Audit logs, extracted metadata, and AI-generated summaries are stored in the local PostgreSQL database. Ensure your database is secured according to your organisation\'s security policies.',
      ]
    },
    {
      id: 'no-warranty',
      icon: '📄',
      title: 'No Warranty & Limitation of Liability',
      color: 'gray',
      items: [
        'UniDocVerse is provided "as is" and "as available" without any warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.',
        'The developers do not warrant that the software will be error-free, uninterrupted, secure, or produce accurate results for any particular use case.',
        'To the maximum extent permitted by applicable law, the developers shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from the use of or inability to use this software — including but not limited to loss of data, loss of revenue, regulatory fines, or professional liability claims.',
        'Your use of this software constitutes acceptance of these terms. If you do not agree, you should not use the software.',
      ]
    },
    {
      id: 'model-providers',
      icon: '🔗',
      title: 'Third-Party Model Providers',
      color: 'blue',
      items: [
        'UniDocVerse integrates with Ollama (for local inference) and optionally with the Anthropic Claude API. These are independent services with their own terms of service, usage policies, and privacy practices.',
        'phi3:mini (Microsoft) runs locally via Ollama. Output quality is limited by the model\'s size and training data. It is not optimised for document intelligence tasks and should be treated as a best-effort assistant.',
        'When Claude (Anthropic) is used as the reasoning model, Anthropic\'s usage policies apply. Review Anthropic\'s acceptable use policy before processing sensitive or regulated content.',
        'The developers of UniDocVerse are not affiliated with Microsoft, Anthropic, or Ollama and make no representations about the accuracy, safety, or reliability of their models.',
      ]
    },
  ];
}
