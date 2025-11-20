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

export const Standardizer: React.FC = () => {
  // State
  const [models, setModels] = useState<string[]>([]);
  const [rules, setRules] = useState<ProcessingRule[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [dictionaryInput, setDictionaryInput] = useState('');
  const [enableSmartMatch, setEnableSmartMatch] = useState(true);
  const [ignoreBedrock, setIgnoreBedrock] = useState(true);
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
    
    setRules(savedRules ? JSON.parse(savedRules) : DEFAULT_RULES);
    setModels(savedModels ? JSON.parse(savedModels) : []);
    setDictionaryInput(savedDict || DEFAULT_DICTIONARY);
    if (savedIgnoreBedrock !== null) {
        setIgnoreBedrock(savedIgnoreBedrock === 'true');
    }
    
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
  }, [rules, models, dictionaryInput, ignoreBedrock]);

  // 深度递归提取器：扫描 JSON 树
  const extractModelNames = (data: any): string[] => {
    const candidates = new Set<string>();

    // 辅助：剥离厂商前缀
    const stripPrefix = (str: string) => {
        if (!str) return '';
        if (str.includes('/')) {
            return str.split('/').pop() || str;
        }
        return str;
    };

    // 辅助：判断字符串是否像一个有效的模型 ID
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

    // 递归遍历函数
    const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;

        // 1. 过滤规则：舍弃 providerId 为 "llmgateway" 的节点
        if (node.providerId === 'llmgateway') {
            return;
        }

        // 2. 优先获取 modelName 字段
        let found = false;
        if (node.modelName && typeof node.modelName === 'string' && isValidModelName(node.modelName)) {
            candidates.add(stripPrefix(node.modelName));
            found = true;
        }
        // 兼容：如果对象里没有 modelName，但有 id 或 model_name 且不是 llmgateway，也可以尝试提取
        if (!found) {
            if (node.id && typeof node.id === 'string' && isValidModelName(node.id)) {
                candidates.add(stripPrefix(node.id));
            } else if (node.model_name && typeof node.model_name === 'string' && isValidModelName(node.model_name)) {
                candidates.add(stripPrefix(node.model_name));
            }
        }

        // 递归
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

      let extractedModels = extractModelNames(data);
      
      if (ignoreBedrock) {
          const countBefore = extractedModels.length;
          extractedModels = extractedModels.filter(m => !isBedrockModel(m));
          if (countBefore > extractedModels.length) {
              console.log(`Filtered ${countBefore - extractedModels.length} Bedrock models`);
          }
      }

      if (extractedModels.length > 0) {
        setDictionaryInput(prev => {
             const currentSet = new Set(prev.split(/[\n,]+/).map(s => s.trim()).filter(s => s));
             extractedModels.forEach(m => currentSet.add(m));
             DEFAULT_DICTIONARY_LIST.forEach(m => currentSet.add(m));
             return Array.from(currentSet)
                .sort((a: string, b: string) => b.length - a.length)
                .join('\n');
        });
        setFetchStatus(`成功同步 ${extractedModels.length} 个`);
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

    // 预处理：生成 Claude 的所有可能变体 (标准化版本号分隔符)
    // 将 claude-4.5-sonnet 统一转换为 claude-4-5-sonnet (如果字典里是横杠格式)
    // 反之亦然，或者同时生成用于匹配
    const getClaudeVariants = (input: string) => {
        const lower = input.toLowerCase();
        // 匹配 pattern: claude + (name) + (version) 或 claude + (version) + (name)
        // Version 可能是 3.5, 3-5, 4, 4.5, 4-5
        const claudeRegex = /claude[^\w]*?(sonnet|haiku|opus)[^\w]*?([\d]+[.\-][\d]+|[\d]+)|claude[^\w]*?([\d]+[.\-][\d]+|[\d]+)[^\w]*?(sonnet|haiku|opus)/i;
        const match = lower.match(claudeRegex);
        
        if (match) {
            // 提取 name 和 version (不论顺序)
            const part1 = match[1] || match[3]; // sonnet OR 3.5
            const part2 = match[2] || match[4]; // 3.5 OR sonnet
            
            let type = '';
            let version = '';
            
            if (['sonnet', 'haiku', 'opus'].includes(part1)) {
                type = part1;
                version = part2;
            } else {
                type = part2;
                version = part1;
            }
            
            // 统一把版本号里的点换成杠 (3.5 -> 3-5) 以适配大多数 standard key
            const vDash = version.replace(/\./g, '-');
            const vDot = version.replace(/-/g, '.');
            
            return [
                `claude-${vDash}-${type}`, // claude-3-5-sonnet
                `claude-${vDot}-${type}`,  // claude-3.5-sonnet
                `claude-${type}-${vDash}`, // claude-sonnet-3-5
                `claude-${type}-${vDot}`   // claude-sonnet-3.5
            ];
        }
        return [];
    };

    return models.map(original => {
      if (enableSmartMatch) {
        const normOriginal = normalize(original);
        
        // 1. 尝试 Claude 特殊逻辑 (双向匹配)
        // 无论输入是 claude-sonnet-4.5 还是 claude-4.5-sonnet，都去字典里找匹配项
        if (original.toLowerCase().includes('claude')) {
            const variants = getClaudeVariants(original);
            for (const v of variants) {
                const normV = normalize(v);
                // 检查字典里是否有这个变体 (模糊或精确)
                const exactMatch = sortedDict.find(d => normalize(d) === normV);
                if (exactMatch) return { original, cleaned: exactMatch, matchSource: 'smart' };
                
                // 尝试包含匹配
                const containsMatch = sortedDict.find(d => normalize(d).includes(normV) || normV.includes(normalize(d)));
                if (containsMatch) return { original, cleaned: containsMatch, matchSource: 'smart' };
            }
        }

        // 2. 常规智能匹配
        const match = sortedDict.find((std: string) => {
           const normStd = normalize(std);
           if (normStd.length < 3) return false; 
           return normOriginal.includes(normStd);
        });
        if (match) return { original, cleaned: match, matchSource: 'smart' };
      }

      // 规则匹配兜底
      let current = original;
      let matchedSource: 'rule' | 'original' = 'original';
      rules.filter(r => r.active).forEach(rule => {
        const prev = current;
        try {
          if (rule.type === 'lowercase') current = current.toLowerCase();
          else if (rule.type === 'remove') current = current.split(rule.target).join('');
          else if (rule.type === 'replace') current = current.split(rule.target).join(rule.replacement);
          else if (rule.type === 'regex') current = current.replace(new RegExp(rule.target, 'g'), rule.replacement);
        } catch (e) {}
        if (current !== prev) matchedSource = 'rule';
      });
      return { original, cleaned: current, matchSource: matchedSource };
    });
  }, [models, rules, dictionaryInput, enableSmartMatch]);

  const getProcessedList = () => processedModels.map(m => {
      const val = m.cleaned;
      return useQuotes ? `"${val}"` : val;
  }).join(',');
  
  const getProcessedJson = () => {
    const obj: Record<string, string> = {};
    processedModels.forEach(m => obj[m.original] = m.cleaned);
    return JSON.stringify(obj, null, 2);
  };

  const dictionaryCount = dictionaryInput.split(/[\n,]+/).filter(s => s.trim()).length;

  return (
    <div className="animate-enter space-y-8 max-w-5xl mx-auto">
      
      <ApiFetcher onModelsFetched={(newModels) => setModels(prev => [...new Set([...prev, ...newModels])])} />

      {/* Input Area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow duration-300">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex justify-between items-center">
            <h2 className="text-sm font-semibold text-primary flex items-center gap-2">
              原始模型列表
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs font-normal text-secondary">{models.length}</span>
            </h2>
            <Button size="sm" variant="danger" onClick={() => setModels([])} disabled={models.length === 0} className="!py-1 !h-7 !text-xs">清空</Button>
        </div>
        <div className="grid md:grid-cols-2 h-[200px] divide-x divide-gray-100">
            <textarea 
                className="w-full h-full p-5 text-sm font-mono bg-white resize-none focus:outline-none text-primary placeholder-tertiary/70"
                placeholder="在此粘贴杂乱的模型名 (逗号或换行分隔)...&#10;aws/gpt-4-turbo&#10;google/gemini 2.5 pro"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualInput())}
            />
            <div className="p-4 bg-gray-50/30 overflow-y-auto custom-scrollbar">
                {models.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-tertiary/70 italic gap-2">
                        <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        请输入或通过 API 同步
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {models.map((m, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono text-secondary shadow-sm">
                                <span className="max-w-[150px] truncate">{m}</span>
                                <button onClick={() => setModels(prev => prev.filter((_, idx) => idx !== i))} className="ml-1.5 text-tertiary hover:text-red-500 transition-colors">×</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
        <div className="border-t border-gray-100 p-3 bg-gray-50/30 flex justify-end">
             <Button size="sm" onClick={addManualInput} disabled={!manualInput.trim()} className="!py-1 !h-8">添加输入</Button>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Smart Match Config */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow duration-300 overflow-hidden">
             {/* Header */}
             <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-semibold text-primary">智能匹配字典</h2>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-secondary text-[10px] font-medium border border-gray-200">
                          {dictionaryCount} 条
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center cursor-pointer gap-1.5 select-none">
                             <input type="checkbox" checked={ignoreBedrock} onChange={e => setIgnoreBedrock(e.target.checked)} className="w-3.5 h-3.5 rounded text-indigo-400 focus:ring-indigo-400 border-gray-300" />
                             <span className="text-[11px] font-medium text-secondary">忽略 AWS Bedrock</span>
                        </label>
                        <div className="h-3 w-[1px] bg-gray-200"></div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={enableSmartMatch} onChange={e => setEnableSmartMatch(e.target.checked)} className="sr-only peer"/>
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-400"></div>
                        </label>
                    </div>
                </div>
                <div className="text-[11px] text-tertiary flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  匹配逻辑：支持 Claude 变体 (e.g. 4-5-sonnet &harr; sonnet-4.5)，长词优先
                </div>
             </div>
             
             <div className="p-3 border-b border-gray-100 bg-white flex gap-2 items-center">
                <div className="flex-1 relative">
                   <Input 
                      placeholder="输入字典 URL..." 
                      value={dictUrl} 
                      onChange={e => setDictUrl(e.target.value)} 
                      className="!py-1.5 !text-xs !h-8 !border-gray-200 focus:!border-accent !pl-2"
                   />
                </div>
                <Button 
                   size="sm" 
                   variant="secondary" 
                   onClick={() => handleFetchRemoteDict(dictUrl)}
                   isLoading={loadingDict}
                   className="!py-1 !h-8 text-xs whitespace-nowrap bg-gray-50 border-gray-200"
                >
                   {loadingDict ? '同步中' : '同步'}
                </Button>
             </div>
             
             {fetchStatus && (
                <div className="px-3 py-1.5 bg-indigo-50/30 text-[10px] text-indigo-600 border-b border-indigo-50 text-center">
                    {fetchStatus}
                </div>
             )}

             <div className="flex-1 bg-gray-50/30 overflow-hidden">
                <textarea 
                    className={`w-full h-full p-4 text-xs font-mono resize-none focus:outline-none min-h-[240px] leading-relaxed bg-transparent ${enableSmartMatch ? 'text-secondary' : 'text-tertiary'}`}
                    value={dictionaryInput}
                    onChange={e => setDictionaryInput(e.target.value)}
                    disabled={!enableSmartMatch}
                    placeholder="输入标准模型名列表..."
                />
             </div>
          </div>

          {/* Rules Config */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full max-h-[450px] hover:shadow-md transition-shadow duration-300 overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 bg-white flex justify-between items-center">
                <h2 className="text-sm font-semibold text-primary">手动清洗规则</h2>
                <Button size="sm" variant="ghost" onClick={addRule} className="!py-0.5 !h-7 text-xs bg-gray-50 hover:bg-gray-100 text-secondary">+ 规则</Button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-tertiary gap-2">
                        <span className="text-xs">暂无规则</span>
                        <span className="text-[10px] opacity-70">请添加规则或使用智能匹配</span>
                    </div>
                ) : (
                    rules.map((rule, idx) => (
                        <div key={rule.id} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${rule.active ? 'border-gray-200 bg-white shadow-sm' : 'border-transparent bg-gray-50 opacity-60'}`}>
                            <input type="checkbox" checked={rule.active} onChange={() => toggleRule(idx)} className="rounded text-accent focus:ring-accent border-gray-300" />
                            
                            <select 
                                value={rule.type} 
                                onChange={e => updateRule(idx, 'type', e.target.value)}
                                className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-gray-50 text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
                            >
                                <option value="replace">替换</option>
                                <option value="remove">移除</option>
                                <option value="regex">正则</option>
                                <option value="lowercase">小写</option>
                            </select>

                            {rule.type !== 'lowercase' && (
                                <>
                                    <input 
                                        className="flex-1 w-16 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 font-mono text-primary placeholder-tertiary"
                                        value={rule.target}
                                        onChange={e => updateRule(idx, 'target', e.target.value)}
                                        placeholder="目标..."
                                    />
                                    {rule.type !== 'remove' && (
                                        <span className="text-tertiary text-[10px]">&rarr;</span>
                                    )}
                                    {rule.type !== 'remove' && (
                                        <input 
                                            className="flex-1 w-16 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 font-mono text-primary placeholder-tertiary"
                                            value={rule.replacement}
                                            onChange={e => updateRule(idx, 'replacement', e.target.value)}
                                            placeholder="新值..."
                                        />
                                    )}
                                </>
                            )}
                            <button onClick={() => deleteRule(idx)} className="text-tertiary hover:text-error-text px-1 transition-colors">×</button>
                        </div>
                    ))
                )}
             </div>
          </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
             <h2 className="text-sm font-semibold text-primary">实时清洗预览</h2>
        </div>
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-secondary bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                        <th className="px-6 py-3 font-medium w-1/3">原始名称</th>
                        <th className="px-6 py-3 font-medium w-1/3">清洗后名称</th>
                        <th className="px-6 py-3 font-medium w-24 text-center">来源</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {processedModels.length === 0 ? (
                        <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-tertiary text-xs">无数据预览</td>
                        </tr>
                    ) : (
                        processedModels.map((row, i) => (
                            <tr key={i} className="group hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-3 font-mono text-xs text-secondary truncate max-w-[200px]" title={row.original}>{row.original}</td>
                                <td className="px-6 py-3 font-mono text-xs text-primary font-medium truncate max-w-[200px]" title={row.cleaned}>
                                    {row.cleaned}
                                </td>
                                <td className="px-6 py-3 text-center">
                                    {row.matchSource === 'smart' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                                            智能
                                        </span>
                                    )}
                                    {row.matchSource === 'rule' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100/50">
                                            规则
                                        </span>
                                    )}
                                    {row.matchSource === 'original' && (
                                        <span className="text-[10px] text-tertiary opacity-50">-</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Final Output */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* List Output */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[300px] hover:shadow-md transition-shadow duration-300">
          <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
            <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">文本列表</h2>
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
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getProcessedList())} className="!h-7 !text-xs hover:bg-gray-100">复制</Button>
            </div>
          </div>
          <textarea 
            readOnly
            className="flex-1 p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white"
            value={models.length > 0 ? getProcessedList() : ''}
            placeholder="清洗结果..."
          />
        </div>

        {/* JSON Output */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[300px] hover:shadow-md transition-shadow duration-300">
          <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
             <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">JSON 映射表</h2>
             <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getProcessedJson())} className="!h-7 !text-xs hover:bg-gray-100">复制</Button>
          </div>
          <textarea 
            readOnly
            className="flex-1 p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white whitespace-pre"
            value={models.length > 0 ? getProcessedJson() : ''}
            placeholder="{ ... }"
          />
        </div>
      </div>

    </div>
  );
};