import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { colors } from '../theme'

export default function LoadingScreen() {
  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()

    const animateDot = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -10, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start()
    }

    animateDot(dot1, 0)
    animateDot(dot2, 150)
    animateDot(dot3, 300)
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.appName}>CLUTCH</Text>
        <Text style={styles.tagline}>Your Money. Your Moment.</Text>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: colors.gold },
  logoText: { color: colors.gold, fontSize: 48, fontWeight: '800', fontStyle: 'italic' },
  appName: { color: colors.textOnDark, fontSize: 32, fontWeight: '800', letterSpacing: 6, marginBottom: 8 },
  tagline: { color: colors.textOnDarkMuted, fontSize: 13, marginBottom: 48, letterSpacing: 0.5 },
  dotsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
})