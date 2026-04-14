// backend/src/services/cache.service.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export const getCached = <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const cached = cache.get<T>(key);
  if (cached) return Promise.resolve(cached);
  
  return fetcher().then(data => {
    cache.set(key, data);
    return data;
  });
};

// Использование в reports.controller.ts
export const getSummary = async (req, res) => {
  const data = await getCached('summary', async () => {
    // существующая логика
  });
  res.json(data);
};