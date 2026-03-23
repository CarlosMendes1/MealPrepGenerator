import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera as CameraIcon, Image as ImageIcon, Check, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Pequeno-almoço', emoji: '🌅' },
  { key: 'lunch', label: 'Almoço', emoji: '☀️' },
  { key: 'dinner', label: 'Jantar', emoji: '🌙' },
  { key: 'snack', label: 'Snack', emoji: '🍎' },
];

export default function CameraScreen() {
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisa de acesso à câmara para fotografar refeições.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri });
      setDone(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri });
      setDone(false);
    }
  }

  async function uploadMeal() {
    if (!photo) return;
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

      // Build FormData
      const formData = new FormData();
      const ext = photo.uri.split('.').pop() ?? 'jpg';
      formData.append('photo', {
        uri: photo.uri,
        type: `image/${ext}`,
        name: `meal.${ext}`,
      } as any);
      formData.append('meal_type', mealType);
      if (notes.trim()) formData.append('client_notes', notes.trim());

      const res = await fetch(`${API_URL}/api/meals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      setDone(true);
      setTimeout(() => {
        setPhoto(null);
        setDone(false);
        router.push('/(tabs)/');
      }, 1500);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível enviar a refeição. Tenta novamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="px-5 pt-6 pb-8 flex-1">
          <Text className="text-2xl font-bold text-gray-900 mb-1">Registar refeição</Text>
          <Text className="text-gray-400 text-sm mb-6">Fotografa o que acabaste de comer</Text>

          {/* Photo area */}
          {photo ? (
            <View className="relative mb-5">
              <Image
                source={{ uri: photo.uri }}
                className="w-full h-60 rounded-2xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setPhoto(null)}
                className="absolute top-3 right-3 bg-black/50 w-8 h-8 rounded-full items-center justify-center"
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-3 mb-5">
              <TouchableOpacity
                onPress={takePhoto}
                className="flex-1 bg-white border-2 border-dashed border-gray-200 rounded-2xl h-36 items-center justify-center gap-2"
              >
                <CameraIcon size={28} color="#9ca3af" />
                <Text className="text-sm text-gray-400 font-medium">Câmara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickFromLibrary}
                className="flex-1 bg-white border-2 border-dashed border-gray-200 rounded-2xl h-36 items-center justify-center gap-2"
              >
                <ImageIcon size={28} color="#9ca3af" />
                <Text className="text-sm text-gray-400 font-medium">Galeria</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Meal type */}
          <Text className="font-semibold text-gray-900 text-sm mb-3">Tipo de refeição</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {MEAL_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setMealType(t.key)}
                className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl border ${
                  mealType === t.key
                    ? 'bg-brand-600 border-brand-600'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text>{t.emoji}</Text>
                <Text className={`text-sm font-medium ${mealType === t.key ? 'text-white' : 'text-gray-700'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          {photo && (
            <View className="mb-5">
              <Text className="font-semibold text-gray-900 text-sm mb-2">
                Ingredientes / notas <Text className="text-gray-400 font-normal">(opcional)</Text>
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: arroz integral, frango grelhado 150g, azeite 1 colher..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                maxLength={500}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 min-h-[72px]"
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-xs text-gray-400 mt-1 text-right">{notes.length}/500</Text>
            </View>
          )}

          {/* Submit */}
          {photo && (
            <TouchableOpacity
              onPress={uploadMeal}
              disabled={uploading || done}
              className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
                done ? 'bg-green-500' : 'bg-brand-600'
              }`}
            >
              {uploading ? (
                <ActivityIndicator color="white" size="small" />
              ) : done ? (
                <Check size={20} color="white" />
              ) : (
                <CameraIcon size={20} color="white" />
              )}
              <Text className="text-white font-semibold text-base">
                {uploading ? 'A enviar...' : done ? 'Enviado!' : 'Enviar refeição'}
              </Text>
            </TouchableOpacity>
          )}

          {!photo && (
            <View className="bg-brand-50 rounded-2xl p-4 mt-2">
              <Text className="text-brand-700 text-sm font-medium mb-1">Como funciona?</Text>
              <Text className="text-brand-600 text-sm leading-relaxed">
                Fotografa a tua refeição, seleciona o tipo, e envia. A IA analisa automaticamente
                os alimentos e o teu nutricionista recebe o rascunho de feedback.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
