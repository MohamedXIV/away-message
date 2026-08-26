import React from 'react';

export type InternetHost =
  | 'findit.local'
  | 'downloadhub.local'
  | 'pulsechat.local'
  | 'techmart.local'
  | 'bidbay.local'
  | 'myplace.local'
  | 'mailbox.local'
  | 'nightboard.local'
  | 'citywire.local'
  | 'jobs.local'
  | 'goldnet.local'
  | 'weatherbuddy.local'
  | 'retroamp.local'
  | 'orionsoft.local'
  | 'zipmate.local'
  | 'safesweep.local'
  | 'peerbox.local'
  | 'motellink.local'
  | 'searchmate.local';

export interface ParsedUrl {
  rawUrl: string;
  normalizedUrl: string;
  protocol: 'http:' | 'https:';
  host: string;
  pathname: string;
  pathSegments: string[];
  searchParams: Record<string, string>;
  hash: string;
}

export interface SiteRouteProps {
  url: ParsedUrl;
  navigate: (url: string) => void;
  params: Record<string, string>;
  searchParams: Record<string, string>;
  onNavigate?: (url: string) => void;
  routeParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export interface SiteRouteDefinition {
  host: string;
  pathPattern: string;
  component: React.ComponentType<SiteRouteProps>;
  pageTitle: string;
}

export interface RouteMatchResult {
  host: string;
  pathname: string;
  params: Record<string, string>;
  component: React.ComponentType<SiteRouteProps>;
  pageTitle: string;
  parsedUrl?: ParsedUrl;
  routeParams?: Record<string, string>;
  is404?: boolean;
}

export interface SearchIndexEntry {
  id: string;
  title: string;
  url: string;
  snippet: string;
  category: 'software' | 'news' | 'community' | 'hardware' | 'social';
  keywords: string[];
  availableFromDay: number;      // 1..14
  availableUntilDay?: number;
  requiredFlags?: string[];      // Narrative flags required to appear
  datePublished: string;        // Period authentic date (e.g. 'Oct 12, 2004')
  score?: number;
}

export interface SearchResultSummary {
  query: string;
  normalizedQuery: string;
  category: string;
  totalMatches: number;
  searchDurationSeconds: number;
  results: SearchIndexEntry[];
}
