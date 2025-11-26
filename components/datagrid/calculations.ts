export const calculateSum = <T>(items: T[], key: keyof T): number => {
  return items.reduce((sum, item) => sum + (item[key] as number), 0);
};

export const formatRate = (rate: number): string => {
  return rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(1);
};

export const calculateOKRate = <T extends Partial<{ okCount: number; totalCount: number; excludedCount: number }>>(items: T[]): string => {
  const totalOkCount = items.reduce((sum, item) => sum + (item.okCount ?? 0), 0);
  const totalCount = items.reduce((sum, item) => sum + ((item.totalCount ?? 0) - (item.excludedCount ?? 0)), 0);
  const rate = totalCount > 0 ? (totalOkCount / totalCount) * 100 : 0;
  return formatRate(rate);
};

export const calculateProgressRate = <T extends Partial<{ okCount: number; ngCount: number; totalCount: number; excludedCount: number }>>(items: T[]): string => {
  const totalOkNgCount = items.reduce((sum, item) => sum + ((item.okCount ?? 0) + (item.ngCount ?? 0)), 0);
  const totalCount = items.reduce((sum, item) => sum + ((item.totalCount ?? 0) - (item.excludedCount ?? 0)), 0);
  const rate = totalCount > 0 ? (totalOkNgCount / totalCount) * 100 : 0;
  return formatRate(rate);
};