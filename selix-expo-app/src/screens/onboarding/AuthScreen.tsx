import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { Button, Input } from '../../components/ui';
import { BrandWordmark } from '../../components/BrandWordmark';

export function AuthScreen() {
  const { login, authError, authLoading, setCurrentScreen, t } = useApp();
  const insets = useSafeAreaInsets();
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
      <LinearGradient
        colors={['#0A0618', '#130A28', '#1A0A35', '#0D0620']}
        locations={[0, 0.25, 0.6, 1]}
        style={styles.container}
      >
        {/* Ambient orbs */}
        <View style={[styles.orb, styles.orbA]} />
        <View style={[styles.orb, styles.orbB]} />

        <View style={[styles.inner, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>

          {/* ── Top bar: logo + back ── */}
          <View style={styles.topBar}>
            <BrandWordmark variant="white" iconStyle={styles.brandLogo} />
            <TouchableOpacity onPress={() => setCurrentScreen('Onboarding')} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>

          {/* ── Orange pill badge ── */}
          <View style={styles.badge}>
            <View style={styles.badgeIconWrap}>
              <Ionicons name="person-add-outline" size={14} color="#fff" />
            </View>
            <Text style={styles.badgeText}><Text style={styles.badgeBold}>Premium</Text> onboarding</Text>
          </View>

          {/* ── Title & subtitle ── */}
          <Text style={styles.title}>Bon retour dans Selix</Text>
          <Text style={styles.subtitle}>
            Retrouvez vos matchs, messages, visites{'\n'}et le suivi complet de votre dossier.
          </Text>

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Stats row */}
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaValue}>100%</Text>
                <Text style={styles.metaLabel}>DIGITAL</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaChip}>
                <Text style={styles.metaValue}>SMART</Text>
                <Text style={styles.metaLabel}>MATCHING</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaChip}>
                <Text style={styles.metaValue}>TEMPS REEL</Text>
                <Text style={styles.metaLabel}>SUIVI</Text>
              </View>
            </View>

            {/* Email */}
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              icon="mail-outline"
              keyboardType="email-address"
              style={styles.inputSpacing}
            />

            {/* Password */}
            <View style={styles.passwordWrap}>
              <Input
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="*************"
                icon="lock-closed-outline"
                secure={!showPwd}
                style={styles.inputSpacing}
              />
              <TouchableOpacity onPress={() => setShowPwd((p) => !p)} style={styles.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textSoft} />
              </TouchableOpacity>
            </View>

            {/* Purple notice */}
            <View style={styles.noticeBox}>
              <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
              <Text style={styles.noticeText}>
                Nouveau client ? Lancez d'abord le parcours guide. Votre compte sera créé automatiquement à la fin.
              </Text>
            </View>

            {/* Error */}
            {localError ?? authError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.danger} />
                <Text style={styles.errorText}>{localError ?? authError}</Text>
              </View>
            ) : null}

            {/* Login button */}
            <Button
              label="Se connecter"
              onPress={handleSubmit}
              loading={authLoading}
              disabled={!email.trim() || !password.trim()}
              size="lg"
            />

            {/* New client link */}
            <TouchableOpacity style={styles.linkBtn} onPress={() => setCurrentScreen('Questionnaire')}>
              <Text style={styles.linkText}>Commencer  |  inscription guidée</Text>
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <Text style={styles.legal}>
            En continuant, vous acceptez nos conditions d'utilisation{'\n'}et notre politique de confidentialité.
          </Text>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  orb: { position: 'absolute', borderRadius: 999 },
  orbA: { width: 300, height: 300, top: -120, right: -100, backgroundColor: 'rgba(160,62,255,0.14)' },
  orbB: { width: 220, height: 220, bottom: 100, left: -90, backgroundColor: 'rgba(255,79,216,0.10)' },

  inner: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandLogo: { width: 130, height: 38 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5A623',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 8,
  },
  badgeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 13 },
  badgeBold: { fontWeight: '800' },

  // Title
  title: {
    color: Colors.white,
    fontSize: 30,
    fontWeight: '300',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },

  // Card
  card: {
    backgroundColor: 'rgba(20,8,42,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
  },

  // Stats
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  metaChip: { flex: 1, alignItems: 'center' },
  metaValue: { color: Colors.white, fontSize: 12, fontWeight: '900' },
  metaLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  metaDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Inputs
  inputSpacing: { marginBottom: 0 },
  passwordWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 14, bottom: 18, padding: 4 },

  // Notice (purple)
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: 'rgba(255,107,146,0.18)',
    padding: 10,
    marginBottom: 12,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: 12, fontWeight: '700' },

  // Link
  linkBtn: { alignItems: 'center', paddingTop: 14 },
  linkText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },

  // Legal
  legal: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },
});
