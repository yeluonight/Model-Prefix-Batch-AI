import React, { useState } from 'react';
import { PrefixGenerator } from './views/PrefixGenerator';
import { Standardizer } from './views/Standardizer';
import { ViewMode } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.PREFIXER);

  return (
    <div className="animate-enter min-h-screen pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 pt-6 px-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">模型名称清洗工坊</h1>
          <p className="text-secondary text-sm mt-2 font-light">为强迫症打造的 LLM 模型名称标准化工具</p>
        </div>
        
        {/* Modern Tab Navigation - Bottom Border Style */}
        <div className="flex gap-6 mt-6 md:mt-0 border-b border-gray-200 w-full md:w-auto">
          <button
            onClick={() => setView(ViewMode.PREFIXER)}
            className={`pb-3 px-1 text-sm font-medium transition-all duration-200 relative ${
              view === ViewMode.PREFIXER 
                ? 'text-indigo-600' 
                : 'text-tertiary hover:text-secondary'
            }`}
          >
            前缀生成
            {view === ViewMode.PREFIXER && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setView(ViewMode.STANDARDIZER)}
            className={`pb-3 px-1 text-sm font-medium transition-all duration-200 relative ${
              view === ViewMode.STANDARDIZER 
                ? 'text-indigo-600' 
                : 'text-tertiary hover:text-secondary'
            }`}
          >
            名称清洗
            {view === ViewMode.STANDARDIZER && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full" />
            )}
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="min-h-[600px]">
        {view === ViewMode.PREFIXER ? <PrefixGenerator /> : <Standardizer />}
      </div>
    </div>
  );
};

export default App;