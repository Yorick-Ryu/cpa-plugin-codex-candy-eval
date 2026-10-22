import React from 'react';
import { ProviderBrandIcon as StaticProviderBrandIcon } from '../common/ProviderBrandIcon';
import { isRenderableLogoURL } from '../types/pluginOAuthProviders';
export function ProviderBrandIcon({ iconId, logo, size = 15 }: { iconId?: string; logo?: string; size?: number }) {
  return isRenderableLogoURL(logo)
    ? <img src={logo} width={size} height={size} alt="" />
    : <StaticProviderBrandIcon provider={(iconId ?? '').toLowerCase()} size={size} />;
}
