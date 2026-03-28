export type UserRole = 'nutritionist' | 'client';

export type MealType =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'supper'
  | 'snack'; // kept for backward-compatibility

export type FeedbackStatus = 'pending_ai' | 'draft' | 'sent';

export type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

export type OrgRole = 'owner' | 'admin' | 'member';
export type IndividualPlan = 'free' | 'monthly' | 'annual';
export type BillingInterval = 'monthly' | 'annual';
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'past_due';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  billing_interval: BillingInterval;
  subscription_status: SubscriptionStatus;
  max_members: number;
  trial_ends_at: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  role: OrgRole;
  invited_email: string;
  joined_at: string | null;
  created_at: string;
  // enriched
  full_name?: string | null;
  client_count?: number;
  avg_adherence?: number | null;
}

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
  allergies?: string;
  intolerances?: string;
  dietary_preferences?: string;
  lifestyle_notes?: string;
  nutritionist_id?: string;
  organization_id?: string;
  individual_plan?: IndividualPlan;
  created_at: string;
  updated_at: string;
}

export interface NutritionistNote {
  id: string;
  nutritionist_id: string;
  client_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  meals_today: number;
  pending_feedback: number;
  avg_adherence: number | null;
}

export interface Meal {
  id: string;
  client_id: string;
  photo_url: string;
  meal_type: MealType;
  eaten_at: string;
  client_notes: string | null;
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
