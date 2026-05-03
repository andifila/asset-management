import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const homeKeys = {
  stats: (uid) => ['home-stats', uid],
}

export function useHomeStats(uid) {
  return useQuery({
    queryKey: homeKeys.stats(uid),
    queryFn: async () => {
      const now = new Date()
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
      const sum = (rows, key) => (rows || []).reduce((s, r) => s + Number(r[key] || 0), 0)

      const [bibit, binance, fisik, kas, jht, svc, trip, hike, wpTx, wpSet, svcMonth, wpMonth] = await Promise.all([
        supabase.from('bibit_assets').select('aktual').eq('user_id', uid),
        supabase.from('binance_assets').select('aktual').eq('user_id', uid),
        supabase.from('physical_assets').select('buy_price').eq('user_id', uid),
        supabase.from('liquid_assets').select('jumlah').eq('user_id', uid),
        supabase.from('jht_assets').select('jumlah').eq('user_id', uid).maybeSingle(),
        supabase.from('service_records').select('service_date,service_type').eq('user_id', uid).order('service_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('trips').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'done'),
        supabase.from('hikes').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('wedding_transactions').select('amount').eq('user_id', uid),
        supabase.from('wedding_settings').select('total_budget').eq('user_id', uid).maybeSingle(),
        supabase.from('service_records').select('service_type').eq('user_id', uid).gte('service_date', startOfMonth),
        supabase.from('wedding_transactions').select('amount').eq('user_id', uid).gte('date', startOfMonth),
      ])

      const svcCostMonth = (svcMonth.data || []).reduce((s, r) => {
        try { const p = JSON.parse(r.service_type); if (Array.isArray(p)) return s + p.reduce((ss, i) => ss + Number(i.biaya || 0), 0) } catch {}
        return s
      }, 0)

      return {
        assetTotal:   sum(bibit.data,'aktual') + sum(binance.data,'aktual') + sum(fisik.data,'buy_price') + sum(kas.data,'jumlah') + Number(jht.data?.jumlah||0),
        lastService:  svc.data || null,
        tripCount:    trip.count ?? 0,
        hikeCount:    hike.count ?? 0,
        wpSpent:      sum(wpTx.data, 'amount'),
        wpBudget:     wpSet.data?.total_budget || 0,
        monthlySpend: svcCostMonth + sum(wpMonth.data, 'amount'),
      }
    },
    staleTime: 2 * 60_000,
  })
}
