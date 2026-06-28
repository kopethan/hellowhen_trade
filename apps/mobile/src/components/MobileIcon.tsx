import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type MobileIconName =
  | 'activity'
  | 'add'
  | 'back'
  | 'bell'
  | 'deck-advance'
  | 'deck-back'
  | 'business'
  | 'calendar'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'close'
  | 'dispute'
  | 'edit'
  | 'filter'
  | 'help'
  | 'image'
  | 'location-on'
  | 'more'
  | 'need'
  | 'offer'
  | 'plan'
  | 'payout'
  | 'profile'
  | 'proposal'
  | 'proposal-accepted'
  | 'proposal-declined'
  | 'report-flag'
  | 'refresh'
  | 'save'
  | 'search'
  | 'send'
  | 'share'
  | 'settings'
  | 'trade'
  | 'wallet'
  | 'warning';

type MobileIconProps = {
  name: MobileIconName;
  color: string;
  size?: number;
  label?: string;
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
};

function IconPaths({ name, color }: { name: MobileIconName; color: string }) {
  const strokeProps = { stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'activity':
      return <><Path d="M6 6.5H18" strokeWidth={2} {...strokeProps} /><Path d="M6 12H18" strokeWidth={2} {...strokeProps} /><Path d="M6 17.5H14" strokeWidth={2} {...strokeProps} /><Circle cx={3.5} cy={6.5} r={1.2} fill={color} /><Circle cx={3.5} cy={12} r={1.2} fill={color} /><Circle cx={3.5} cy={17.5} r={1.2} fill={color} /><Path d="M17 16.5L18.5 18L21 15.5" strokeWidth={2} {...strokeProps} /></>;
    case 'add':
      return <><Path d="M12 3V21" strokeWidth={2} {...strokeProps} /><Path d="M3 12H21" strokeWidth={2} {...strokeProps} /></>;
    case 'back':
      return <><Path d="M16 19.5L8.5 12" strokeWidth={2} {...strokeProps} /><Path d="M16 4.5L8.5 12" strokeWidth={2} {...strokeProps} /></>;
    case 'deck-advance':
      return <><Path d="M6 16V6" strokeWidth={3.2} {...strokeProps} /><Path d="M6 6H15" strokeWidth={3.2} {...strokeProps} /><Circle cx={18} cy={18} r={3} fill={color} /><Circle cx={13} cy={13} r={3} fill={color} /></>;
    case 'deck-back':
      return <><Path d="M18 8V18" strokeWidth={3.2} {...strokeProps} /><Path d="M18 18H9" strokeWidth={3.2} {...strokeProps} /><Circle cx={6} cy={6} r={3} fill={color} /><Circle cx={11} cy={11} r={3} fill={color} /></>;
    case 'bell':
      return <><Path d="M6.5 10.5C6.5 7.46 8.96 5 12 5C15.04 5 17.5 7.46 17.5 10.5V13.5L19.25 16.5H4.75L6.5 13.5V10.5Z" strokeWidth={1.8} {...strokeProps} /><Path d="M9.75 18C10.2 18.9 10.95 19.5 12 19.5C13.05 19.5 13.8 18.9 14.25 18" strokeWidth={1.8} {...strokeProps} /><Path d="M12 3.5V5" strokeWidth={1.8} {...strokeProps} /></>;
    case 'business':
      return <><Path d="M4.5 9.5H19.5V19.5H4.5V9.5Z" strokeWidth={1.8} {...strokeProps} /><Path d="M9 9.5V6.75C9 5.92 9.67 5.25 10.5 5.25H13.5C14.33 5.25 15 5.92 15 6.75V9.5" strokeWidth={1.8} {...strokeProps} /><Path d="M9 13H15" strokeWidth={1.8} {...strokeProps} /></>;
    case 'calendar':
      return <><Rect x={4.5} y={5.5} width={15} height={14} rx={2.5} stroke={color} strokeWidth={1.8} fill="none" /><Path d="M8 3.75V7.25" strokeWidth={1.8} {...strokeProps} /><Path d="M16 3.75V7.25" strokeWidth={1.8} {...strokeProps} /><Path d="M5 9.5H19" strokeWidth={1.8} {...strokeProps} /><Path d="M8.5 13H9.5" strokeWidth={2.1} {...strokeProps} /><Path d="M11.5 13H12.5" strokeWidth={2.1} {...strokeProps} /><Path d="M14.5 13H15.5" strokeWidth={2.1} {...strokeProps} /><Path d="M8.5 16H9.5" strokeWidth={2.1} {...strokeProps} /><Path d="M11.5 16H12.5" strokeWidth={2.1} {...strokeProps} /></>;
    case 'chevron-right':
      return <Path d="M9 5L16 12L9 19" strokeWidth={2} {...strokeProps} />;
    case 'chevron-down':
      return <Path d="M5 9L12 16L19 9" strokeWidth={2} {...strokeProps} />;
    case 'chevron-up':
      return <Path d="M5 15L12 8L19 15" strokeWidth={2} {...strokeProps} />;
    case 'close':
      return <><Path d="M6 6L18 18" strokeWidth={2} {...strokeProps} /><Path d="M18 6L6 18" strokeWidth={2} {...strokeProps} /></>;
    case 'dispute':
      return <><Path d="M3.5 5.75C3.5 5.06 4.06 4.5 4.75 4.5H14.25C14.94 4.5 15.5 5.06 15.5 5.75V12.25C15.5 12.94 14.94 13.5 14.25 13.5H8.65L6.65 15.25C6.22 15.63 5.55 15.32 5.55 14.75V13.5H4.75C4.06 13.5 3.5 12.94 3.5 12.25V5.75Z" strokeWidth={1.35} {...strokeProps} /><Path d="M9.5 11.75V11.25C9.5 10.56 10.06 10 10.75 10H19.25C19.94 10 20.5 10.56 20.5 11.25V17.75C20.5 18.44 19.94 19 19.25 19H18.45V20.25C18.45 20.82 17.78 21.13 17.35 20.75L15.35 19H10.75C10.06 19 9.5 18.44 9.5 17.75V16.1" strokeWidth={1.35} {...strokeProps} /><Path d="M6.5 7.5H12.5" strokeWidth={1.35} {...strokeProps} /><Path d="M6.5 10.5H11" strokeWidth={1.35} {...strokeProps} /><Path d="M15 12.5V15" strokeWidth={1.5} {...strokeProps} /><Path d="M15 17H15.01" strokeWidth={1.8} {...strokeProps} /></>;
    case 'edit':
      return <><Path d="M5 19H19" strokeWidth={1.8} {...strokeProps} /><Path d="M6.5 14.5L14.75 6.25C15.44 5.56 16.56 5.56 17.25 6.25C17.94 6.94 17.94 8.06 17.25 8.75L9 17L5.5 17.5L6.5 14.5Z" strokeWidth={1.8} {...strokeProps} /><Path d="M13.5 7.5L16 10" strokeWidth={1.8} {...strokeProps} /></>;
    case 'filter':
      return <><Path d="M3 3H21" strokeWidth={2} {...strokeProps} /><Path d="M15 12L21 3" strokeWidth={2} {...strokeProps} /><Path d="M14.8983 21L15 12" strokeWidth={2} {...strokeProps} /><Path d="M14.8983 21L9 20" strokeWidth={2} {...strokeProps} /><Path d="M3 3L9 12" strokeWidth={2} {...strokeProps} /><Path d="M9 12V20" strokeWidth={2} {...strokeProps} /></>;
    case 'help':
      return <><Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} fill="none" /><Path d="M11.233 13.5455V13.4943C11.2386 12.9517 11.2955 12.5199 11.4034 12.1989C11.5114 11.8778 11.6648 11.6179 11.8636 11.419C12.0625 11.2202 12.3011 11.0369 12.5795 10.8693C12.7472 10.767 12.8977 10.6463 13.0312 10.5071C13.1648 10.3651 13.2699 10.2017 13.3466 10.017C13.4261 9.83239 13.4659 9.62784 13.4659 9.40341C13.4659 9.125 13.4006 8.88352 13.2699 8.67898C13.1392 8.47443 12.9645 8.31676 12.7457 8.20597C12.527 8.09517 12.2841 8.03977 12.017 8.03977C11.7841 8.03977 11.5597 8.08807 11.3438 8.18466C11.1278 8.28125 10.9474 8.43324 10.8026 8.64062C10.6577 8.84801 10.5739 9.11932 10.5511 9.45455H9.47727C9.5 8.97159 9.625 8.55824 9.85227 8.21449C10.0824 7.87074 10.3849 7.60795 10.7599 7.42614C11.1378 7.24432 11.5568 7.15341 12.017 7.15341C12.517 7.15341 12.9517 7.25284 13.321 7.4517C13.6932 7.65057 13.9801 7.9233 14.1818 8.26989C14.3864 8.61648 14.4886 9.01136 14.4886 9.45455C14.4886 9.76705 14.4403 10.0497 14.3438 10.3026C14.25 10.5554 14.1136 10.7812 13.9347 10.9801C13.7585 11.179 13.5455 11.3551 13.2955 11.5085C13.0455 11.6648 12.8452 11.8295 12.6946 12.0028C12.544 12.1733 12.4347 12.3764 12.3665 12.6122C12.2983 12.848 12.2614 13.142 12.2557 13.4943V13.5455H11.233ZM11.7784 16.0682C11.5682 16.0682 11.3878 15.9929 11.2372 15.8423C11.0866 15.6918 11.0114 15.5114 11.0114 15.3011C11.0114 15.0909 11.0866 14.9105 11.2372 14.7599C11.3878 14.6094 11.5682 14.5341 11.7784 14.5341C11.9886 14.5341 12.169 14.6094 12.3196 14.7599C12.4702 14.9105 12.5455 15.0909 12.5455 15.3011C12.5455 15.4403 12.5099 15.5682 12.4389 15.6847C12.3707 15.8011 12.2784 15.8949 12.1619 15.9659C12.0483 16.0341 11.9205 16.0682 11.7784 16.0682Z" fill={color} /></>;
    case 'image':
      return <><Rect x={4} y={5} width={16} height={14} rx={2.5} stroke={color} strokeWidth={1.8} fill="none" /><Circle cx={9} cy={10} r={1.5} fill={color} /><Path d="M5.5 17L10 12.5L13 15.5L15 13.5L18.5 17" strokeWidth={1.8} {...strokeProps} /></>;
    case 'location-on':
      return <><Path d="M12 3.25C8.78 3.25 6.25 5.76 6.25 8.85C6.25 12.18 10.05 17.54 11.34 19.2C11.68 19.64 12.32 19.64 12.66 19.2C13.95 17.54 17.75 12.18 17.75 8.85C17.75 5.76 15.22 3.25 12 3.25Z" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" /><Circle cx={12} cy={8.85} r={2.05} stroke={color} strokeWidth={1.7} fill="none" /><Path d="M8.65 18.15C9.5 18.85 10.68 19.25 12 19.25C13.32 19.25 14.5 18.85 15.35 18.15" stroke={color} strokeWidth={1.45} strokeLinecap="round" opacity={0.42} /></>;
    case 'more':
      return <><Circle cx={5} cy={12} r={2} fill={color} /><Circle cx={12} cy={12} r={2} fill={color} /><Circle cx={19} cy={12} r={2} fill={color} /></>;
    case 'need':
      return <><Path d="M3.25 13.4L5.45 12.5L8 18.8L5.8 19.7L3.25 13.4Z" strokeWidth={1.3} {...strokeProps} /><Path d="M6.1 17.8C7.15 17 8.1 16.6 9 16.72C10.05 16.85 11.35 18.12 12.55 17.88C14.8 17.42 18.55 15.65 20.85 14.55C21.65 14.17 22.05 13.48 21.76 12.74C21.47 11.98 20.58 11.78 19.74 12.05L14.95 13.58" strokeWidth={1.35} {...strokeProps} /><Path d="M9.5 14.1C10.9 14.85 12.55 15.45 13.62 15.05C14.55 14.7 14.95 13.58 14.95 13.58C14.2 13.22 13.02 13.15 11.95 12.55C10.2 11.58 9.45 10.92 8.1 11.35C7.42 11.57 6.4 12.12 5.2 12.88" strokeWidth={1.35} {...strokeProps} /><Path d="M15.5 3.75H18.25V6.5H15.5V3.75Z" strokeWidth={1.25} {...strokeProps} /><Circle cx={10.5} cy={7} r={1.75} stroke={color} strokeWidth={1.25} fill="none" /><Path d="M14.3 10.1H17.4L15.85 12.75L14.3 10.1Z" strokeWidth={1.25} {...strokeProps} /></>;
    case 'offer':
      return <><Path d="M20.75 10.6L18.55 11.5L16 5.2L18.2 4.3L20.75 10.6Z" strokeWidth={1.3} {...strokeProps} /><Path d="M17.9 6.2C16.85 7 15.9 7.4 15 7.28C13.95 7.15 12.65 5.88 11.45 6.12C9.2 6.58 5.45 8.35 3.15 9.45C2.35 9.83 1.95 10.52 2.24 11.26C2.53 12.02 3.42 12.22 4.26 11.95L9.05 10.42" strokeWidth={1.35} {...strokeProps} /><Path d="M14.5 9.9C13.1 9.15 11.45 8.55 10.38 8.95C9.45 9.3 9.05 10.42 9.05 10.42C9.8 10.78 10.98 10.85 12.05 11.45C13.8 12.42 14.55 13.08 15.9 12.65C16.58 12.43 17.6 11.88 18.8 11.12" strokeWidth={1.35} {...strokeProps} /><Path d="M8.5 20.25H5.75V17.5H8.5V20.25Z" strokeWidth={1.25} {...strokeProps} /><Circle cx={13.5} cy={17} r={1.75} stroke={color} strokeWidth={1.25} fill="none" /><Path d="M9.7 13.9H6.6L8.15 11.25L9.7 13.9Z" strokeWidth={1.25} {...strokeProps} /></>;
    case 'plan':
      return <><Rect x={3} y={3} width={18} height={18} rx={2} stroke={color} fill="none" /><Circle cx={6} cy={6} r={1} fill={color} /><Circle cx={18} cy={18} r={1} fill={color} /><Path d="M8 6C8 6 12 6 12 12C12 18 16 18 16 18" stroke={color} strokeWidth={0.7} strokeLinecap="round" /></>;
    case 'payout':
      return <><Path d="M6 7.5H18C19.1 7.5 20 8.4 20 9.5V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V9.5C4 8.4 4.9 7.5 6 7.5Z" strokeWidth={1.8} {...strokeProps} /><Path d="M8 7.5V6.5C8 5.67 8.67 5 9.5 5H14.5C15.33 5 16 5.67 16 6.5V7.5" strokeWidth={1.8} {...strokeProps} /><Path d="M12 10.5V16" strokeWidth={1.8} {...strokeProps} /><Path d="M9.75 13.75L12 16L14.25 13.75" strokeWidth={1.8} {...strokeProps} /></>;
    case 'profile':
      return <><Path d="M12 12.5C15.7089 12.5 18.5 14.8442 18.5 17.5C18.5 20.1558 15.7089 22.5 12 22.5C8.2911 22.5 5.5 20.1558 5.5 17.5C5.5 14.8442 8.2911 12.5 12 12.5Z" stroke={color} strokeWidth={1.2} fill="none" /><Path d="M12 6.5C13.3807 6.5 14.5 7.61929 14.5 9C14.5 10.3807 13.3807 11.5 12 11.5C10.6193 11.5 9.5 10.3807 9.5 9C9.5 7.61929 10.6193 6.5 12 6.5Z" stroke={color} strokeWidth={1.2} fill="none" /></>;
    case 'proposal':
      return <><Path d="M3.25 13.4L5.45 12.5L8 18.8L5.8 19.7L3.25 13.4Z" strokeWidth={1.3} {...strokeProps} /><Path d="M6.1 17.8C7.15 17 8.1 16.6 9 16.72C10.05 16.85 11.35 18.12 12.55 17.88C14.8 17.42 18.55 15.65 20.85 14.55C21.65 14.17 22.05 13.48 21.76 12.74C21.47 11.98 20.58 11.78 19.74 12.05L14.95 13.58" strokeWidth={1.35} {...strokeProps} /><Path d="M9.5 14.1C10.9 14.85 12.55 15.45 13.62 15.05C14.55 14.7 14.95 13.58 14.95 13.58C14.2 13.22 13.02 13.15 11.95 12.55C10.2 11.58 9.45 10.92 8.1 11.35C7.42 11.57 6.4 12.12 5.2 12.88" strokeWidth={1.35} {...strokeProps} /><Path d="M15.5 3.25L19 6.75L15.5 10.25L12 6.75L15.5 3.25Z" strokeWidth={1.35} {...strokeProps} /><Path d="M12 6.75H19" strokeWidth={1.35} {...strokeProps} /></>;
    case 'proposal-accepted':
      return <><Path d="M3.25 13.4L5.45 12.5L8 18.8L5.8 19.7L3.25 13.4Z" strokeWidth={1.3} {...strokeProps} /><Path d="M6.1 17.8C7.15 17 8.1 16.6 9 16.72C10.05 16.85 11.35 18.12 12.55 17.88C14.8 17.42 18.55 15.65 20.85 14.55C21.65 14.17 22.05 13.48 21.76 12.74C21.47 11.98 20.58 11.78 19.74 12.05L14.95 13.58" strokeWidth={1.35} {...strokeProps} /><Path d="M9.5 14.1C10.9 14.85 12.55 15.45 13.62 15.05C14.55 14.7 14.95 13.58 14.95 13.58C14.2 13.22 13.02 13.15 11.95 12.55C10.2 11.58 9.45 10.92 8.1 11.35C7.42 11.57 6.4 12.12 5.2 12.88" strokeWidth={1.35} {...strokeProps} /><Path d="M15.5 3.25L19 6.75L15.5 10.25L12 6.75L15.5 3.25Z" strokeWidth={1.35} {...strokeProps} /><Path d="M13.9 6.8L15.05 7.95L17.25 5.75" strokeWidth={1.35} {...strokeProps} /></>;
    case 'proposal-declined':
      return <><Path d="M3.25 13.4L5.45 12.5L8 18.8L5.8 19.7L3.25 13.4Z" strokeWidth={1.3} {...strokeProps} /><Path d="M6.1 17.8C7.15 17 8.1 16.6 9 16.72C10.05 16.85 11.35 18.12 12.55 17.88C14.8 17.42 18.55 15.65 20.85 14.55C21.65 14.17 22.05 13.48 21.76 12.74C21.47 11.98 20.58 11.78 19.74 12.05L14.95 13.58" strokeWidth={1.35} {...strokeProps} /><Path d="M9.5 14.1C10.9 14.85 12.55 15.45 13.62 15.05C14.55 14.7 14.95 13.58 14.95 13.58C14.2 13.22 13.02 13.15 11.95 12.55C10.2 11.58 9.45 10.92 8.1 11.35C7.42 11.57 6.4 12.12 5.2 12.88" strokeWidth={1.35} {...strokeProps} /><Path d="M15.5 3.25L19 6.75L15.5 10.25L12 6.75L15.5 3.25Z" strokeWidth={1.35} {...strokeProps} /><Path d="M14.2 5.45L16.8 8.05" strokeWidth={1.35} {...strokeProps} /><Path d="M16.8 5.45L14.2 8.05" strokeWidth={1.35} {...strokeProps} /></>;
    case 'report-flag':
      return <><Path d="M6 20V5.5" strokeWidth={1.9} {...strokeProps} /><Path d="M6 5.5H17.5L15.25 9.25L17.5 13H6" strokeWidth={1.9} {...strokeProps} /><Path d="M10.5 8.25V10.75" strokeWidth={1.7} {...strokeProps} /><Path d="M10.5 12.4H10.51" strokeWidth={2.2} {...strokeProps} /></>;
    case 'refresh':
      return <><Path d="M19 8.5C17.75 6.4 15.46 5 12.85 5C8.95 5 5.75 8.1 5.6 12" strokeWidth={1.9} {...strokeProps} /><Path d="M19 5V8.5H15.5" strokeWidth={1.9} {...strokeProps} /><Path d="M5 15.5C6.25 17.6 8.54 19 11.15 19C15.05 19 18.25 15.9 18.4 12" strokeWidth={1.9} {...strokeProps} /><Path d="M5 19V15.5H8.5" strokeWidth={1.9} {...strokeProps} /></>;
    case 'save':
      return <Path d="M18 2C18.5523 2 19 2.44772 19 3V21C19 22 17.7071 22.7071 17 22C16 21 14.5 19.5 14.5 19.5L12.1414 17.1414C12.0633 17.0633 11.9367 17.0633 11.8586 17.1414L9.5 19.5C9.5 19.5 8 21 7 22C6 23 5 22 5 21V3C5 2.44772 5.44772 2 6 2H18ZM7 19L11.8586 14.1414C11.9367 14.0633 12.0633 14.0633 12.1414 14.1414L16.6586 18.6586C16.7846 18.7846 17 18.6953 17 18.5172V4.2C17 4.08954 16.9105 4 16.8 4H7.2C7.08954 4 7 4.08954 7 4.2V19Z" fill={color} />;
    case 'search':
      return <><Circle cx={10} cy={10} r={5} stroke={color} strokeWidth={2} fill="none" /><Line x1={14.4142} y1={14} x2={20} y2={19.5858} stroke={color} strokeWidth={2} strokeLinecap="round" /></>;
    case 'send':
      return <><Path d="M4 11.5L20 4L16 20L12 13L4 11.5Z" strokeWidth={1.8} {...strokeProps} /><Path d="M12 13L20 4" strokeWidth={1.8} {...strokeProps} /></>;
    case 'share':
      return <><Rect x={5} y={9} width={14} height={11} rx={1} stroke={color} strokeWidth={2} fill="none" /><Rect x={10} y={8} width={4} height={2} fill="none" /><Path d="M12 3V15" strokeWidth={1.5} {...strokeProps} /><Path d="M12 3L15 6" strokeWidth={1.5} {...strokeProps} /><Path d="M9 6L12 3" strokeWidth={1.5} {...strokeProps} /></>;
    case 'settings':
      return <><Path d="M4.01074 12.75C3.74279 12.2859 3.74279 11.7141 4.01074 11.25L7.35547 5.45605C7.62335 4.99207 8.11855 4.7062 8.6543 4.70605L15.3457 4.70605C15.8814 4.7062 16.3766 4.99207 16.6445 5.45605L19.9893 11.25C20.2237 11.6561 20.253 12.1446 20.0771 12.5713L19.9893 12.75L16.6445 18.5439C16.3766 19.0079 15.8814 19.2938 15.3457 19.2939L8.6543 19.2939C8.11855 19.2938 7.62335 19.0079 7.35547 18.5439L4.01074 12.75Z" stroke={color} strokeWidth={1.3} fill="none" /><Circle cx={12} cy={12} r={2.5} stroke={color} strokeWidth={1.3} fill="none" /></>;
    case 'trade':
      return <><Path d="M4 8.5H20" strokeWidth={1.8} {...strokeProps} /><Path d="M16.5 5L20 8.5L16.5 12" strokeWidth={1.8} {...strokeProps} /><Path d="M20 15.5H4" strokeWidth={1.8} {...strokeProps} /><Path d="M7.5 12L4 15.5L7.5 19" strokeWidth={1.8} {...strokeProps} /></>;
    case 'wallet':
      return <><Path d="M4 7.5C4 6.4 4.9 5.5 6 5.5H18C19.1 5.5 20 6.4 20 7.5V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V7.5Z" strokeWidth={1.8} {...strokeProps} /><Path d="M16 12H20" strokeWidth={1.8} {...strokeProps} /><Circle cx={16.5} cy={12} r={0.9} fill={color} /></>;
    case 'warning':
      return <><Path d="M12 14.3636V8.00001" strokeWidth={2} {...strokeProps} /><Circle cx={12} cy={17} r={1} fill={color} /><Path d="M11.1143 3.84668C11.4886 3.13202 12.5114 3.13202 12.8857 3.84668L20.5801 18.5361C20.9288 19.202 20.446 20 19.6943 20H4.30566C3.55402 20 3.07115 19.202 3.41992 18.5361L11.1143 3.84668Z" stroke={color} strokeWidth={2} fill="none" /></>;
    default:
      return null;
  }
}

export function MobileIcon({ name, color, size = 20, label, decorative, style }: MobileIconProps) {
  const isDecorative = decorative ?? !label;

  return (
    <Svg
      accessibilityElementsHidden={isDecorative}
      accessibilityLabel={!isDecorative ? label : undefined}
      accessibilityRole={!isDecorative ? 'image' : undefined}
      fill="none"
      height={size}
      importantForAccessibility={isDecorative ? 'no' : 'auto'}
      style={style}
      viewBox="0 0 24 24"
      width={size}
    >
      <IconPaths name={name} color={color} />
    </Svg>
  );
}
