import React, { useState, useEffect } from 'react';
import { ApiFetcher } from '../components/ApiFetcher';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const PrefixGenerator: React.FC = () => {
  const [prefix, setPrefix] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [useQuotes, setUseQuotes] = useState(false); 

  useEffect(() => {
    const savedPrefix = localStorage.getItem('prefix');
    const savedModels = localStorage.getItem('models');
    if (savedPrefix) setPrefix(savedPrefix);
    if (savedModels) setModels(JSON.parse(savedModels));
  }, []);

  useEffect(() => {
    localStorage.setItem('prefix', prefix);
    localStorage.setItem('models', JSON.stringify(models));
  }, [prefix, models]);

  const addManualModel = () => {
    if (!manualInput.trim()) return;
    // Support Chinese and English commas
    const newItems = manualInput.split(/[,，\n]+/).map(s => s.trim()).filter(s => s && !models.includes(s));
    if (newItems.length > 0) {
      setModels(prev => [...prev, ...newItems]);
      setManualInput('');
    }
  };

  const getPrefixedList = () => models.map(m => {
    const val = `${prefix}${m}`;
    return useQuotes ? `"${val}"` : val;
  }).join(',');
  
  const getMappingJson = () => {
    const obj: Record<string, string> = {};
    models.forEach(m => obj[`${prefix}${m}`] = m);
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="animate-enter space-y-8 max-w-5xl mx-auto">
      <ApiFetcher onModelsFetched={(newModels) => {
        const unique = newModels.filter(m => !models.includes(m));
        setModels(prev => [...prev, ...unique]);
      }} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6 hover:shadow-md transition-shadow duration-300">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
             <Input 
               label="目标前缀" 
               value={prefix} 
               onChange={(e) => setPrefix(e.target.value)} 
               placeholder="例如：prefix-"
               className="font-mono"
             />
          </div>
          <div className="w-full md:w-2/3">
             <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">手动添加模型</label>
             <div className="flex gap-2">
               <Input 
                 value={manualInput}
                 onChange={(e) => setManualInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && addManualModel()}
                 placeholder="gpt-4, claude-3..."
                 className="font-mono"
               />
               <Button onClick={addManualModel} className="!py-2">添加</Button>
             </div>
          </div>
        </div>

        {/* Tags Area */}
        <div className="min-h-[120px] p-5 bg-gray-50/30 rounded-lg border border-gray-100/50">
           {models.length === 0 ? (
             <p className="text-sm text-tertiary/70 italic text-center mt-8">暂无模型，请从 API 同步或手动添加。</p>
           ) : (
             <div className="flex flex-wrap gap-2">
               {models.map((model, index) => (
                 <span key={index} className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-200 shadow-sm text-primary font-mono group hover:border-accent/30 transition-colors">
                   {model}
                   <button onClick={() => setModels(m => m.filter((_, i) => i !== index))} className="ml-2 text-tertiary hover:text-red-500 transition-colors">×</button>
                 </span>
               ))}
             </div>
           )}
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-4">
           <Button variant="danger" size="sm" onClick={() => setModels([])} disabled={models.length === 0} className="text-xs">清空所有</Button>
        </div>
      </div>

      {/* Outputs */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* List Output */}
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
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getPrefixedList())} className="!h-7 !text-xs hover:bg-gray-100">复制</Button>
            </div>
          </div>
          <textarea 
            readOnly
            className="flex-1 p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white"
            value={models.length > 0 ? getPrefixedList() : ''}
            placeholder="结果..."
          />
        </div>

        {/* JSON Output */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[300px] hover:shadow-md transition-shadow duration-300">
          <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
             <span className="text-xs font-bold text-secondary uppercase tracking-wider">JSON 映射表</span>
             <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getMappingJson())} className="!h-7 !text-xs hover:bg-gray-100">复制</Button>
          </div>
          <textarea 
            readOnly
            className="flex-1 p-5 font-mono text-xs text-primary resize-none focus:outline-none leading-relaxed bg-white whitespace-pre"
            value={models.length > 0 ? getMappingJson() : ''}
            placeholder="{ ... }"
          />
        </div>
      </div>
    </div>
  );
};