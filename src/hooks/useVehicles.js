import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const vehicleKeys = {
  all: (uid) => ['vehicles', uid],
}

export function useVehicles(uid) {
  return useQuery({
    queryKey: vehicleKeys.all(uid),
    queryFn: async () => {
      const [vRes, rRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('service_records').select('*').eq('user_id', uid).order('service_date', { ascending: false }),
      ])
      if (vRes.error) throw vRes.error
      if (rRes.error) throw rRes.error
      return { vehicles: vRes.data || [], records: rRes.data || [] }
    },
    staleTime: 30_000,
  })
}

export function useDeleteServiceRecord(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => supabase.from('service_records').delete().eq('id', id).eq('user_id', uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all(uid) }),
  })
}

export function useDeleteVehicle(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      await supabase.from('service_records').delete().eq('vehicle_id', id).eq('user_id', uid)
      return supabase.from('vehicles').delete().eq('id', id).eq('user_id', uid)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all(uid) }),
  })
}

export function useUpdateVehicleKm(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, km }) => supabase.from('vehicles').update({ km_current: km }).eq('id', id).eq('user_id', uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all(uid) }),
  })
}

export function useSaveVehicle(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicle, form }) => vehicle
      ? supabase.from('vehicles').update(form).eq('id', vehicle.id).eq('user_id', uid)
      : supabase.from('vehicles').insert({ ...form, user_id: uid }).select().single(),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all(uid) }),
  })
}

export function useSaveServiceRecord(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ record, payload }) => record
      ? supabase.from('service_records').update(payload).eq('id', record.id).eq('user_id', uid)
      : supabase.from('service_records').insert({ ...payload, user_id: uid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all(uid) }),
  })
}
