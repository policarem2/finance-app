import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

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
          Animated.timing(dot, {
            toValue: -10,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
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
          <Text style={styles.logoText}>AF</Text>
        </View>
        <Text style={styles.appName}>Athlete Finance</Text>
        <Text style={styles.tagline}>Track your money. Focus on your game.</Text>
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
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(167,139,250,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
  logoText: { color: '#a78bfa', fontSize: 28, fontWeight: '700' },
  appName: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  tagline: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 48 },
  dotsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a78bfa' },
})