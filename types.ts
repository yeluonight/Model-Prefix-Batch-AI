
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
  matchSource: 'smart' | 'rule' | 'original' | 'manual'; // 标记匹配来源：智能匹配、规则处理、原样保留、手动编辑
  hasConflict?: boolean; // 是否存在冲突（多个原始模型映射到同一个清洗后名称）
  conflictGroup?: string[]; // 冲突组内的其他原始模型名称
}
