export type UserRole = 'nutritionist' | 'client';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FeedbackStatus = 'pending_ai' | 'draft' | 'sent';

export type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

export interface UserProfile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string;
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  body_fat_pct?: number;
  goal?: Goal;
  nutritionist_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Meal {
  id: string;
  client_id: string;
  photo_url: string;
  meal_type: MealType;
  eaten_at: string;
  ai_analysis: MealAnalysis | null;
  ai_feedback_draft: string | null;
  nutritionist_feedback: string | null;
  feedback_status: FeedbackStatus;
  created_at: string;
}

export interface MealAnalysis {
  foods: FoodItem[];
  macros: Macros;
  score: number; // 1-10 adherence to goal
  summary: string;
}

export interface FoodItem {
  name: string;
  portion_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface DailyTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Invite {
  id: string;
  code: string;
  nutritionist_id: string;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}
