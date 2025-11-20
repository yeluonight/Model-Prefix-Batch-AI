import React, { useState, useEffect, useMemo } from 'react';
import { ApiFetcher } from '../components/ApiFetcher';
import { Button } from '../components/ui/Button';
import { ProcessingRule, ModelMapping } from '../types';
import { Input } from '../components/ui/Input';

const DEFAULT_DICTIONARY_LIST = [
  // OpenAI
  "o1-preview", "o1-mini", "gpt-4o-2024-08-06", "gpt-4o-mini", "gpt-4o", 
  "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-4-32k", "gpt-4",
  "gpt-3.5-turbo", "dall-e-3", "whisper-1",
  
  // Anthropic (Standard format usually: claude-ver-name)
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
const MISC_FILTER_KEYWORDS = ['sonar', 'fp-16', 'text', 'auto', 'fp-8', 'custom'];

export const Standardizer: React.FC = () => {
  // State
  const [models, setModels] = useState<string[]>([]);
  const [rules, setRules] = useState<ProcessingRule[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [dictionaryInput, setDictionaryInput] = useState('');
  
  // Settings
  const [enableSmartMatch, setEnableSmartMatch] = useState(true);
  const [ignoreBedrock, setIgnoreBedrock] = useState(true);
  const [ignoreLlama, setIgnoreLlama] = useState(true);
  const [removeFreeSuffix, setRemoveFreeSuffix] = useState(false);
  const [filterMisc, setFilterMisc] = useState(true); // 新增杂项过滤
  
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
    
    setRules(savedRules ? JSON.parse(savedRules) : DEFAULT_RULES);
    setModels(savedModels ? JSON.parse(savedModels) : []);
    setDictionaryInput(savedDict || DEFAULT_DICTIONARY);
    if (savedIgnoreBedrock !== null) setIgnoreBedrock(savedIgnoreBedrock === 'true');
    if (savedIgnoreLlama !== null) setIgnoreLlama(savedIgnoreLlama === 'true');
    if (savedRemoveFree !== null) setRemoveFreeSuffix(savedRemoveFree === 'true');
    if (savedFilterMisc !== null) setFilterMisc(savedFilterMisc === 'true');
    
    if (!savedDict) {
      handleFetchRemoteDict(REMOTE_DICT_URL);
    }
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
  }, [rules, models, dictionaryInput, ignoreBedrock, ignoreLlama, removeFreeSuffix, filterMisc]);

  // 深度递归提取器：扫描 JSON 树
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

        if (node.providerId === 'llmgateway') {
            return;
        }

        let found = false;
        if (node.modelName && typeof node.modelName === 'string' && isValidModelName(node.modelName)) {
            candidates.add(stripPrefix(node.modelName));
            found = true;
        }
        if (!found) {
            if (node.id && typeof node.id === 'string' && isValidModelName(node.id)) {
                candidates.add(stripPrefix(node.id));
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
      return /^(anthropic|amazon|meta|cohere|ai21|mistral)\./i.test(name);
  };

  const isLlamaModel = (name: string) => {
      return name.toLowerCase().startsWith('llama');
  };
  
  // 精确全字匹配过滤
  const isMiscModel = (name: string) => {
      return MISC_FILTER_KEYWORDS.includes(name.toLowerCase());
  };

  const handleFetchRemoteDict = async (urlToFetch: string = dictUrl) => {
    if (!urlToFetch) return;
    setLoadingDict(true);
    setFetchStatus('连接中...');
    
    try {
      let text = '';
      const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(id);
          return response;
        } catch (e) {
          clearTimeout(id);
          throw e;
        }
      };

      const fetchStrategies = [
        async () => {
            const res = await fetchWithTimeout(urlToFetch);
            if (!res.ok) throw new Error('Direct');
            return await res.text();
        },
        async () => {
            const res = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(urlToFetch)}`);
            if (!res.ok) throw new Error('AllOrigins');
            return await res.text();
        },
        async () => {
            const res = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(urlToFetch)}`);
            if (!res.ok) throw new Error('CorsProxy');
            return await res.text();
        }
      ];

      let success = false;
      for (const strategy of fetchStrategies) {
        try {
            text = await strategy();
            if (text && text.length > 0) {
                success = true;
                break;
            }
        } catch (e) {}
      }

      if (!success) throw new Error('All strategies failed');

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
      }

      const extractedModels = extractModelNames(data);
      
      if (extractedModels.length > 0) {
        setDictionaryInput(prev => {
             // 1. 合并现有、新获取的和默认的 (创建一个大集合)
             const currentList = prev.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
             const allModels = new Set([
                 ...currentList,
                 ...extractedModels,
                 ...DEFAULT_DICTIONARY_LIST
             ]);

             // 2. 转换为数组
             let mergedList = Array.from(allModels);

             // 3. 统一应用过滤规则 (对合并后的全量数据进行清洗)
             if (ignoreBedrock) {
                 mergedList = mergedList.filter(m => !isBedrockModel(m));
             }

             if (ignoreLlama) {
                 mergedList = mergedList.filter(m => !isLlamaModel(m));
             }
             
             if (filterMisc) {
                 mergedList = mergedList.filter(m => !isMiscModel(m));
             }

             // 4. 排序并返回
             return mergedList
                .sort((a: string, b: string) => b.length - a.length)
                .join('\n');
        });
        setFetchStatus(`成功更新字典`);
        setTimeout(() => setFetchStatus(''), 3000);
      } else {
        setFetchStatus('未识别到数据');
        setTimeout(() => setFetchStatus(''), 3000);
      }
    } catch (error: any) {
      setFetchStatus('同步超时或失败');
      setTimeout(() => setFetchStatus(''), 3000);
    } finally {
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

  const processedModels = useMemo((): ModelMapping[] => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dictList = dictionaryInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    const sortedDict = [...new Set(dictList)].sort((a: string, b: string) => b.length - a.length); 

    const getClaudeVariants = (input: string) => {
        const lower = input.toLowerCase();
        const claudeRegex = /claude[^\w]*?(sonnet|haiku|opus)[^\w]*?([\d]+[.\-][\d]+|[\d]+)|claude[^\w]*?([\d]+[.\-][\d]+|[\d]+)[^\w]*?(sonnet|haiku|opus)/i;
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
                if (exactMatch) return { original, cleaned: exactMatch, matchSource: 'smart' };
                
                const containsMatch = sortedDict.find(d => normalize(d).includes(normV) || normV.includes(normalize(d)));
                if (containsMatch) return { original, cleaned: containsMatch, matchSource: 'smart' };
            }
        }

        const match = sortedDict.find((std: string) => {
           const normStd = normalize(std);
           if (normStd.length < 3) return false; 
           return normOriginal.includes(normStd);
        });

        if (match) {
          return { original, cleaned: match, matchSource: 'smart' };
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
          matchSource: isChanged ? 'rule' : 'original' 
      };
    });
  }, [models, rules, dictionaryInput, enableSmartMatch, removeFreeSuffix]);

  const getResultJson = () => {
    const obj: Record<string, string> = {};
    processedModels.forEach(m => {
        obj[m.original] = m.cleaned;
    });
    return JSON.stringify(obj, null, 2);
  };

  // 计算变更数量
  const changedCount = processedModels.filter(m => m.original !== m.cleaned).length;

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
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">手动输入 (每行一个)</label>
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
                  <div key={rule.id} className="flex items-center gap-2 bg-subtle p-2 rounded-lg border border-border">
                    <input 
                      type="checkbox" 
                      checked={rule.active} 
                      onChange={() => toggleRule(idx)}
                      className="rounded text-accent focus:ring-accent border-gray-300"
                    />
                    <select 
                      className="bg-transparent text-xs font-medium border-none focus:ring-0 text-primary py-1 pl-1"
                      value={rule.type}
                      onChange={(e) => updateRule(idx, 'type', e.target.value)}
                    >
                      <option value="replace">替换</option>
                      <option value="remove">移除</option>
                      <option value="regex">正则</option>
                      <option value="lowercase">转小写</option>
                    </select>
                    
                    {rule.type !== 'lowercase' && (
                        <>
                            <input 
                              className="flex-1 w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:border-accent focus:outline-none"
                              placeholder="目标..."
                              value={rule.target}
                              onChange={(e) => updateRule(idx, 'target', e.target.value)}
                            />
                            <span className="text-tertiary">&rarr;</span>
                            <input 
                              className="flex-1 w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:border-accent focus:outline-none"
                              placeholder="替换为..."
                              value={rule.replacement}
                              onChange={(e) => updateRule(idx, 'replacement', e.target.value)}
                            />
                        </>
                    )}
                    
                    <button onClick={() => deleteRule(idx)} className="text-tertiary hover:text-error-text p-1">×</button>
                  </div>
                ))}
             </div>
             <Button size="sm" variant="secondary" onClick={addRule} className="w-full border-dashed">
                + 添加规则
             </Button>
          </div>
        </div>

        {/* Dictionary & Settings */}
        <div className="space-y-6">
           <div className="bg-white rounded-xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow duration-300 h-full flex flex-col">
              <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">3. 智能匹配字典</h3>
                    <p className="text-[10px] text-tertiary mt-1">系统会自动将左侧混乱的名称匹配到字典中存在的标准名称</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className={`text-xs font-medium transition-colors ${enableSmartMatch ? 'text-accent' : 'text-tertiary'}`}>
                           {enableSmartMatch ? '已启用' : '已禁用'}
                        </span>
                        <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ease-in-out ${enableSmartMatch ? 'bg-accent' : 'bg-gray-200'}`}>
                           <input 
                             type="checkbox" 
                             className="absolute opacity-0 w-full h-full cursor-pointer"
                             checked={enableSmartMatch}
                             onChange={(e) => setEnableSmartMatch(e.target.checked)}
                           />
                           <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ease-in-out ${enableSmartMatch ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                     </label>
                  </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 px-3 py-2 bg-subtle rounded-lg border border-border/50">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                     <input 
                        type="checkbox" 
                        checked={ignoreBedrock} 
                        onChange={(e) => setIgnoreBedrock(e.target.checked)}
                        className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5"
                     />
                     <span className="text-xs text-secondary">过滤 Bedrock</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                     <input 
                        type="checkbox" 
                        checked={ignoreLlama} 
                        onChange={(e) => setIgnoreLlama(e.target.checked)}
                        className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5"
                     />
                     <span className="text-xs text-secondary">过滤 Llama</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                     <input 
                        type="checkbox" 
                        checked={filterMisc} 
                        onChange={(e) => setFilterMisc(e.target.checked)}
                        className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5"
                     />
                     <span className="text-xs text-secondary">过滤杂项 (Sonar/fp16)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                     <input 
                        type="checkbox" 
                        checked={removeFreeSuffix} 
                        onChange={(e) => setRemoveFreeSuffix(e.target.checked)}
                        className="rounded text-accent focus:ring-accent border-gray-300 w-3.5 h-3.5"
                     />
                     <span className="text-xs text-secondary">移除 :free</span>
                  </label>
              </div>

              <div className="flex gap-2 mb-3">
                 <Input 
                    value={dictUrl}
                    onChange={(e) => setDictUrl(e.target.value)}
                    placeholder="字典 API URL..."
                    className="!py-1.5 !text-xs"
                 />
                 <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleFetchRemoteDict()} 
                    isLoading={loadingDict}
                    className="whitespace-nowrap"
                 >
                    更新
                 </Button>
              </div>
              {fetchStatus && <p className="text-[10px] text-accent mb-2 text-right">{fetchStatus}</p>}

              <textarea 
                  className={`flex-1 w-full p-3 bg-subtle border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-opacity duration-200 ${enableSmartMatch ? 'opacity-100' : 'opacity-50'}`}
                  value={dictionaryInput}
                  onChange={(e) => setDictionaryInput(e.target.value)}
                  disabled={!enableSmartMatch}
                  placeholder="一行一个标准模型名称..."
              ></textarea>
               
               <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-[11px] text-tertiary flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    匹配逻辑：忽略符号 (如 "Gemini 2.5 Pro" &rarr; "gemini-2.5-pro")，长词优先
                  </div>
               </div>
           </div>
        </div>
      </div>

      {/* 2. Result Area */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
          <div className="px-6 py-4 border-b border-border bg-white flex justify-between items-center">
            <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-secondary uppercase tracking-wider">处理结果预览</span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
                    {processedModels.length} 个模型
                    {changedCount > 0 && <span className="text-indigo-500/70 ml-1">({changedCount} 变更)</span>}
                </span>
            </div>
            <div className="flex items-center gap-4">
                <label className="flex items-center cursor-pointer select-none gap-2 group">
                    <input 
                        type="checkbox" 
                        checked={useQuotes} 
                        onChange={(e) => setUseQuotes(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-accent focus:ring-accent border-gray-300"
                    />
                    <span className="text-[11px] font-medium text-secondary group-hover:text-primary transition-colors">保留双引号</span>
                </label>
                <div className="h-4 w-[1px] bg-gray-200"></div>
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getResultJson())}>复制 JSON</Button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 h-[500px]">
             {/* Table View */}
             <div className="overflow-y-auto p-0 bg-gray-50/30">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                         <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider border-b border-gray-200">原始名称</th>
                         <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider border-b border-gray-200">处理后</th>
                         <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider border-b border-gray-200 w-16">来源</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {processedModels.length === 0 ? (
                          <tr>
                              <td colSpan={3} className="px-4 py-12 text-center text-tertiary text-xs italic">
                                  请在上方添加模型数据...
                              </td>
                          </tr>
                      ) : (
                          processedModels.map((row, idx) => (
                             <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-4 py-2.5 text-xs font-mono text-secondary truncate max-w-[180px]" title={row.original}>{row.original}</td>
                                <td className="px-4 py-2.5 text-xs font-mono text-primary font-medium truncate max-w-[180px]">
                                    {row.original !== row.cleaned ? (
                                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{row.cleaned}</span>
                                    ) : (
                                        <span className="text-gray-400">{row.cleaned}</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5">
                                   {row.matchSource === 'smart' && (
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">智能</span>
                                   )}
                                   {row.matchSource === 'rule' && (
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">规则</span>
                                   )}
                                </td>
                             </tr>
                          ))
                      )}
                   </tbody>
                </table>
             </div>
             
             {/* JSON View */}
             <div className="relative bg-white">
                <textarea 
                    readOnly
                    className="w-full h-full p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white"
                    value={processedModels.length > 0 ? getResultJson() : ''}
                    placeholder="// 最终映射表 JSON 将显示在这里..."
                />
             </div>
          </div>
      </div>
    </div>
  );
};