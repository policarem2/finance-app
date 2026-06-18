import React from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Linking, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'

const advisors = [
  {
    id: 1,
    name: 'Sarah Mitchell, CPA',
    specialty: 'Tax planning & 1099 income',
    description: 'Specializes in self-employed individuals, freelancers and athletes. Free 30-minute consultation.',
    tags: ['Tax', '1099', 'Self-employed'],
    email: 'sarah@example.com',
    phone: '555-0101',
    free: true,
  },
  {
    id: 2,
    name: 'James Carter, CFP',
    specialty: 'Personal finance & wealth building',
    description: 'Helps individuals build long-term wealth through smart budgeting and investment strategies. Free initial consultation.',
    tags: ['Investments', 'Budgeting', 'Retirement'],
    email: 'james@example.com',
    phone: '555-0102',
    free: true,
  },
  {
    id: 3,
    name: 'Maria Torres, EA',
    specialty: 'IRS representation & tax debt',
    description: 'Enrolled Agent specializing in IRS issues, back taxes and tax debt resolution.',
    tags: ['IRS', 'Tax debt', 'Back taxes'],
    email: 'maria@example.com',
    phone: '555-0103',
    free: true,
  },
  {
    id: 4,
    name: 'David Park, MBA',
    specialty: 'Student & young adult finances',
    description: 'Focused on helping students and young professionals build healthy financial habits early.',
    tags: ['Students', 'Budgeting', 'Credit'],
    email: 'david@example.com',
    phone: '555-0104',
    free: true,
  },
]

export default function ResourcesScreen({ navigation, route }) {
  const context = route?.params?.context || null

  const handleContact = (advisor, method) => {
    if (method === 'email') {
      Linking.openURL(`mailto:${advisor.email}?subject=Free Consultation Request via Clutch`)
        .catch(() => Alert.alert('Error', 'Could not open email app.'))
    } else if (method === 'phone') {
      Linking.openURL(`tel:${advisor.phone}`)
        .catch(() => Alert.alert('Error', 'Could not open phone app.'))
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Financial resources</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>

        {/* Context banner */}
        {context && (
          <View style={styles.contextBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
            <Text style={styles.contextText}>{context}</Text>
          </View>
        )}

        <Text style={styles.intro}>
          These professionals offer free initial consultations for Clutch users.
          Whether you need tax help, budget advice or investment guidance — they're here to help.
        </Text>

        {advisors.map(advisor => (
          <View key={advisor.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {advisor.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.advisorName}>{advisor.name}</Text>
                <Text style={styles.advisorSpecialty}>{advisor.specialty}</Text>
              </View>
              {advisor.free && (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>Free consult</Text>
                </View>
              )}
            </View>

            <Text style={styles.advisorDescription}>{advisor.description}</Text>

            <View style={styles.tagsRow}>
              {advisor.tags.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>

            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => handleContact(advisor, 'email')}
              >
                <Ionicons name="mail-outline" size={16} color={colors.emerald} />
                <Text style={styles.contactBtnText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => handleContact(advisor, 'phone')}
              >
                <Ionicons name="call-outline" size={16} color={colors.emerald} />
                <Text style={styles.contactBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Clutch does not endorse any specific financial advisor. Always verify credentials before engaging professional services.
        </Text>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  header: { backgroundColor: colors.dark, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  backText: { color: colors.emerald, fontSize: 15, fontWeight: '500' },
  heading: { color: colors.textOnDark, fontSize: 17, fontWeight: '700' },
  container: { padding: 20, paddingBottom: 60, backgroundColor: colors.background },
  contextBanner: { backgroundColor: colors.goldLight, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.gold, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  contextText: { color: '#7a5c1e', fontSize: 13, flex: 1, lineHeight: 20 },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: colors.emerald, fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  advisorName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  advisorSpecialty: { fontSize: 12, color: colors.textSecondary },
  freeBadge: { backgroundColor: colors.emeraldLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.emerald },
  freeBadgeText: { color: colors.emerald, fontSize: 11, fontWeight: '600' },
  advisorDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: { backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.border },
  tagText: { fontSize: 11, color: colors.textSecondary },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.emeraldLight, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: colors.emerald },
  contactBtnText: { color: colors.emerald, fontSize: 13, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 8 },
})