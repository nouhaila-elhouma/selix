import React, { ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

function PremiumBackdrop() {
  return (
    <>
      <LinearGradient colors={Colors.gradientHero} style={styles.backdropBase} />
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />
      <View style={[styles.orb, styles.orbC]} />
    </>
  );
}

export function Screen({
  children, scroll = true, style, bg, padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  bg?: string;
  padded?: boolean;
}) {
  const content = (
    <View style={[styles.screenInner, padded && styles.screenPadded, !scroll ? style : null]}>
      {children}
    </View>
  );

  if (scroll) {
    return (
      <View style={[styles.screen, bg ? { backgroundColor: bg } : null]}>
        {!bg && <PremiumBackdrop />}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, bg ? { backgroundColor: bg } : null, style]}>
      {!bg && <PremiumBackdrop />}
      {children}
    </View>
  );
}

export function Card({
  children, style, onPress, shadow = true, padding = 18,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  shadow?: boolean;
  padding?: number;
}) {
  const cardStyle = [styles.card, shadow && styles.cardShadow, { padding }, style];
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function GradientCard({
  children, style, onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = (
    <LinearGradient colors={Colors.gradientCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradientCard, style]}>
      <View style={styles.gradientGlow} />
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export function PageTitle({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.pageTitle, style]}>{children}</Text>;
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function BodyText({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.bodyText, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon, iconRight, loading = false, disabled = false, style, fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const sizeStyle = {
    sm: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16 },
    md: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 18 },
    lg: { paddingVertical: 18, paddingHorizontal: 24, borderRadius: 20 },
  }[size];

  const fontSizeMap: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.92}
        disabled={disabled || loading}
        style={[{ width: fullWidth ? '100%' : undefined }, style]}
      >
        <LinearGradient
          colors={disabled ? [Colors.border, Colors.border] : Colors.gradientCta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btnBase, styles.primaryButton, sizeStyle]}
        >
          <View style={styles.primaryButtonGlow} />
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              {icon && <Ionicons name={icon as any} size={fontSizeMap[size] + 2} color={Colors.white} style={styles.leftIcon} />}
              <Text style={[styles.btnTextPrimary, { fontSize: fontSizeMap[size] }]}>{label}</Text>
              {iconRight && <Ionicons name={iconRight as any} size={fontSizeMap[size] + 2} color={Colors.white} style={styles.rightIcon} />}
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: {},
    secondary: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    ghost: { backgroundColor: 'transparent', borderWidth: 0 },
    danger: { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: 'rgba(255,107,146,0.22)' },
    outline: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1.25, borderColor: 'rgba(198,135,255,0.34)' },
  };

  const textColors: Record<ButtonVariant, string> = {
    primary: Colors.white,
    secondary: Colors.textBody,
    ghost: Colors.primarySoft,
    danger: Colors.danger,
    outline: Colors.primarySoft,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled || loading}
      style={[
        styles.btnBase,
        sizeStyle,
        variantStyles[variant],
        disabled && { opacity: 0.55 },
        { width: fullWidth ? '100%' : undefined },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={fontSizeMap[size] + 2} color={textColors[variant]} style={styles.leftIcon} />}
          <Text style={[styles.btnTextAlt, { fontSize: fontSizeMap[size], color: textColors[variant] }]}>{label}</Text>
          {iconRight && <Ionicons name={iconRight as any} size={fontSizeMap[size] + 2} color={textColors[variant]} style={styles.rightIcon} />}
        </>
      )}
    </TouchableOpacity>
  );
}

type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

export function Badge({
  label, tone = 'primary', size = 'sm', dot = false, style,
}: {
  label: string;
  tone?: BadgeTone;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const toneColors: Record<BadgeTone, { bg: string; text: string }> = {
    primary: { bg: 'rgba(142,53,255,0.14)', text: Colors.primarySoft },
    success: { bg: Colors.successLight, text: Colors.success },
    warning: { bg: Colors.warningLight, text: Colors.warning },
    danger: { bg: Colors.dangerLight, text: Colors.danger },
    info: { bg: Colors.infoLight, text: Colors.info },
    neutral: { bg: 'rgba(255,255,255,0.08)', text: Colors.textSoft },
    purple: { bg: 'rgba(227,22,140,0.18)', text: Colors.white },
  };

  const fontSizeMap: Record<'xs' | 'sm' | 'md', number> = { xs: 10, sm: 11, md: 12 };
  const paddingMap: Record<'xs' | 'sm' | 'md', number> = { xs: 8, sm: 10, md: 12 };

  return (
    <View style={[styles.badge, { backgroundColor: toneColors[tone].bg, paddingHorizontal: paddingMap[size] }, style]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: toneColors[tone].text }]} /> : null}
      <Text style={[styles.badgeText, { color: toneColors[tone].text, fontSize: fontSizeMap[size] }]}>{label}</Text>
    </View>
  );
}

export function Input({
  label, value, onChangeText, placeholder, secure = false, icon, keyboardType, multiline = false, style, editable = true,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  icon?: string;
  keyboardType?: any;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? 'rgba(198,135,255,0.55)' : 'rgba(255,255,255,0.08)';
  const bgColor = focused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)';

  return (
    <View style={[styles.inputWrapper, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View style={[styles.inputRow, { borderColor, backgroundColor: bgColor }]}>
        {icon ? <Ionicons name={icon as any} size={18} color={focused ? Colors.primarySoft : Colors.textMuted} style={styles.inputIcon} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, icon && styles.inputWithIcon, multiline && styles.multilineInput]}
        />
      </View>
    </View>
  );
}

export function SelectChip({
  label, selected, onPress, icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.chip, selected && styles.chipSelected]}>
      {icon ? <Ionicons name={icon as any} size={14} color={selected ? Colors.white : Colors.textSoft} style={styles.leftIcon} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={12} color={Colors.white} style={styles.rightIcon} /> : null}
    </TouchableOpacity>
  );
}

