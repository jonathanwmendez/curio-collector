export type Profile = {
  id: string; username: string; display_name: string; bio: string; avatar_path: string | null;
  is_public: boolean; collection_public: boolean; show_values: boolean; created_at: string;
};

export type Item = {
  id: string; user_id: string; name: string; category: string; year: string; brand: string; set_name: string;
  number: string; subject: string; variant: string; condition: string; grader: string; grade: string; cert_number: string;
  sealed: boolean; quantity: number; purchase_price: number | null; purchase_date: string | null;
  status: 'owned' | 'sold'; sold_price: number | null; sold_date: string | null;
  value: number | null; value_low: number | null; value_high: number | null; value_source: string; value_note: string;
  value_updated_at: string | null; ask_median: number | null; ask_low: number | null; ask_high: number | null;
  ask_count: number | null; ask_query: string | null; ask_checked_at: string | null;
  folder: string; tags: string[]; notes: string; ai_notes: string; confidence: number | null;
  photo_front: string | null; photo_back: string | null; featured: boolean; created_at: string; updated_at: string;
};

export type Wish = {
  id: string; user_id: string; name: string; category: string; year: string; set_name: string; number: string;
  subject: string; condition: string; target_price: number | null; value: number | null; value_note: string;
  value_updated_at: string | null; ask_median: number | null; ask_count: number | null; ask_checked_at: string | null;
  photo: string | null; notes: string; created_at: string;
};

export type HistoryPoint = { item_id: string; t: string; value: number; source: string };

export type Post = {
  id: string; user_id: string; item_id: string | null; body: string; photo: string | null; created_at: string;
  like_count: number; comment_count: number;
};
