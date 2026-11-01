import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type UnderlineTabsProps<T extends string> = {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
};

/** Underlined section switcher, like the section tabs in a publication. */
export function UnderlineTabs<T extends string>({ tabs, active, onChange }: UnderlineTabsProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.tabs, { borderBottomColor: theme.border }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[styles.tab, { borderBottomColor: isActive ? theme.tint : 'transparent' }]}>
            <Text
              numberOfLines={1}
              style={[
                styles.tabText,
                { color: isActive ? theme.text : theme.textSecondary, fontFamily: isActive ? Fonts.bold : Fonts.medium },
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, marginBottom: -1 },
  tabText: { fontSize: 15 },
});
