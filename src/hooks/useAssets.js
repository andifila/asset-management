import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const assetKeys = {
  all: (uid) => ['assets', uid],
  tabs: (uid) => ['tabs', uid],
}

export function useAssets(uid) {
  return useQuery({
    queryKey: assetKeys.all(uid),
    queryFn: async () => {
      const [bibit, binance, fisik, kas, jht, goal] = await Promise.all([
        supabase.from('bibit_assets').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('binance_assets').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('physical_assets').select('*').eq('user_id', uid).order('buy_date', { ascending: false }),
        supabase.from('liquid_assets').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('jht_assets').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('financial_goals').select('*').eq('user_id', uid).maybeSingle(),
      ])
      return {
        bibit:   bibit.data   || [],
        binance: binance.data || [],
        fisik:   fisik.data   || [],
        kas:     kas.data     || [],
        jht:     jht.data?.jumlah || 0,
        target:  goal.data?.target_amount || 200000000,
      }
    },
    staleTime: 30_000,
  })
}

export function useAssetTabs(uid) {
  return useQuery({
    queryKey: assetKeys.tabs(uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tab_configs').select('*').eq('user_id', uid).order('position')
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60_000,
  })
}

export function useInvalidateAssets(uid) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: assetKeys.all(uid) })
}
