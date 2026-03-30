import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Button, Input } from '../../components/ui';
import { BrandWordmark } from '../../components/BrandWordmark';

export function AuthScreen() {
  const { login, authError, authLoading, setCurrentScreen, t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!email.trim() || !password.trim()) return;

    try {
      await login(email.trim(), password);
    } catch (error: any) {
      setLocalError(error?.message ?? 'Email ou mot de passe incorrect');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={Colors.gradientHero} style={styles.container}>
        <View style={[styles.orb, styles.orbA]} />
        <View style={[styles.orb, styles.orbB]} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <TouchableOpacity onPress={() => setCurrentScreen('Welcome')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
            </TouchableOpacity>

            <BrandWordmark />
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={12} color={Colors.white} />
              <Text style={styles.heroBadgeText}>{t('auth.heroBadge')}</Text>
            </View>
            <Text style={styles.title}>{t('auth.loginTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
          </View>

          <LinearGradient colors={Colors.gradientCard} style={styles.formCard}>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaValue}>100%</Text>
                <Text style={styles.metaLabel}>{t('auth.digital')}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaChip}>
                <Text style={styles.metaValue}>smart</Text>
                <Text style={styles.metaLabel}>{t('auth.matching')}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaChip}>
                <Text style={styles.metaValue}>{t('auth.realtime')}</Text>
                <Text style={styles.metaLabel}>{t('auth.followup')}</Text>
              </View>
            </View>

            <Input label={t('auth.email')} value={email} onChangeText={setEmail} placeholder={t('auth.placeholder.email')} icon="mail-outline" keyboardType="email-address" />

            <View>
              <Input label={t('auth.password')} value={password} onChangeText={setPassword} placeholder={t('auth.placeholder.password')} icon="lock-closed-outline" secure={!showPwd} />
              <TouchableOpacity onPress={() => setShowPwd((prev) => !prev)} style={styles.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textSoft} />
              </TouchableOpacity>
            </View>

            <View style={styles.noticeBox}>
              <Ionicons name="sparkles-outline" size={18} color={Colors.accentOrange} />
              <Text style={styles.noticeText}>
                Nouveau client ? Lancez d abord le parcours guide. Votre compte sera cree automatiquement a la fin.
              </Text>
            </View>

            {localError ?? authError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{localError ?? authError}</Text>
              </View>
            ) : null}

            <Button
              label={t('auth.loginCta')}
              onPress={handleSubmit}
              loading={authLoading}
              disabled={!email.trim() || !password.trim()}
              size="lg"
              iconRight="arrow-forward"
            />

            <TouchableOpacity style={styles.linkBtn} onPress={() => setCurrentScreen('Questionnaire')}>
              <Text style={styles.linkText}>Commencer l inscription guidee</Text>
            </TouchableOpacity>
          </LinearGradient>

          <Text style={styles.legal}>{t('auth.legal')}</Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 40 },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  orbA: { width: 260, height: 260, top: -90, right: -90 },
  orbB: { width: 200, height: 200, bottom: 130, left: -80, backgroundColor: 'rgba(255,138,30,0.08)' },
  hero: { marginBottom: 24 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 22,
  },
  heroBadge: {
    marginTop: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  title: { marginTop: 16, color: Colors.white, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 22, maxWidth: 330 },
  formCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 18,
  },
  metaChip: { flex: 1, alignItems: 'center' },
  metaValue: { color: Colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  metaLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  metaDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  eyeBtn: { position: 'absolute', right: 14, top: 36, padding: 6 },
  noticeBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 18,
    backgroundColor: 'rgba(255,138,30,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,30,0.14)',
    padding: 14,
    marginBottom: 14,
  },
  noticeText: { flex: 1, color: Colors.accentOrange, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: 'rgba(255,107,146,0.18)',
    padding: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingTop: 14 },
  linkText: { color: Colors.primarySoft, fontSize: 14, fontWeight: '800' },
  legal: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    marginHorizontal: 12,
  },
});
