import React from 'react';
import { Button } from './Button';

export function ProductPagination({ page, total, limit = 50, loading, onPage }: {
  page: number; total: number; limit?: number; loading: boolean; onPage: (page: number) => void;
}) {
  return <div className="flex items-center justify-between gap-3 p-3">
    <Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Назад</Button>
    <span>Страница {page} из {Math.max(1, Math.ceil(total / limit))} · Всего: {total}</span>
    <Button type="button" variant="outline" disabled={loading || page * limit >= total} onClick={() => onPage(page + 1)}>Далее</Button>
  </div>;
}
