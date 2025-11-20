import React, { useState } from 'react';
import { fetchModels } from '../services/apiService';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface ApiFetcherProps {
  onModelsFetched: (models: string[]) => void;
}

export const ApiFetcher: React.FC<ApiFetcherProps> = ({ onModelsFetched }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleFetch = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) {
      setStatus({ type: 'error', message: '配置不完整' });
      return;
    }

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const models = await fetchModels(baseUrl, apiKey);
      if (models.length === 0) {
        setStatus({ type: 'error', message: '未找到模型' });
      } else {
        onModelsFetched(models);
        setStatus({ type: 'success', message: `成功同步 ${models.length} 个模型` });
        setIsOpen(false); // Auto close on success
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden transition-all duration-300 shadow-sm">
      {/* Header / Toggle */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-subtle cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.type === 'success' ? 'bg-green-500' : status.type === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-primary">API 连接配置</span>
          {status.message && !isOpen && (
            <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
              status.type === 'success' ? 'bg-success-bg text-success-text' : 'bg-error-bg text-error-text'
            }`}>
              {status.message}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="!p-1">
          <svg 
            className={`w-4 h-4 text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-4 border-t border-border animate-enter">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <Input 
                label="Base URL" 
                placeholder="例如：https://api.openai.com" 
                value={baseUrl} 
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="md:col-span-5">
              <Input 
                label="API Key" 
                type="password" 
                placeholder="sk-..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
              />
            </div>
            <div className="md:col-span-2">
              <Button 
                onClick={handleFetch} 
                disabled={loading} 
                isLoading={loading} 
                className="w-full"
              >
                同步模型
              </Button>
            </div>
          </div>
          {status.type === 'error' && isOpen && (
            <p className="mt-3 text-xs text-error-text flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {status.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};