export function StatCard({
  label, value, icon, color, bg, trend, trendUp, style,
}: {
  label: string;
  value: string;
  icon?: string;
  color?: string;
  bg?: string;
  trend?: string;
  trendUp?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const accentColor = color ?? Colors.accentMagenta;
  const bgColor = bg ?? 'rgba(255,255,255,0.08)';

  return (
    <Card style={[styles.statCard, style]}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        {icon ? <Ionicons name={icon as any} size={18} color={accentColor} /> : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {trend ? (
        <View style={styles.trendRow}>
          <Ionicons name={trendUp ? 'trending-up' : 'trending-down'} size={12} color={trendUp ? Colors.success : Colors.danger} />
          <Text style={[styles.trendText, { color: trendUp ? Colors.success : Colors.danger }]}>{` ${trend}`}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const color = useMemo(() => (
    score >= 70 ? Colors.success :
    score >= 50 ? Colors.warning :
    score >= 30 ? Colors.info :
    Colors.textMuted
  ), [score]);

  return (
    <View style={[styles.scoreRingShell, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
      <View style={[styles.scoreRing, {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: size < 40 ? 3 : 4,
        borderColor: color,
      }]}
      >
        <Text style={{ fontSize: size < 40 ? 11 : 14, color, fontWeight: '800' }}>{score}</Text>
      </View>
    </View>
  );
}

export function ProgressBar({
  value, max = 100, color, height = 6, style,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={[styles.progressTrack, { height }, style]}>
      <LinearGradient
        colors={color ? [color, color] : Colors.gradientCta}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressFill, { width: `${pct}%`, height } as any]}
      />
    </View>
  );
}

export function SectionHeader({
  title, action, onAction, style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View>
        <Text style={styles.sectionEyebrow}>Selix</Text>
        <SectionTitle>{title}</SectionTitle>
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} style={styles.sectionActionPill}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon, title, subtitle, action, onAction,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <LinearGradient colors={Colors.gradientCard} style={styles.emptyIconShell}>
        <View style={styles.emptyIcon}>
          {icon ? <Ionicons name={icon as any} size={40} color={Colors.primarySoft} /> : null}
        </View>
      </LinearGradient>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {action && onAction ? (
        <Button label={action} onPress={onAction} variant="primary" size="sm" fullWidth={false} style={styles.emptyButton} />
      ) : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Row({ children, style, gap = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.row, gap ? { gap } : null, style]}>{children}</View>;
}

export function Spacer({ h = 0, w = 0 }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}

const styles = StyleSheet.create({
  backdropBase: { ...StyleSheet.absoluteFillObject },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  orbA: { width: 280, height: 280, top: -90, right: -80 },
  orbB: { width: 240, height: 240, bottom: 80, left: -120, backgroundColor: 'rgba(227,22,140,0.08)' },
  orbC: { width: 180, height: 180, top: 220, right: -40, backgroundColor: 'rgba(255,138,30,0.06)' },

  screen: { flex: 1, backgroundColor: Colors.bgMain },
  screenInner: { flex: 1 },
  screenPadded: { padding: 20 },
  scrollContent: { paddingBottom: 108 },

  card: {
    backgroundColor: 'rgba(17,11,33,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 10,
  },
  gradientCard: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  gradientGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 180,
    top: -50,
    right: -50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.3 },
  bodyText: { fontSize: 14, color: Colors.textBody, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  muted: { fontSize: 13, color: Colors.textMuted },

  btnBase: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  primaryButton: {
    overflow: 'hidden',
    shadowColor: '#8E35FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 8,
  },
  primaryButtonGlow: {
    position: 'absolute',
    top: -24,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  btnTextPrimary: { color: Colors.white, fontWeight: '800', letterSpacing: 0.2 },
  btnTextAlt: { fontWeight: '700', letterSpacing: 0.2 },
  leftIcon: { marginRight: 8 },
  rightIcon: { marginLeft: 8 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badgeText: { fontWeight: '700', letterSpacing: 0.2 },

  inputWrapper: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.textBody, marginBottom: 8, letterSpacing: 0.25 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 58,
  },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, fontSize: 15, color: Colors.textDark, fontWeight: '500' },
  inputWithIcon: { paddingLeft: 10 },
  multilineInput: { height: 92, textAlignVertical: 'top' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 8,
    marginBottom: 10,
  },
  chipSelected: {
    backgroundColor: 'rgba(142,53,255,0.8)',
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#8E35FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  chipText: { fontSize: 13, color: Colors.textSoft, fontWeight: '600' },
  chipTextSelected: { color: Colors.white, fontWeight: '800' },

  statCard: { alignItems: 'flex-start', flex: 1, minWidth: 104 },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statValue: { fontSize: 22, fontWeight: '900', color: Colors.textDark, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: Colors.textSoft, marginTop: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  trendText: { fontSize: 11, fontWeight: '700' },

  scoreRingShell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  scoreRing: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSection },

  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: { borderRadius: 999 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionEyebrow: { fontSize: 11, color: Colors.accentOrange, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  sectionActionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionAction: { fontSize: 12, fontWeight: '700', color: Colors.primarySoft },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIconShell: { borderRadius: 28, padding: 1, marginBottom: 18 },
  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 27,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSoft, textAlign: 'center', lineHeight: 21 },
  emptyButton: { marginTop: 16, paddingHorizontal: 24 } as ViewStyle,

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
