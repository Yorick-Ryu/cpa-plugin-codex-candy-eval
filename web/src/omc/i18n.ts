export function useT() {
  return (key: string) => key === 'common.all' ? '全部' : key;
}
