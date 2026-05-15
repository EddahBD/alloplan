import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    image: require("@/assets/images/onboarding1.png"),
    title: "Your Event,\nPerfectly Planned",
    subtitle:
      "Connect with top vendors — photographers, decorators, MCs, caterers, venues and more — all in one place.",
  },
  {
    id: "2",
    image: require("@/assets/images/onboarding2.png"),
    title: "Smart Tools\nfor Every Event",
    subtitle:
      "AI-powered budget planner, smart vendor matching, event timelines, and real-time booking — effortlessly.",
  },
  {
    id: "3",
    image: require("@/assets/images/onboarding3.png"),
    title: "Earn While\nYou Share",
    subtitle:
      "Refer friends and vendors to earn commissions. Your referral link is your passive income machine.",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { markOnboarded } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const isLast = activeIndex === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleGetStarted();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleGetStarted = async () => {
    await markOnboarded();
    router.replace("/(auth)/role");
  };

  const handleSkip = async () => {
    await markOnboarded();
    router.replace("/(auth)/login");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.navy, paddingTop: Platform.OS === "web" ? 67 : insets.top },
      ]}
    >
      {/* Skip button */}
      <TouchableOpacity
        onPress={handleSkip}
        style={[styles.skipBtn, { top: (Platform.OS === "web" ? 67 : insets.top) + 12 }]}
        testID="skip-onboarding"
      >
        <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
          Skip
        </Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image
              source={item.image}
              style={styles.slideImage}
              resizeMode="cover"
            />
            <View style={styles.slideContent}>
              <Text
                style={[
                  styles.slideTitle,
                  { color: colors.foreground, fontFamily: "Poppins_700Bold" },
                ]}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.slideSubtitle,
                  { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
                ]}
              >
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View
        style={[
          styles.bottom,
          {
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
          },
        ]}
      >
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === activeIndex ? colors.primary : colors.muted,
                  width: i === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button
          title={isLast ? "Get Started" : "Next"}
          onPress={handleNext}
          size="lg"
          style={{ width: "100%" }}
          testID="onboarding-next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: { position: "absolute", right: 24, zIndex: 10, padding: 4 },
  skipText: { fontSize: 14 },
  slide: { flex: 1 },
  slideImage: {
    width: "100%",
    height: width * 0.9,
  },
  slideContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    gap: 12,
  },
  slideTitle: { fontSize: 32, lineHeight: 42 },
  slideSubtitle: { fontSize: 15, lineHeight: 24 },
  bottom: {
    paddingHorizontal: 24,
    gap: 24,
  },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center" },
  dot: { height: 8, borderRadius: 4 },
});
