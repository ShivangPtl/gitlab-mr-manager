import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type ChipVariant = 'badge' | 'pill';
export type ChipSize = 'sm' | 'md';

const COLOR_GROUPS: Record<string, {
  color: string;
  bg: string;
  border: string;
}> = {
  green: {
    color: '#2da44e',
    bg: 'rgba(46,160,67,0.15)',
    border: '#2da44e'
  },
  amber: {
    color: '#d29922',
    bg: 'rgba(210,153,34,0.15)',
    border: '#d29922'
  },
  blue: {
    color: '#1f6feb',
    bg: 'rgba(31,111,235,0.15)',
    border: '#1f6feb'
  },
  red: {
    color: '#f85149',
    bg: 'rgba(248,81,73,0.15)',
    border: '#f85149'
  },
  purple: {
    color: '#8250df',
    bg: 'rgba(130,80,223,0.15)',
    border: '#8250df'
  },
  neutral: {
    color: '#8b949e',
    bg: 'transparent',
    border: '#8b949e'
  },
  orange: {
    color: '#d97706',                // warm orange (UI / frontend)
    bg: 'rgba(217,119,6,0.15)',       // subtle background
    border: '#d97706'
  },
  cyan: {
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.15)',
    border: '#0891b2'
  }
};
  
const STATUS_MAP: Record<string, {
  colorGroup: keyof typeof COLOR_GROUPS;
  icon?: string | null;
}> = {
  ahead: { colorGroup: 'green', icon: 'arrow_upward' },
  behind: { colorGroup: 'amber', icon: 'arrow_downward' },
  
  success: { colorGroup: 'green', icon: 'check_circle' },
  merged: { colorGroup: 'green', icon: 'check_circle' },

  pending: { colorGroup: 'amber', icon: 'schedule' },
  created: { colorGroup: 'green', icon: 'check_circle' },
  opened: { colorGroup: 'amber', icon: 'schedule' },

  running: { colorGroup: 'blue', icon: 'autorenew' },

  failed: { colorGroup: 'red', icon: 'close' },
  rejected: { colorGroup: 'red', icon: 'block' },
  error: { colorGroup: 'red', icon: 'close' },
  exists: { colorGroup: 'red', icon: 'warning' },

  protected: { colorGroup: 'purple', icon: 'lock' },
  unprotected: { colorGroup: 'green', icon: 'lock_open' },

  api: { colorGroup: 'cyan', icon: 'cloud'},
  common: { colorGroup: 'purple', icon: 'layers'},
  ui: { colorGroup: 'orange', icon: 'devices'},

  support: { colorGroup: 'blue', icon: 'build' },
  release: { colorGroup: 'amber', icon: 'rocket_launch' },
  live: { colorGroup: 'orange', icon: 'public' },
};

@Component({
  selector: 'app-badge',
  imports: [CommonModule, MatIcon],
  templateUrl: './badge.html',
  styleUrl: './badge.scss'
})
export class Badge implements OnChanges {
  @Input() label: string | number = '';
  @Input() type: any = 'neutral';
  resolvedType: string = 'neutral';
  // styling

  // behavior
  @Input() size: ChipSize = 'md';

  color!: string;
  background!: string;
  borderColor!: string;
  icon?: any;

  ngOnChanges(): void {
    const key = (this.type || '').toLowerCase();

    const statusCfg = STATUS_MAP[key] ?? { colorGroup: 'neutral' };
    const colorCfg = COLOR_GROUPS[statusCfg.colorGroup];

    this.color = colorCfg.color;
    this.background = colorCfg.bg;
    this.borderColor = colorCfg.border;
    this.icon = statusCfg.icon ?? null;
  }
}