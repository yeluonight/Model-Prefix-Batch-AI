export const normalizeBaseUrl = (url: string): { url: string; type: 'openai' | 'gemini' | 'unknown' } => {
  let cleanUrl = url.trim();
  if (!cleanUrl) return { url: '', type: 'unknown' };

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  cleanUrl = cleanUrl.replace(/\/+$/, '');

  let type: 'openai' | 'gemini' | 'unknown' = 'openai';

  if (cleanUrl.includes('/v1beta')) {
    type = 'gemini';
    cleanUrl = cleanUrl.replace(/\/v1beta.*$/, '');
  } else if (!cleanUrl.endsWith('/v1')) {
    cleanUrl = cleanUrl + '/v1';
  }

  return { url: cleanUrl, type };
};

export const fetchOpenAIModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Invalid response format: missing "data" array');
  }

  return data.data.map((model: any) => model.id);
};

export const fetchGeminiModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
  // Gemini usually needs the full path including protocol if not provided by normalize, 
  // but here we assume baseUrl is coming from normalizeBaseUrl
  const response = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.models || !Array.isArray(data.models)) {
    throw new Error('Invalid response format: missing "models" array');
  }

  return data.models.map((model: any) => {
    const name = model.name || '';
    return name.replace('models/', '');
  }).filter((name: string) => name);
};

export const fetchModels = async (rawBaseUrl: string, apiKey: string): Promise<string[]> => {
  const { url: baseUrl, type } = normalizeBaseUrl(rawBaseUrl);
  
  if (type === 'gemini') {
    return await fetchGeminiModels(baseUrl, apiKey);
  } else {
    try {
      return await fetchOpenAIModels(baseUrl, apiKey);
    } catch (error) {
      console.warn('OpenAI fetch failed, trying Gemini fallback...');
      // Fallback logic similar to original script: try Gemini format on base URL
      const geminiUrl = baseUrl.replace(/\/v1$/, '');
      return await fetchGeminiModels(geminiUrl, apiKey);
    }
  }
};