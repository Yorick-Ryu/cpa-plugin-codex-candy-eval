import React from 'react';
import { ProviderBrandIcon as StaticProviderBrandIcon } from '../../omc/common/ProviderBrandIcon';
import { isRenderableLogoURL } from '../types/pluginOAuthProviders';
export function ProviderBrandIcon({ iconId, logo, size = 15 }: { iconId?: string; logo?: string; size?: number }) {
  return isRenderableLogoURL(logo)
    ? <img src={logo} width={size} height={size} alt="" />
    : <StaticProviderBrandIcon provider={(iconId ?? '').toLowerCase()} size={size} />;
}

export function CredentialMark({credential,size=15}:{credential:{provider:string;hint?:string};size?:number;pluginLogos?:unknown}){return <StaticProviderBrandIcon provider={credential.provider} size={size}/>;}
