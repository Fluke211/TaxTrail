// Compliant fallback paywall.
//
// The primary paywall is RevenueCat's remote-configured template. This shows
// only when that fails to load — but "only in an edge case" is not a defence at
// review time: if it renders for a reviewer, it is the paywall.
//
// Apple Guideline 3.1.2 requires any screen offering a subscription to state the
// title, length, and price of each period, disclose auto-renewal, and link to
// both a EULA and a privacy policy. The Alert this replaces had none of that.
import React from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from '../lib/theme';

// Apple's standard EULA, which applies unless a custom one is supplied in
// App Store Connect. Linking to it satisfies the "terms of use" requirement.
const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://fluke211.github.io/receipt-snap/privacy.html';

export interface PaywallPackage {
  id: string;
  title: string;
  priceString: string;
  /** e.g. "per month", "per year", "one-time" */
  periodLabel: string;
  /** e.g. "7-day free trial, then" */
  introLabel?: string;
  autoRenewing: boolean;
}

interface Props {
  visible: boolean;
  packages: PaywallPackage[];
  onPurchase: (id: string) => void;
  onRestore: () => void;
  onClose: () => void;
}

export function FallbackPaywall({ visible, packages, onPurchase, onRestore, onClose }: Props) {
  const anyAutoRenewing = packages.some((p) => p.autoRenewing);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.sheet}>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.title}>TaxTrail Pro</Text>
          <Text style={s.sub}>
            Unlimited scans, plus Excel, TXF and QuickBooks exports. Everything
            still stays on your device.
          </Text>

          {packages.map((p) => (
            <Pressable key={p.id} style={s.pkg} onPress={() => onPurchase(p.id)}>
              <Text style={s.pkgTitle}>{p.title}</Text>
              <Text style={s.pkgPrice}>
                {p.introLabel ? `${p.introLabel} ` : ''}{p.priceString} {p.periodLabel}
              </Text>
            </Pressable>
          ))}

          {/* Required disclosure — must be visible on the offer screen itself. */}
          {anyAutoRenewing && (
            <Text style={s.legal}>
              Subscriptions renew automatically unless auto-renew is turned off at
              least 24 hours before the end of the current period. Your account is
              charged for renewal within 24 hours of the end of the current period.
              Manage or cancel in your Apple ID settings after purchase. Any unused
              portion of a free trial is forfeited when a subscription is purchased.
              The lifetime option is a one-time purchase and does not renew.
            </Text>
          )}

          <View style={s.links}>
            <Pressable onPress={() => Linking.openURL(EULA_URL)} hitSlop={10}>
              <Text style={s.link}>Terms of Use</Text>
            </Pressable>
            <Text style={s.dot}>·</Text>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={10}>
              <Text style={s.link}>Privacy Policy</Text>
            </Pressable>
            <Text style={s.dot}>·</Text>
            <Pressable onPress={onRestore} hitSlop={10}>
              <Text style={s.link}>Restore Purchases</Text>
            </Pressable>
          </View>

          <Pressable style={s.notNow} onPress={onClose}>
            <Text style={s.notNowText}>Not now</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: T.bg },
  body: { padding: 22, paddingTop: 64 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  sub: { color: T.muted, fontSize: 15, marginTop: 8, marginBottom: 22, lineHeight: 21 },
  pkg: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1,
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  pkgTitle: { color: T.text, fontSize: 16, fontWeight: '600' },
  pkgPrice: { color: T.accent, fontSize: 14, marginTop: 4 },
  legal: { color: T.muted2, fontSize: 11, lineHeight: 16, marginTop: 16 },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8 },
  link: { color: T.accent, fontSize: 13 },
  dot: { color: T.muted2, fontSize: 13 },
  notNow: { alignSelf: 'center', marginTop: 26, padding: 10 },
  notNowText: { color: T.muted, fontSize: 15 },
});
