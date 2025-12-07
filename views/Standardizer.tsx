import React, { useState, useEffect, useMemo } from 'react';
import { ApiFetcher } from '../components/ApiFetcher';
import { Button } from '../components/ui/Button';
import { ProcessingRule, ModelMapping } from '../types';

const DEFAULT_DICTIONARY_LIST = [
  // OpenAI
  "o1-preview", "o1-mini", "gpt-4o-2024-08-06", "gpt-4o-mini", "gpt-4o", 
  "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-4-32k", "gpt-4",
  "gpt-3.5-turbo", "dall-e-3", "whisper-1",
  
  // Anthropic
  "claude-3-5-sonnet-20240620", "claude-3-5-sonnet",
  "claude-3-opus-20240229", "claude-3-opus",
  "claude-3-sonnet-20240229", "claude-3-sonnet",
  "claude-3-haiku-20240307", "claude-3-haiku",
  "claude-3-7-sonnet", "claude-3-7-sonnet-20250219",
  "claude-2.1", "claude-2.0", "claude-instant-1.2",
  
  // Google
  "gemini-2.0-flash-thinking-exp-01-21", "gemini-2.0-flash-thinking-exp", 
  "gemini-2.5-pro", "gemini-2.5-flash-thinking", "gemini-2.5-flash-image", "gemini-2.5-flash",
  "gemini-1.5-pro-exp-0801", "gemini-1.5-pro", 
  "gemini-1.5-flash", "gemini-pro-vision", "gemini-pro",
  "gemini-exp-1206",
  
  // DeepSeek
  "deepseek-chat", "deepseek-coder", "deepseek-reasoner", "deepseek-v3", "deepseek-v2",
  "deepseek-r1",
  
  // Moonshot
  "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k",
  
  // Alibaba
  "qwen-max", "qwen-plus", "qwen-turbo", "qwen-long", "qwen-vl-max", "qwen-vl-plus",
  "qwen-2.5-72b-instruct", "qwen-2.5-32b-instruct", "qwen-2.5-7b-instruct",
  
  // Zhipu
  "glm-4-0520", "glm-4", "glm-4-air", "glm-4-flash", "glm-4v",
  
  // Meta
  "llama-3.1-405b-instruct", "llama-3.1-70b-instruct", "llama-3.1-8b-instruct",
  "llama-3.2-90b-vision-instruct", "llama-3.2-11b-vision-instruct",
  
  // X.AI
  "grok-2", "grok-2-mini"
];

const DEFAULT_DICTIONARY = DEFAULT_DICTIONARY_LIST.join('\n');
const REMOTE_DICT_URL = "https://api.llmgateway.io/v1/models";

const DEFAULT_RULES: ProcessingRule[] = [
  { id: '1', type: 'replace', target: 'models/', replacement: '', active: true },
  { id: '2', type: 'remove', target: 'openai/', replacement: '', active: true },
  { id: '3', type: 'lowercase', target: '', replacement: '', active: true },
];

// 全字匹配过滤列表 (不区分大小写)
// 已添加: image, top_p, tools
const MISC_FILTER_KEYWORDS = ['sonar', 'fp-16', 'text', 'auto', 'fp-8', 'custom', 'image', 'top_p', 'tools'];

