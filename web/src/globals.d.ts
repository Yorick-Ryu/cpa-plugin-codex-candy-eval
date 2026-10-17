declare module "*.module.css" {
  const styles: Record<string, string>;
  export default styles;
}
declare module "legacy" {
  export const configure: (key: string, auths?: any[]) => void;
  export const openCatalogCache: (key: string) => Promise<void>;
  export const refreshCatalog: (options?: any) => Promise<void>;
  export const resetCatalogCache: () => void;
  export const pruneCredentialCatalog: () => void;
  export const modelCatalog: (
    ids: string[],
  ) => Promise<Record<string, string[]>>;
  export const credentialPlan: (
    auth: any,
  ) => { label: string; rank: number; pro?: boolean } | null;
  export const planRank: (auth: any) => number;
  export const unavailableReason: (auth: any) => string;
  export let catalogCache: any;
}
interface Window {
  CANDY_CONFIG: any;
  markdownit: any;
  markdownItCjkFriendly: any;
  texmath: any;
  temml: any;
}
