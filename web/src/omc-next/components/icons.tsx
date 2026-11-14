import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { FileText, RotateCw, Trash2, X, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown, Clock } from 'lucide-react';


export interface ConsoleIconProps extends Omit<LucideProps, 'ref'> {
  spin?: boolean;
  rotate?: number;
}

export function createIcon(LucideComponent: LucideIcon, defaultClassName?: string) {
  const IconComponent = React.forwardRef<SVGSVGElement, ConsoleIconProps>((props, ref) => {
    const { spin, rotate, className, style, size = '1em', ...rest } = props;
    const combinedClassName = [
      'omc-icon',
      defaultClassName,
      spin ? 'omc-icon-spin' : '',
      className,
    ].filter(Boolean).join(' ');

    const combinedStyle: React.CSSProperties = {
      ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}),
      ...style,
    };

    return (
      <LucideComponent
        ref={ref}
        size={size}
        className={combinedClassName}
        style={combinedStyle}
        {...rest}
      />
    );
  });
  IconComponent.displayName = LucideComponent.displayName || 'Icon';
  return IconComponent;
}

export const ReloadOutlined = createIcon(RotateCw, 'omc-icon-reload');

export const ProfileOutlined = createIcon(FileText, 'omc-icon-profile');
export const DeleteOutlined = createIcon(Trash2, 'omc-icon-delete');
export const CloseOutlined = createIcon(X, 'omc-icon-close');

export const EyeOutlined = createIcon(Eye, "omc-icon-eye");
export const EyeInvisibleOutlined = createIcon(EyeOff, "omc-icon-eye-invisible");

export const LeftOutlined = createIcon(ChevronLeft, "omc-icon-left");
export const RightOutlined = createIcon(ChevronRight, "omc-icon-right");
export const CaretDownOutlined = createIcon(ChevronDown, 'omc-icon-caret-down');
export const ClockCircleOutlined = createIcon(Clock, 'omc-icon-clock-circle');

export { Grid2X2 as AppstoreOutlined } from "lucide-react";
