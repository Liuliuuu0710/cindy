import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/AppText';
import { ThemeOverrideProvider, useTheme } from '@/theme/ThemeProvider';
import { TaskTagsSheet } from '@/session/TaskTagsSheet';
function Panel({ setMode }: {setMode(mode:'light'|'dark'):void}) {
  const [visible, setVisible] = useState(false);
  const [locked, setLocked] = useState(false);
  const { colors } = useTheme();
  return <View style={{flex:1,backgroundColor:colors.surface,padding:24,paddingTop:90}}>
    <Text>PR #7445 · 独立 SQLite 测试数据</Text>
    <Text>{process.env.EXPO_PUBLIC_XDT_GIT_SOURCE}</Text>
    <Text>Global · Metro localhost:8081 · 原生开发包</Text>
    <Pressable style={{padding:24,marginTop:24}} onPress={()=>{setLocked(false);setVisible(true);}}><Text>打开标签验收</Text></Pressable>
    <Pressable style={{padding:24}} onPress={()=>setMode('light')}><Text>浅色验收</Text></Pressable>
    <Pressable style={{padding:24}} onPress={()=>setMode('dark')}><Text>深色验收</Text></Pressable>
    <Pressable style={{padding:24}} onPress={()=>{setLocked(false);setVisible(true);setTimeout(()=>setLocked(true),10000);}}><Text>离线验收</Text></Pressable>
    <TaskTagsSheet session={{id:'session-primary',canonicalDeviceId:'cindy-visual-mock-mac',tags:[]} as any} visible={visible} disabled={locked} onClose={()=>setVisible(false)} onClosed={()=>{}} />
  </View>;
}
export default function TagQA() {
  const [mode,setMode] = useState<'light'|'dark'>('light');
  if (!__DEV__) return null;
  return <ThemeOverrideProvider mode={mode}><Panel setMode={setMode}/></ThemeOverrideProvider>;
}
