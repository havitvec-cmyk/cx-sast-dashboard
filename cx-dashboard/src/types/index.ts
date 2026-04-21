export interface VulnerabilityRow {
  Entity: string;
  'ITPM ID': string;
  'Business App Name': string;
  'Checkmarx project name': string;
  'CX Project ID': string;
  'DORA Criticallity': string;
  'PCI DSS Relevance': string;
  'Internet Facing': string;
  'AGO SME': string;
  'Technical Contact': string;
  LSO: string;
  RSO: string;
  Query: string;
  QueryPath: string;
  Custom: string;
  'PCI DSS v3.2.1': string;
  'OWASP TOP 10 2013': string;
  'FISMA 2014': string;
  'NIST SP 800-53': string;
  'OWASP Top 10 2017': string;
  'OWASP Mobile Top 10 2016': string;
  'OWASP Top 10 API': string;
  'ASD STIG 4.10': string;
  'OWASP Top 10 2010': string;
  'CWE top 25': string;
  'MOIS(KISA) Secure Coding 2021': string;
  'OWASP ASVS': string;
  'OWASP Top 10 2021': string;
  'SANS top 25': string;
  'ASA Mobile Premium': string;
  'ASA Premium': string;
  'Top Tier': string;
  'ASD STIG 5.3': string;
  'Base Preset': string;
  'OWASP Top 10 API 2023': string;
  'PCI DSS v4.0': string;
  SrcFileName: string;
  Line: string;
  Column: string;
  NodeId: string;
  Name: string;
  DestFileName: string;
  DestLine: string;
  DestColumn: string;
  DestNodeId: string;
  DestName: string;
  'Result State': string;
  'Result Severity': string;
  'Assigned To': string;
  Comment: string;
  Link: string;
  'Result Status': string;
  'Detection Date': string;
}

export const EXTRACT_COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#60a5fa',
  '#facc15',
  '#f87171',
];

export interface Extract {
  id: string;
  name: string;
  timestamp: Date;
  rows: VulnerabilityRow[];
  color: string;
}

export interface SeverityBreakdown {
  High: number;
  Medium: number;
  Low: number;
  Info: number;
}

export interface Metrics {
  total: number;
  bySeverity: SeverityBreakdown;
  byState: Record<string, number>;
  byProject: Record<string, number>;
  byQuery: [string, number][];
  byEntity: Record<string, number>;
  byDoraCriticality: Record<string, number>;
  internetFacing: { yes: number; no: number; unknown: number };
  assignedVsUnassigned: { assigned: number; unassigned: number };
  complianceCoverage: Record<string, number>;
  byStatus: Record<string, number>;
}

export const COMPLIANCE_FIELDS = [
  'PCI DSS v3.2.1',
  'OWASP TOP 10 2013',
  'FISMA 2014',
  'NIST SP 800-53',
  'OWASP Top 10 2017',
  'OWASP Mobile Top 10 2016',
  'OWASP Top 10 API',
  'ASD STIG 4.10',
  'OWASP Top 10 2010',
  'CWE top 25',
  'MOIS(KISA) Secure Coding 2021',
  'OWASP ASVS',
  'OWASP Top 10 2021',
  'SANS top 25',
  'ASA Mobile Premium',
  'ASA Premium',
  'Top Tier',
  'ASD STIG 5.3',
  'Base Preset',
  'OWASP Top 10 API 2023',
  'PCI DSS v4.0',
] as const;

export type ComplianceField = typeof COMPLIANCE_FIELDS[number];
