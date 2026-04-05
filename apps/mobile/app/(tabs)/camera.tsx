import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  ActivityIndicator, TextInput, Modal, FlatList, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera as CameraIcon, Image as ImageIcon, Check, X, ChevronDown,
  Lock, Plus, Trash2, QrCode, ScanLine,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { PaywallModal } from '@/components/PaywallModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const FREE_MEAL_LIMIT = 3;
const UNITS = ['g', 'ml', 'un'] as const;
type Unit = typeof UNITS[number];

type MealType =
  | 'breakfast' | 'morning_snack' | 'lunch'
  | 'afternoon_snack' | 'dinner' | 'supper' | 'snack';

const MEAL_TYPES: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast',       label: 'Pequeno-almoço',  emoji: '🌅' },
  { key: 'morning_snack',   label: 'Lanche da manhã', emoji: '🍌' },
  { key: 'lunch',           label: 'Almoço',           emoji: '☀️' },
  { key: 'afternoon_snack', label: 'Lanche da tarde',  emoji: '🍎' },
  { key: 'dinner',          label: 'Jantar',           emoji: '🌙' },
  { key: 'supper',          label: 'Ceia',             emoji: '🌛' },
  { key: 'snack',           label: 'Snack',            emoji: '🥜' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: Unit;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CameraScreen() {
  // Photo
  const [photo, setPhoto]     = useState<{ uri: string } | null>(null);
  // Meal type
  const [mealType, setMealType]           = useState<MealType | null>(null);
  const [mealPickerVisible, setMealPickerVisible] = useState(false);
  // Description
  const [description, setDescription]     = useState('');
  // Ingredients
  const [ingredients, setIngredients]     = useState<Ingredient[]>([]);
  const [ingredientModal, setIngredientModal] = useState(false);
  const [ingName, setIngName]             = useState('');
  const [ingQty, setIngQty]               = useState('');
  const [ingUnit, setIngUnit]             = useState<Unit>('g');
  // Barcode
  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Submit
  const [uploading, setUploading] = useState(false);
  const [done, setDone]           = useState(false);
  // Paywall
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [isFreeUser, setIsFreeUser]         = useState(false);
  const [mealsToday, setMealsToday]         = useState(0);
  // Toast
  const { toast, show: showToast, hide: hideToast } = useToast();

  // ── Check free limit on mount ──────────────────────────────────────────
  useEffect(() => {
    async function checkLimit() {
      try {
        const [profile, meals] = await Promise.all([
          api.get<{ ai_coach_enabled: boolean; nutritionist_id: string | null }>('/api/profile'),
          api.get<Array<{ eaten_at: string }>>('/api/meals?limit=50'),
        ]);
        const isAIMode = !profile.nutritionist_id;
        if (isAIMode && !profile.ai_coach_enabled) {
          setIsFreeUser(true);
          const today = new Date().toDateString();
          const count = meals.filter((m) => new Date(m.eaten_at).toDateString() === today).length;
          setMealsToday(count);
          if (count >= FREE_MEAL_LIMIT) setPaywallVisible(true);
        }
      } catch { /* silent */ }
    }
    checkLimit();
  }, []);

  // ── Photo helpers ──────────────────────────────────────────────────────
  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Precisa de acesso à câmara para fotografar refeições.', 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri });
      setDone(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri });
      setDone(false);
    }
  }

  // ── Ingredient helpers ─────────────────────────────────────────────────
  function openIngredientModal() {
    setIngName('');
    setIngQty('');
    setIngUnit('g');
    setIngredientModal(true);
  }

  function addIngredient() {
    if (!ingName.trim()) {
      showToast('Introduz o nome do ingrediente.', 'info');
      return;
    }
    setIngredients((prev) => [
      ...prev,
      { id: Date.now().toString(), name: ingName.trim(), quantity: ingQty.trim() || '?', unit: ingUnit },
    ]);
    setIngredientModal(false);
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  // ── Barcode scanner ────────────────────────────────────────────────────
  async function openBarcodeScanner() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        showToast('Precisa de acesso à câmara para scannar o código de barras.', 'error');
        return;
      }
    }
    setBarcodeScanned(false);
    setBarcodeLoading(false);
    setIngredientModal(false);
    setBarcodeVisible(true);
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (barcodeScanned || barcodeLoading) return;
    setBarcodeScanned(true);
    setBarcodeLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(data)}.json`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json.status === 1 && json.product?.product_name) {
          const productName: string = json.product.product_name;
          const brand: string = json.product.brands
            ? ` (${(json.product.brands as string).split(',')[0].trim()})`
            : '';
          setIngName(`${productName}${brand}`);
          setBarcodeVisible(false);
          setIngredientModal(true);
        } else {
          showToast('Produto não encontrado. Introduz o nome manualmente.', 'info');
          setBarcodeScanned(false);
          setBarcodeLoading(false);
        }
      } else {
        throw new Error('API error');
      }
    } catch {
      showToast('Não foi possível identificar o produto. Tenta novamente.', 'info');
      setBarcodeScanned(false);
      setBarcodeLoading(false);
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────
  async function uploadMeal() {
    if (!mealType) {
      showToast('Por favor seleciona o tipo de refeição antes de enviar.', 'info');
      return;
    }
    if (!photo && !description.trim() && ingredients.length === 0) {
      showToast('Adiciona uma foto, descrição ou ingredientes para continuar.', 'info');
      return;
    }
    if (isFreeUser && mealsToday >= FREE_MEAL_LIMIT) {
      setPaywallVisible(true);
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
      const formData = new FormData();

      if (photo) {
        const ext = photo.uri.split('.').pop() ?? 'jpg';
        formData.append('photo', { uri: photo.uri, type: `image/${ext}`, name: `meal.${ext}` } as any);
      }

      formData.append('meal_type', mealType);
      if (description.trim()) formData.append('description', description.trim());
      if (ingredients.length > 0) {
        formData.append('ingredients', JSON.stringify(
          ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit }))
        ));
      }

      const res = await fetch(`${API_URL}/api/meals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      setDone(true);
      setTimeout(() => {
        setPhoto(null); setMealType(null);
        setDescription(''); setIngredients([]);
        setDone(false);
        router.push('/(tabs)/');
      }, 1500);
    } catch {
      showToast('Não foi possível enviar a refeição. Tenta novamente.', 'error');
    } finally {
      setUploading(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const selectedType = MEAL_TYPES.find((t) => t.key === mealType);
  const hasContent   = !!photo || description.trim().length > 0 || ingredients.length > 0;
  const canSubmit    = !!mealType && hasContent && !uploading && !done;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        mealsToday={mealsToday}
        limit={FREE_MEAL_LIMIT}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-6 pb-8 flex-1">

          {/* Header */}
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-2xl font-bold text-gray-900">Registar refeição</Text>
            {isFreeUser && (
              <TouchableOpacity
                onPress={() => setPaywallVisible(true)}
                className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  mealsToday >= FREE_MEAL_LIMIT ? 'bg-red-100' : 'bg-slate-100'
                }`}
              >
                {mealsToday >= FREE_MEAL_LIMIT && <Lock size={11} color="#ef4444" />}
                <Text className={`text-xs font-bold ${mealsToday >= FREE_MEAL_LIMIT ? 'text-red-500' : 'text-slate-500'}`}>
                  {mealsToday}/{FREE_MEAL_LIMIT} hoje
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text className="text-gray-400 text-sm mb-5">Foto, descrição e/ou ingredientes</Text>

          {/* ── Photo section (optional) ─────────────────────────────── */}
          {photo ? (
            <View className="relative mb-4">
              <Image source={{ uri: photo.uri }} className="w-full h-52 rounded-2xl" resizeMode="cover" />
              <TouchableOpacity
                onPress={() => setPhoto(null)}
                className="absolute top-3 right-3 bg-black/50 w-8 h-8 rounded-full items-center justify-center"
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="mb-4">
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-1 bg-white border-2 border-dashed border-brand-200 rounded-2xl h-28 items-center justify-center gap-1.5"
                >
                  <CameraIcon size={24} color="#818cf8" />
                  <Text className="text-xs text-brand-400 font-medium">Câmara</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickFromLibrary}
                  className="flex-1 bg-white border-2 border-dashed border-gray-200 rounded-2xl h-28 items-center justify-center gap-1.5"
                >
                  <ImageIcon size={24} color="#9ca3af" />
                  <Text className="text-xs text-gray-400 font-medium">Galeria</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-gray-400 text-center mt-2">
                Foto opcional — o AI analisa melhor com foto
              </Text>
            </View>
          )}

          {/* ── Description ─────────────────────────────────────────── */}
          <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4">
            <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Descrição da refeição
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="ex: arroz com frango e cogumelos, almoço equilibrado..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={2}
              maxLength={500}
              className="text-sm text-gray-800 min-h-[44px]"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* ── Ingredients ─────────────────────────────────────────── */}
          <View className="bg-white border border-gray-200 rounded-2xl px-4 pt-3 pb-2 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ingredientes
                </Text>
                {ingredients.length > 0 && (
                  <View className="bg-brand-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs font-bold text-brand-700">{ingredients.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={openBarcodeScanner}
                className="flex-row items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <QrCode size={13} color="#64748b" />
                <Text className="text-xs font-semibold text-slate-600">Scan</Text>
              </TouchableOpacity>
            </View>

            {/* Ingredient list */}
            {ingredients.length > 0 && (
              <View className="mb-3 gap-2">
                {ingredients.map((ing) => (
                  <View key={ing.id}
                    className="flex-row items-center bg-slate-50 rounded-xl px-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                        {ing.name}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {ing.quantity}{ing.unit}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeIngredient(ing.id)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 items-center justify-center ml-2"
                    >
                      <Trash2 size={12} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={openIngredientModal}
              className="flex-row items-center justify-center gap-2 py-2.5 border border-dashed border-gray-200 rounded-xl"
            >
              <Plus size={15} color="#6366f1" />
              <Text className="text-sm font-semibold text-brand-600">
                Adicionar ingrediente
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Meal type ────────────────────────────────────────────── */}
          <Text className="font-semibold text-gray-900 text-sm mb-2">
            Tipo de refeição <Text className="text-red-400">*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setMealPickerVisible(true)}
            className={`flex-row items-center justify-between bg-white border rounded-xl px-4 py-3.5 mb-5 ${
              mealType ? 'border-gray-200' : 'border-red-200'
            }`}
          >
            {selectedType ? (
              <Text className="text-sm text-gray-800 font-medium">
                {selectedType.emoji}  {selectedType.label}
              </Text>
            ) : (
              <Text className="text-sm text-gray-400">Seleciona o tipo de refeição...</Text>
            )}
            <ChevronDown size={18} color="#9ca3af" />
          </TouchableOpacity>

          {/* ── Submit ───────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={uploadMeal}
            disabled={!canSubmit}
            className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
              done ? 'bg-green-500' : canSubmit ? 'bg-brand-600' : 'bg-gray-300'
            }`}
            style={canSubmit && !done ? { shadowColor: '#4f46e5', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 } : undefined}
          >
            {uploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : done ? (
              <Check size={20} color="white" />
            ) : (
              <CameraIcon size={20} color={canSubmit ? 'white' : '#9ca3af'} />
            )}
            <Text className={`font-semibold text-base ${done || canSubmit ? 'text-white' : 'text-gray-400'}`}>
              {uploading ? 'A enviar...' : done ? 'Enviado!' : 'Enviar refeição'}
            </Text>
          </TouchableOpacity>

          {!hasContent && (
            <View className="bg-brand-50 rounded-2xl p-4 mt-4">
              <Text className="text-brand-700 text-sm font-semibold mb-1">Dica de precisão</Text>
              <Text className="text-brand-600 text-sm leading-relaxed">
                Combina foto + ingredientes detalhados para obter a estimativa mais precisa de macros e calorias.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Meal type picker modal ──────────────────────────────────────── */}
      <Modal visible={mealPickerVisible} transparent animationType="fade" onRequestClose={() => setMealPickerVisible(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setMealPickerVisible(false)} className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View className="bg-white rounded-t-3xl px-5 pt-4 pb-8">
              <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-4" />
              <Text className="font-bold text-gray-900 text-base mb-4">Tipo de refeição</Text>
              <FlatList
                data={MEAL_TYPES}
                keyExtractor={(item) => item.key}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setMealType(item.key); setMealPickerVisible(false); }}
                    className={`flex-row items-center gap-3 py-3.5 px-4 rounded-xl mb-1 ${mealType === item.key ? 'bg-brand-50' : ''}`}
                  >
                    <Text className="text-xl">{item.emoji}</Text>
                    <Text className={`text-sm font-medium ${mealType === item.key ? 'text-brand-700' : 'text-gray-800'}`}>
                      {item.label}
                    </Text>
                    {mealType === item.key && <Check size={16} color="#4f46e5" style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Ingredient add modal ──────────────────────────────────────────── */}
      <Modal visible={ingredientModal} transparent animationType="slide" onRequestClose={() => setIngredientModal(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setIngredientModal(false)} className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View className="bg-white rounded-t-3xl px-5 pt-3 pb-10">
              <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-3" />

              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-bold text-gray-900 text-base">Adicionar ingrediente</Text>
                <TouchableOpacity onPress={() => setIngredientModal(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                  <X size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {/* Scan barcode inside modal */}
              <TouchableOpacity
                onPress={openBarcodeScanner}
                className="flex-row items-center justify-center gap-2 bg-brand-50 border border-brand-200 rounded-xl py-3 mb-5"
              >
                <QrCode size={16} color="#4f46e5" />
                <Text className="text-sm font-semibold text-brand-700">Scan código de barras</Text>
              </TouchableOpacity>

              {/* Name */}
              <Text className="text-xs font-semibold text-gray-500 mb-1.5">Nome do ingrediente</Text>
              <TextInput
                value={ingName}
                onChangeText={setIngName}
                placeholder="ex: Arroz integral, Frango grelhado..."
                placeholderTextColor="#9ca3af"
                autoFocus
                returnKeyType="next"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 mb-4"
              />

              {/* Quantity + unit */}
              <Text className="text-xs font-semibold text-gray-500 mb-1.5">Quantidade</Text>
              <View className="flex-row gap-3 mb-6">
                <TextInput
                  value={ingQty}
                  onChangeText={setIngQty}
                  placeholder="ex: 150"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  returnKeyType="done"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
                />
                <View className="flex-row gap-2">
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setIngUnit(u)}
                      className={`px-4 py-3 rounded-xl border ${
                        ingUnit === u
                          ? 'bg-brand-600 border-brand-600'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <Text className={`text-sm font-bold ${ingUnit === u ? 'text-white' : 'text-gray-500'}`}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setIngredientModal(false)}
                  className="flex-1 py-3.5 rounded-xl border border-gray-200 items-center"
                >
                  <Text className="text-sm font-semibold text-gray-500">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addIngredient}
                  className="flex-1 py-3.5 rounded-xl bg-brand-600 items-center"
                  style={{ shadowColor: '#4f46e5', shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}
                >
                  <Text className="text-sm font-bold text-white">Adicionar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Barcode scanner modal ─────────────────────────────────────────── */}
      <Modal visible={barcodeVisible} animationType="slide" onRequestClose={() => { setBarcodeVisible(false); setIngredientModal(true); }}>
        <View style={styles.scannerContainer}>
          {cameraPermission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={barcodeScanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
            />
          ) : (
            <View style={styles.noCameraBox}>
              <Text style={styles.noCameraText}>Sem acesso à câmara</Text>
            </View>
          )}

          {/* Scan overlay */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanTop} />
            <View style={styles.scanMiddleRow}>
              <View style={styles.scanSide} />
              <View style={styles.scanFrame}>
                {/* Corner marks */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.scanSide} />
            </View>
            <View style={styles.scanBottom}>
              <Text style={styles.scanHint}>
                {barcodeLoading
                  ? 'A procurar produto...'
                  : 'Aponta a câmara para o código de barras'}
              </Text>
              {barcodeLoading && <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />}
            </View>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.scanClose}
            onPress={() => { setBarcodeVisible(false); setIngredientModal(true); }}
          >
            <X size={22} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles (scanner only — rest uses NativeWind) ──────────────────────────────

const styles = StyleSheet.create({
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  noCameraBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noCameraText: { color: '#fff', fontSize: 16 },

  // Dim overlay
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  scanTop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanMiddleRow: { flexDirection: 'row', height: 220 },
  scanSide:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanFrame:   { width: 260, borderRadius: 2 },
  scanBottom:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: 20 },
  scanHint:    { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Corner marks
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#fff', borderWidth: 3 },
  cornerTL: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 4 },

  // Close button
  scanClose: {
    position: 'absolute', top: 52, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
});
