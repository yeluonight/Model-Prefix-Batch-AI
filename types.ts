
export enum ViewMode {
  PREFIXER = 'PREFIXER',
  STANDARDIZER = 'STANDARDIZER'
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ProcessingRule {
  id: string;
  type: 'replace' | 'remove' | 'regex' | 'lowercase';
  target: string;
  replacement: string;
  active: boolean;
}

export interface ModelMapping {
  original: string;
  cleaned: string;
  matchSource: 'smart' | 'rule' | 'original'; // 新增：标记匹配来源
}
