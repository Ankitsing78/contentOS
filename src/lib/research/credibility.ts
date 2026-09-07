/**
 * ContentOS - Source Quality & Credibility Evaluation
 * 
 * Evaluates source credibility, relevance, and document type deterministically
 * based on domain authority, publication origin, and query alignment.
 */

import { ResearchSourceType, SourceCredibility, SourceRelevance } from '@/types';

// High-credibility academic, governmental, and official documentation domains
const ACADEMIC_DOMAINS = ['.edu', '.ac.uk', '.edu.au', 'arxiv.org', 'biorxiv.org', 'medrxiv.org', 'acm.org', 'ieee.org', 'nature.com', 'sciencedirect.com', 'springer.com', 'nih.gov', 'pnas.org'];
const GOV_DOMAINS = ['.gov', '.europa.eu', 'who.int', 'oecd.org', 'un.org'];
const OFFICIAL_DOCS_DOMAINS = ['docs.', 'developer.', 'github.com', 'gitlab.com', 'microsoft.com', 'google.com', 'apple.com', 'aws.amazon.com', 'anthropic.com', 'openai.com'];
const MAJOR_INDUSTRY_DOMAINS = ['gartner.com', 'mckinsey.com', 'forrester.com', 'stackoverflow.com', 'github.blog', 'stackoverflow.blog'];
const REPUTABLE_NEWS_DOMAINS = ['reuters.com', 'apnews.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'techcrunch.com', 'arstechnica.com', 'theverge.com', 'wired.com', 'technologyreview.com'];

export interface EvaluatedSourceMetadata {
  domain: string;
  publisher: string;
  sourceType: ResearchSourceType;
  credibility: SourceCredibility;
  relevance: SourceRelevance;
}

/**
 * Extracts normalized hostname / domain from a URL.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown-source';
  }
}

/**
 * Derives a readable publisher name from a domain name.
 */
export function derivePublisherName(domain: string): string {
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const main = parts[parts.length - 2];
    // Capitalize first letter
    return main.charAt(0).toUpperCase() + main.slice(1);
  }
  return domain;
}

/**
 * Deterministically classifies source_type, credibility, and publisher.
 */
export function evaluateSourceQuality(
  url: string,
  searchScore = 0.5,
  title = ''
): EvaluatedSourceMetadata {
  const domain = extractDomain(url);
  const publisher = derivePublisherName(domain);

  let sourceType: ResearchSourceType = 'article';
  let credibility: SourceCredibility = 'medium';

  // 1. Check Academic / Research Paper domains
  if (ACADEMIC_DOMAINS.some((d) => domain.endsWith(d) || domain.includes(d))) {
    sourceType = 'paper';
    credibility = 'high';
  }
  // 2. Check Government domains
  else if (GOV_DOMAINS.some((d) => domain.endsWith(d) || domain.includes(d))) {
    sourceType = 'report';
    credibility = 'high';
  }
  // 3. Check Official Docs
  else if (OFFICIAL_DOCS_DOMAINS.some((d) => domain.includes(d))) {
    sourceType = 'documentation';
    credibility = 'high';
  }
  // 4. Check Major Industry & Tech Reports
  else if (MAJOR_INDUSTRY_DOMAINS.some((d) => domain.includes(d))) {
    sourceType = 'report';
    credibility = 'high';
  }
  // 5. Check Reputable Tech / Global News
  else if (REPUTABLE_NEWS_DOMAINS.some((d) => domain.includes(d))) {
    sourceType = 'news';
    credibility = 'medium';
  }
  // 6. Generic or Social / Personal Blog domains
  else {
    sourceType = 'article';
    credibility = searchScore > 0.8 ? 'medium' : 'low';
  }

  // Evaluate Relevance based on search ranking / score
  let relevance: SourceRelevance = 'medium';
  if (searchScore >= 0.75) {
    relevance = 'high';
  } else if (searchScore < 0.4) {
    relevance = 'low';
  }

  // Check title indicators for research papers or reports
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('whitepaper') || lowerTitle.includes('survey report') || lowerTitle.includes('annual report')) {
    sourceType = 'report';
  } else if (lowerTitle.includes('journal') || lowerTitle.includes('ieee') || lowerTitle.includes('proceedings of')) {
    sourceType = 'paper';
  }

  return {
    domain,
    publisher,
    sourceType,
    credibility,
    relevance,
  };
}
