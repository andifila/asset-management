import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const weddingKeys = {
  all: (uid) => ['wedding', uid],
}

export function useWeddingData(uid) {
  return useQuery({
    queryKey: weddingKeys.all(uid),
    queryFn: async () => {
      const [itemsRes, txRes, vendorsRes, settingsRes] = await Promise.all([
        supabase.from('wedding_budget_items').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('wedding_transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('wedding_vendors').select('*').eq('user_id', uid).order('name'),
        supabase.from('wedding_settings').select('*').eq('user_id', uid).maybeSingle(),
      ])
      return {
        items: itemsRes.data || [],
        transactions: txRes.data || [],
        vendors: vendorsRes.data || [],
        settings: settingsRes.data || { total_budget: 0 },
      }
    },
    staleTime: 30_000,
  })
}

export function useInvalidateWedding(uid) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: weddingKeys.all(uid) })
}

export function useDeleteBudgetItem(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      await supabase.from('wedding_transactions').delete().eq('budget_item_id', id).eq('user_id', uid)
      return supabase.from('wedding_budget_items').delete().eq('id', id).eq('user_id', uid)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: weddingKeys.all(uid) }),
  })
}

export function useDeleteTransaction(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => supabase.from('wedding_transactions').delete().eq('id', id).eq('user_id', uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: weddingKeys.all(uid) }),
  })
}