export const Standardizer: React.FC = () => {
  // State
  const [models, setModels] = useState<string[]>([]);
  const [rules, setRules] = useState<ProcessingRule[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [dictionaryInput, setDictionaryInput] = useState('');

  // 手动覆盖状态：{ original: userEditedCleaned }
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  // 当前正在编辑的行
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  
  // Settings
  const [enableSmartMatch, setEnableSmartMatch] = useState(true);
  const [ignoreBedrock, setIgnoreBedrock] = useState(true);
  const [ignoreLlama, setIgnoreLlama] = useState(true);
  const [removeFreeSuffix, setRemoveFreeSuffix] = useState(false);
  const [filterMisc, setFilterMisc] = useState(true);
  const [showFilteredDict, setShowFilteredDict] = useState(false); // Toggle between Raw and Effective dict
  
  const [dictUrl, setDictUrl] = useState(REMOTE_DICT_URL);
  const [loadingDict, setLoadingDict] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [useQuotes, setUseQuotes] = useState(false);

  // Lifecycle: Load Local Storage
  useEffect(() => {
    const savedRules = localStorage.getItem('std_rules');
    const savedModels = localStorage.getItem('std_models');
    const savedDict = localStorage.getItem('std_dict');
    const savedIgnoreBedrock = localStorage.getItem('std_ignore_bedrock');
    const savedIgnoreLlama = localStorage.getItem('std_ignore_llama');
    const savedRemoveFree = localStorage.getItem('std_remove_free');
    const savedFilterMisc = localStorage.getItem('std_filter_misc');
    const savedOverrides = localStorage.getItem('std_manual_overrides');

    setRules(savedRules ? JSON.parse(savedRules) : DEFAULT_RULES);
    setModels(savedModels ? JSON.parse(savedModels) : []);
    setDictionaryInput(savedDict || DEFAULT_DICTIONARY);
    if (savedIgnoreBedrock !== null) setIgnoreBedrock(savedIgnoreBedrock === 'true');
    if (savedIgnoreLlama !== null) setIgnoreLlama(savedIgnoreLlama === 'true');
    if (savedRemoveFree !== null) setRemoveFreeSuffix(savedRemoveFree === 'true');
    if (savedFilterMisc !== null) setFilterMisc(savedFilterMisc === 'true');
    if (savedOverrides) setManualOverrides(JSON.parse(savedOverrides));
  }, []);

  // Lifecycle: Save to Local Storage
  useEffect(() => {
    localStorage.setItem('std_rules', JSON.stringify(rules));
    localStorage.setItem('std_models', JSON.stringify(models));
    localStorage.setItem('std_dict', dictionaryInput);
    localStorage.setItem('std_ignore_bedrock', String(ignoreBedrock));
    localStorage.setItem('std_ignore_llama', String(ignoreLlama));
    localStorage.setItem('std_remove_free', String(removeFreeSuffix));
    localStorage.setItem('std_filter_misc', String(filterMisc));
    localStorage.setItem('std_manual_overrides', JSON.stringify(manualOverrides));
  }, [rules, models, dictionaryInput, ignoreBedrock, ignoreLlama, removeFreeSuffix, filterMisc, manualOverrides]);

  const extractModelNames = (data: any): string[] => {
    const candidates = new Set<string>();

    const stripPrefix = (str: string) => {
        if (!str) return '';
        if (str.includes('/')) {
            return str.split('/').pop() || str;
        }
        return str;
    };

    const isValidModelName = (str: any) => {
        if (typeof str !== 'string') return false;
        if (str.length < 2) return false;
        if (str.includes(' ') || str.includes('http')) return false;
        
        const lower = str.toLowerCase();
        if (lower.startsWith('modelperm-')) return false;
        if (lower.startsWith('file-')) return false;
        if (lower.startsWith('ft-')) return false;
        if (lower.startsWith('system-')) return false;
        if (lower.includes('curie:') || lower.includes('davinci:') || lower.includes('babbage:')) return false;

        return true;
    };

    const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;

        // Skip Gateway internal IDs if possible, but usually we want the `id` field
        if (node.providerId === 'llmgateway') {
           // Keep going, might be inside
        }

        let found = false;
        if (node.id && typeof node.id === 'string' && isValidModelName(node.id)) {
            candidates.add(stripPrefix(node.id));
            found = true;
        }
        
        // Fallback properties
        if (!found) {
             if (node.modelName && typeof node.modelName === 'string' && isValidModelName(node.modelName)) {
                candidates.add(stripPrefix(node.modelName));
            } else if (node.model_name && typeof node.model_name === 'string' && isValidModelName(node.model_name)) {
                candidates.add(stripPrefix(node.model_name));
            }
        }

        if (Array.isArray(node)) {
            node.forEach(walk);
        } else {
            Object.values(node).forEach(child => {
                if (typeof child === 'object') walk(child);
            });
        }
    };

    try {
        walk(data);
    } catch (e) {
        console.error("JSON 解析失败", e);
    }

    return Array.from(candidates);
  };

  const isBedrockModel = (name: string) => {
      // 修复：不再过滤 'claude' 或 'mistral' 这样的通用名称
      // 只过滤典型的 Bedrock/Provider 前缀，如 anthropic.claude, amazon.titan 等
      return /(^|[\.-])(anthropic|amazon|titan|meta|cohere|ai21|jurassic)([\.-]|$)/i.test(name);
  };

  const isLlamaModel = (name: string) => {
      return /(^|[\.-])llama/i.test(name);
  };
  
  const isMiscModel = (name: string) => {
      return MISC_FILTER_KEYWORDS.some(k => name.toLowerCase().includes(k));
  };

  const applyFilters = (list: string[]) => {
      let filtered = [...list];
      if (ignoreBedrock) {
          filtered = filtered.filter(m => !isBedrockModel(m));
      }
      if (ignoreLlama) {
          filtered = filtered.filter(m => !isLlamaModel(m));
      }
      if (filterMisc) {
          filtered = filtered.filter(m => !isMiscModel(m));
      }
      return filtered;
  };

  // Calculate effective dictionary for display
  const filteredDictionaryText = useMemo(() => {
    const rawList = dictionaryInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    const effectiveList = applyFilters(rawList);
    return effectiveList.join('\n');
  }, [dictionaryInput, ignoreBedrock, ignoreLlama, filterMisc]);

  const handleFetchRemoteDict = async (urlToFetch: string = dictUrl) => {
    if (!urlToFetch) return;
    
    let targetUrl = urlToFetch.trim();
    
    // Ensure Protocol
    if (!targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
    }

    // Smart append path if only domain is provided
    try {
        const urlObj = new URL(targetUrl);
        if (urlObj.pathname === '/' || urlObj.pathname === '') {
            targetUrl = targetUrl.replace(/\/$/, '') + '/v1/models';
        }
        
        // Add required query parameters
        // include_deactivated? string, exclude_deprecated? string
        if (!targetUrl.includes('?')) {
             targetUrl += '?include_deactivated=true&exclude_deprecated=true';
        }
        
        setDictUrl(targetUrl);
    } catch (e) {
        // invalid url
    }

    setLoadingDict(true);
    setFetchStatus('连接中...');
    
    const performFetch = async (url: string, useProxy = false) => {
        const fetchUrl = useProxy 
            ? `https://corsproxy.io/?${encodeURIComponent(url)}` 
            : url;
            
        const response = await fetch(fetchUrl, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
    };

    try {
      let text = '';
      try {
          // 1. 尝试直连
          text = await performFetch(targetUrl, false);
      } catch (directError) {
          console.warn("Direct fetch failed, trying proxy...", directError);
          // 2. 直连失败，尝试使用 CORS 代理 (解决浏览器跨域限制)
          text = await performFetch(targetUrl, true);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Fallback to text list if not JSON
        data = text.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
      }

      const extractedModels = extractModelNames(data);
      
      if (extractedModels.length > 0) {
        setDictionaryInput(prev => {
             const currentList = prev.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
             const allModels = new Set([
                 ...currentList,
                 ...extractedModels,
                 ...DEFAULT_DICTIONARY_LIST
             ]);

             return Array.from(allModels)
                .sort((a: string, b: string) => b.length - a.length)
                .join('\n');
        });
        setFetchStatus(`成功更新字典 (新增 ${extractedModels.length} 个)`);
      } else {
        setFetchStatus('连接成功，但未识别到模型数据');
      }
    } catch (error: any) {
      console.error("Dictionary fetch error:", error);
      let msg = error.message;
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          msg = '无法连接到服务器 (跨域限制已尝试代理绕过，但仍失败)';
      }
      setFetchStatus('错误: ' + msg);
    } finally {
      setTimeout(() => setFetchStatus(''), 8000);
      setLoadingDict(false);
    }
  };

  const addManualInput = () => {
    if (!manualInput.trim()) return;
    const newItems = manualInput.split(/[\n,，]+/).map(s => s.trim()).filter(s => s && !models.includes(s));
    setModels(prev => [...prev, ...newItems]);
    setManualInput('');
  };

  const toggleRule = (index: number) => {
    const newRules = [...rules];
    newRules[index].active = !newRules[index].active;
    setRules(newRules);
  };
  
  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const addRule = () => {
    setRules([...rules, {
      id: Date.now().toString(),
      type: 'replace',
      target: '',
      replacement: '',
      active: true
    }]);
  };

  const updateRule = (index: number, field: keyof ProcessingRule, value: any) => {
    const newRules = [...rules];
    (newRules[index] as any)[field] = value;
    setRules(newRules);
  };

  // 自动计算的模型映射（不含手动覆盖）
  const autoProcessedModels = useMemo((): Omit<ModelMapping, 'hasConflict' | 'conflictGroup'>[] => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Build effective dictionary for matching
    let rawDictList = dictionaryInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    rawDictList = applyFilters(rawDictList);
    const sortedDict = Array.from(new Set<string>(rawDictList)).sort((a, b) => b.length - a.length);

    const getClaudeVariants = (input: string) => {
        const lower = input.toLowerCase();
        const claudeRegex = /claude[^\w]*?(sonnet|haiku|opus)[^\w]*([\d]+[.\-][\d]+|[\d]+)|claude[^\w]*([\d]+[.\-][\d]+|[\d]+)[^\w]*?(sonnet|haiku|opus)/i;
        const match = lower.match(claudeRegex);

        if (match) {
            const part1 = match[1] || match[3];
            const part2 = match[2] || match[4];

            let type = '';
            let version = '';

            if (['sonnet', 'haiku', 'opus'].includes(part1)) {
                type = part1;
                version = part2;
            } else {
                type = part2;
                version = part1;
            }

            const vDash = version.replace(/\./g, '-');
            const vDot = version.replace(/-/g, '.');

            return [
                `claude-${vDash}-${type}`,
                `claude-${vDot}-${type}`,
                `claude-${type}-${vDash}`,
                `claude-${type}-${vDot}`
            ];
        }
        return [];
    };

    return models.map(original => {
      let processedOriginal = original;

      if (removeFreeSuffix) {
          processedOriginal = processedOriginal.replace(/:free$/i, '');
      }

      if (enableSmartMatch) {
        const normOriginal = normalize(processedOriginal);

        if (processedOriginal.toLowerCase().includes('claude')) {
            const variants = getClaudeVariants(processedOriginal);
            for (const v of variants) {
                const normV = normalize(v);
                const exactMatch = sortedDict.find(d => normalize(d) === normV);
                if (exactMatch) return { original, cleaned: exactMatch, matchSource: 'smart' as const };

                const containsMatch = sortedDict.find(d => normalize(d).includes(normV) || normV.includes(normalize(d)));
                if (containsMatch) return { original, cleaned: containsMatch, matchSource: 'smart' as const };
            }
        }

        const match = sortedDict.find((std: string) => {
           const normStd = normalize(std);
           if (normStd.length < 3) return false;
           return normOriginal.includes(normStd);
        });

        if (match) {
          return { original, cleaned: match, matchSource: 'smart' as const };
        }
      }

      let ruleProcessed = processedOriginal;
      rules.filter(r => r.active).forEach(rule => {
        try {
          if (rule.type === 'replace') {
            ruleProcessed = ruleProcessed.split(rule.target).join(rule.replacement);
          } else if (rule.type === 'remove') {
            ruleProcessed = ruleProcessed.split(rule.target).join('');
          } else if (rule.type === 'lowercase') {
            ruleProcessed = ruleProcessed.toLowerCase();
          } else if (rule.type === 'regex') {
            const re = new RegExp(rule.target, 'g');
            ruleProcessed = ruleProcessed.replace(re, rule.replacement);
          }
        } catch (e) {
          console.warn('Rule application failed:', e);
        }
      });

      const isChanged = ruleProcessed !== original;
      return {
          original,
          cleaned: ruleProcessed,
          matchSource: isChanged ? 'rule' as const : 'original' as const
      };
    });
  }, [models, rules, dictionaryInput, enableSmartMatch, ignoreBedrock, ignoreLlama, filterMisc, removeFreeSuffix]);

  // 最终处理结果：整合手动覆盖 + 冲突检测
  const processedModels = useMemo((): ModelMapping[] => {
    // 1. 应用手动覆盖
    const withOverrides = autoProcessedModels.map(item => {
      if (manualOverrides[item.original] !== undefined) {
        return {
          ...item,
          cleaned: manualOverrides[item.original],
          matchSource: 'manual' as const
        };
      }
      return item;
    });

    // 2. 检测冲突：找出映射到同一个 cleaned 的多个 original
    const cleanedToOriginals = new Map<string, string[]>();
    withOverrides.forEach(item => {
      const existing = cleanedToOriginals.get(item.cleaned) || [];
      existing.push(item.original);
      cleanedToOriginals.set(item.cleaned, existing);
    });

    // 3. 标记冲突
    return withOverrides.map(item => {
      const conflictGroup = cleanedToOriginals.get(item.cleaned) || [];
      const hasConflict = conflictGroup.length > 1;
      return {
        ...item,
        hasConflict,
        conflictGroup: hasConflict ? conflictGroup.filter(o => o !== item.original) : undefined
      };
    });
  }, [autoProcessedModels, manualOverrides]);

  // 冲突统计
  const conflictStats = useMemo(() => {
    const conflictedCleanedNames = new Set<string>();
    processedModels.forEach(m => {
      if (m.hasConflict) {
        conflictedCleanedNames.add(m.cleaned);
      }
    });
    return {
      conflictGroupCount: conflictedCleanedNames.size,
      conflictedModelCount: processedModels.filter(m => m.hasConflict).length
    };
  }, [processedModels]);

  const getResultJson = () => {
    const obj: Record<string, string> = {};
    processedModels.forEach(m => {
        // 标准名 -> 原始名 (如果有重复的标准名，后面的会覆盖前面的)
        obj[m.cleaned] = m.original;
    });
    return JSON.stringify(obj, null, 2);
  };

  const getCleanedList = () => {
      const unique = Array.from(new Set(processedModels.map(m => m.cleaned)));
      return unique.map(m => useQuotes ? `"${m}"` : m).join(',');
  };

  const changedCount = processedModels.filter(m => m.original !== m.cleaned).length;

  // 编辑处理函数
  const startEditing = (original: string, currentCleaned: string) => {
    setEditingRow(original);
    setEditingValue(currentCleaned);
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditingValue('');
  };

  const saveEditing = () => {
    if (editingRow && editingValue.trim()) {
      setManualOverrides(prev => ({
        ...prev,
        [editingRow]: editingValue.trim()
      }));
    }
    cancelEditing();
  };

  const clearOverride = (original: string) => {
    setManualOverrides(prev => {
      const updated = { ...prev };
      delete updated[original];
      return updated;
    });
  };

  const clearAllOverrides = () => {
    setManualOverrides({});
  };

  // 处理键盘事件
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div className="animate-enter space-y-8 max-w-6xl mx-auto">
      {/* 1. Input Area */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow duration-300">
             <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-4">1. 数据源</h3>
             <div className="space-y-4">
                <ApiFetcher onModelsFetched={(newModels) => {
                    const unique = newModels.filter(m => !models.includes(m));
                    setModels(prev => [...prev, ...unique]);
                }} />
                
                <div>
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">手动输入 (使用逗号隔开)</label>
                    <div className="flex gap-2">
                        <textarea 
                            className="w-full h-24 p-3 bg-subtle border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                            placeholder="openai/gpt-4o&#10;anthropic.claude-3-sonnet..."
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                        ></textarea>
                    </div>
                    <div className="flex justify-between mt-2">
                        <Button size="sm" variant="ghost" onClick={() => setModels([])} className="text-error-text hover:bg-error-bg">清空列表</Button>
                        <Button size="sm" onClick={addManualInput}>添加到列表</Button>
                    </div>
                </div>
             </div>
          </div>

          {/* Rules Panel */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow duration-300">
             <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-4">2. 清洗规则</h3>
             
             <div className="space-y-3 mb-4">
                {rules.map((rule, idx) => (
                  <div key={rule.id} className="flex items-center gap-2 p-2 bg-subtle rounded-lg border border-border/50">
                     <input 
                        type="checkbox" 
                        checked={rule.active} 
                        onChange={() => toggleRule(idx)}
                        className="w-4 h-4 rounded text-accent focus:ring-accent border-gray-300"
                     />
                     <select 
                        value={rule.type}
                        onChange={(e) => updateRule(idx, 'type', e.target.value)}
                        className="bg-white border border-border text-xs rounded px-2 py-1 focus:outline-none focus:border-accent"
                     >
                        <option value="replace">替换</option>
                        <option value="remove">删除</option>
                        <option value="lowercase">转小写</option>
                        <option value="regex">正则</option>
                     </select>
                     
                     {rule.type !== 'lowercase' && (
                         <>
                            <input 
                                className="flex-1 w-16 min-w-0 bg-white border border-border text-xs rounded px-2 py-1 focus:outline-none focus:border-accent font-mono"
                                placeholder="匹配..."
                                value={rule.target}
                                onChange={(e) => updateRule(idx, 'target', e.target.value)}
                            />
                            {rule.type !== 'remove' && (
                                <>
                                    <span className="text-tertiary">&rarr;</span>
                                    <input 
                                        className="flex-1 w-16 min-w-0 bg-white border border-border text-xs rounded px-2 py-1 focus:outline-none focus:border-accent font-mono"
                                        placeholder="替换为..."
                                        value={rule.replacement}
                                        onChange={(e) => updateRule(idx, 'replacement', e.target.value)}
                                    />
                                </>
                            )}
                         </>
                     )}
                     <button onClick={() => deleteRule(idx)} className="text-tertiary hover:text-red-500 px-1">×</button>
                  </div>
                ))}
             </div>
             <Button size="sm" variant="secondary" onClick={addRule} className="w-full border-dashed">+ 添加规则</Button>
          </div>
        </div>

        {/* Dictionary Settings */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow duration-300">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">3. 标准字典 (智能匹配)</h3>
                <div className="flex items-center gap-3">
                   <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={enableSmartMatch} onChange={(e) => setEnableSmartMatch(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                        <span className="ml-2 text-xs font-medium text-primary">启用</span>
                    </label>
                </div>
             </div>
             
             <div className="space-y-4 flex-1 flex flex-col">
                <div className="bg-subtle p-3 rounded-lg border border-border/50 space-y-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                           <input 
                              className="flex-1 bg-white border border-border text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent"
                              value={dictUrl}
                              onChange={(e) => setDictUrl(e.target.value)}
                              placeholder="字典 URL (如 https://api.llmgateway.io)"
                           />
                           <Button size="sm" onClick={() => handleFetchRemoteDict()} isLoading={loadingDict}>更新</Button>
                        </div>
                    </div>
                    {fetchStatus && <p className={`text-[10px] text-right ${fetchStatus.includes('错误') || fetchStatus.includes('失败') ? 'text-error-text' : 'text-secondary'}`}>{fetchStatus}</p>}
                    
                    <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={ignoreBedrock} onChange={(e) => setIgnoreBedrock(e.target.checked)} className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5" />
                            <span className="text-[11px] text-secondary">过滤 Bedrock 前缀</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={ignoreLlama} onChange={(e) => setIgnoreLlama(e.target.checked)} className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5" />
                            <span className="text-[11px] text-secondary">过滤 Llama</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={removeFreeSuffix} onChange={(e) => setRemoveFreeSuffix(e.target.checked)} className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5" />
                            <span className="text-[11px] text-secondary">移除 :free 后缀</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={filterMisc} onChange={(e) => setFilterMisc(e.target.checked)} className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5" />
                            <span className="text-[11px] text-secondary">过滤杂项 (Image/Tools...)</span>
                        </label>
                    </div>
                </div>

                <div className="flex-1 relative min-h-[200px] flex flex-col">
                    <div className="flex justify-end mb-1">
                        <button 
                           onClick={() => setShowFilteredDict(!showFilteredDict)}
                           className="text-[10px] text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1"
                        >
                           {showFilteredDict ? (
                               <>
                                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                   返回编辑
                               </>
                           ) : (
                               <>
                                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                   预览过滤效果
                               </>
                           )}
                        </button>
                    </div>
                    <textarea 
                        className={`flex-1 w-full p-3 border rounded-lg text-xs font-mono focus:outline-none resize-none leading-relaxed transition-colors ${
                            showFilteredDict 
                                ? 'bg-indigo-50/50 border-indigo-100 text-primary' 
                                : 'bg-subtle border-border focus:ring-1 focus:ring-accent'
                        }`}
                        value={showFilteredDict ? filteredDictionaryText : dictionaryInput}
                        onChange={showFilteredDict ? undefined : (e) => setDictionaryInput(e.target.value)}
                        readOnly={showFilteredDict}
                        placeholder="标准模型名称列表..."
                    />
                </div>
                <p className="text-[10px] text-tertiary">
                  {showFilteredDict 
                    ? '正在预览经过过滤规则处理后的字典，实际匹配将使用此列表。' 
                    : '上方为原始字典。勾选上方过滤选项会实时影响匹配逻辑，点击“预览”可查看实际生效的列表。'}
                </p>
             </div>
        </div>
      </div>

      {/* 2. Result Preview */}
      <div className="space-y-6 border-t border-border pt-8">
         {/* 冲突警告栏 */}
         {conflictStats.conflictGroupCount > 0 && (
           <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
             <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             <div className="flex-1">
               <p className="text-sm font-medium text-amber-800">
                 检测到 {conflictStats.conflictGroupCount} 组映射冲突
               </p>
               <p className="text-xs text-amber-700 mt-1">
                 共 {conflictStats.conflictedModelCount} 个模型映射到了相同的清洗后名称。请点击表格中的清洗后名称进行手动编辑以解决冲突。
               </p>
             </div>
           </div>
         )}

         <div className="flex justify-between items-end">
            <div>
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">处理结果预览</h3>
                <p className="text-xs text-tertiary mt-1">
                    共 {processedModels.length} 个模型
                    {changedCount > 0 && <span className="text-accent ml-1">({changedCount} 变更)</span>}
                    {Object.keys(manualOverrides).length > 0 && (
                      <span className="text-purple-600 ml-1">({Object.keys(manualOverrides).length} 手动编辑)</span>
                    )}
                </p>
            </div>
            {Object.keys(manualOverrides).length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearAllOverrides} className="text-error-text hover:bg-error-bg">
                清除所有手动编辑
              </Button>
            )}
         </div>

         {/* Table View */}
         <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-subtle sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 text-xs font-medium text-secondary uppercase tracking-wider border-b border-border w-[40%]">原始名称</th>
                    <th className="py-3 px-4 text-xs font-medium text-secondary uppercase tracking-wider border-b border-border w-[40%]">清洗后名称 <span className="text-tertiary font-normal">(点击编辑)</span></th>
                    <th className="py-3 px-4 text-xs font-medium text-secondary uppercase tracking-wider border-b border-border w-[80px]">来源</th>
                    <th className="py-3 px-4 text-xs font-medium text-secondary uppercase tracking-wider border-b border-border w-[60px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {processedModels.length === 0 ? (
                      <tr>
                          <td colSpan={4} className="py-8 text-center text-tertiary text-sm italic">
                              请先在左侧添加数据源...
                          </td>
                      </tr>
                  ) : (
                      processedModels.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`group transition-colors ${
                            row.hasConflict
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : 'hover:bg-subtle'
                          }`}
                        >
                          {/* 原始名称列 */}
                          <td className="py-2.5 px-4 text-xs font-mono text-secondary break-all">
                            <div className="flex items-center gap-2">
                              {row.hasConflict && (
                                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" title={`冲突: 与 ${row.conflictGroup?.join(', ')} 映射到相同名称`}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <span className="break-all">{row.original}</span>
                            </div>
                            {row.hasConflict && row.conflictGroup && (
                              <div className="text-[10px] text-amber-600 mt-1 pl-6">
                                冲突: 与 {row.conflictGroup.slice(0, 2).join(', ')}{row.conflictGroup.length > 2 ? ` 等 ${row.conflictGroup.length} 个` : ''} 相同
                              </div>
                            )}
                          </td>

                          {/* 清洗后名称列（可编辑）*/}
                          <td className="py-2.5 px-4">
                            {editingRow === row.original ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={handleEditKeyDown}
                                  autoFocus
                                  className="flex-1 px-2 py-1 text-xs font-mono border border-accent rounded focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                                <button
                                  onClick={saveEditing}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="保存"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                  title="取消"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => startEditing(row.original, row.cleaned)}
                                className={`text-xs font-mono font-medium break-all cursor-pointer hover:bg-gray-100 px-2 py-1 -mx-2 -my-1 rounded transition-colors ${
                                  row.matchSource === 'manual'
                                    ? 'text-purple-600'
                                    : row.original !== row.cleaned
                                      ? 'text-accent'
                                      : 'text-primary'
                                }`}
                                title="点击编辑"
                              >
                                {row.cleaned}
                              </div>
                            )}
                          </td>

                          {/* 来源标签列 */}
                          <td className="py-2.5 px-4 text-center">
                              {row.matchSource === 'smart' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                      智能
                                  </span>
                              )}
                              {row.matchSource === 'rule' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-100">
                                      规则
                                  </span>
                              )}
                              {row.matchSource === 'manual' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                      手动
                                  </span>
                              )}
                              {row.matchSource === 'original' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-100">
                                      原样
                                  </span>
                              )}
                          </td>

                          {/* 操作列 */}
                          <td className="py-2.5 px-4 text-center">
                            {row.matchSource === 'manual' ? (
                              <button
                                onClick={() => clearOverride(row.original)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="撤销手动编辑"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => startEditing(row.original, row.cleaned)}
                                className="p-1 text-gray-400 hover:text-accent hover:bg-accent/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="编辑"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
         </div>

         {/* Output Areas: Text List & JSON */}
         <div className="grid md:grid-cols-2 gap-6">
            {/* Text List Output */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[300px] hover:shadow-md transition-shadow duration-300">
              <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">文本列表</span>
                <div className="flex items-center gap-4">
                    <label className="flex items-center cursor-pointer select-none gap-2 group">
                        <input 
                            type="checkbox" 
                            checked={useQuotes} 
                            onChange={(e) => setUseQuotes(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-accent focus:ring-accent border-gray-300"
                        />
                        <span className="text-[11px] font-medium text-secondary group-hover:text-primary transition-colors">双引号</span>
                    </label>
                    <div className="h-3 w-[1px] bg-gray-200"></div>
                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getCleanedList())} className="!h-7 !text-xs hover:bg-gray-100">复制</Button>
                </div>
              </div>
              <textarea 
                readOnly
                className="flex-1 p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white"
                value={processedModels.length > 0 ? getCleanedList() : ''}
                placeholder="结果..."
              />
            </div>

            {/* JSON Output */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[300px] hover:shadow-md transition-shadow duration-300">
              <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
                 <span className="text-xs font-bold text-secondary uppercase tracking-wider">JSON 映射表</span>
                 <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getResultJson())} className="!h-7 !text-xs hover:bg-gray-100">复制</Button>
              </div>
              <textarea 
                readOnly
                className="flex-1 p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white whitespace-pre"
                value={processedModels.length > 0 ? getResultJson() : ''}
                placeholder="{ ... }"
              />
            </div>
         </div>
      </div>
    </div>
  );
};
