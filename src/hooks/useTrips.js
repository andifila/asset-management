import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const tripKeys = {
  all: (uid) => ['trips', uid],
}

const SEED_TRIPS = [
  {
    destination: 'Bali',
    start_date: '2025-05-03', end_date: '2025-05-06',
    people_count: 2, est_budget_per_person: 3200000, status: 'upcoming',
    itinerary: [
      { date: '2025-05-03', time_start: '08:00', time_end: '10:00', activity: 'Tiba Ngurah Rai', location: 'Bandara Ngurah Rai', category: 'transport', price_per_person: 500000, note: 'Pesawat pagi', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-03', time_start: '12:00', time_end: '', activity: 'Check-in Hotel', location: 'Seminyak', category: 'akomodasi', price_per_person: 450000, note: '', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-04', time_start: '09:00', time_end: '11:00', activity: 'Tegallalang Rice', location: 'Ubud', category: 'aktivitas', price_per_person: 50000, note: '', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-04', time_start: '13:00', time_end: '15:00', activity: 'Tirta Empul', location: 'Ubud', category: 'tiket', price_per_person: 50000, note: '', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-05', time_start: '07:00', time_end: '18:00', activity: 'Kelingking Beach', location: 'Nusa Penida', category: 'aktivitas', price_per_person: 300000, note: 'Speed boat', status: 'upcoming', attachment_url: '' },
    ],
    notes: null,
  },
  {
    destination: 'Bromo', start_date: '2024-12-14', end_date: '2024-12-15',
    people_count: 3, est_budget_per_person: 0, status: 'done', itinerary: null, notes: null,
  },
  {
    destination: 'Yogyakarta', start_date: '2024-08-20', end_date: '2024-08-23',
    people_count: 1, est_budget_per_person: 0, status: 'done', itinerary: null, notes: null,
  },
  {
    destination: 'Lombok', start_date: '2024-03-10', end_date: '2024-03-14',
    people_count: 4, est_budget_per_person: 0, status: 'done', itinerary: null, notes: null,
  },
]

export function useTrips(uid) {
  return useQuery({
    queryKey: tripKeys.all(uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips').select('*').eq('user_id', uid).order('start_date', { ascending: false })
      if (error) throw error
      if (!data.length) {
        const { data: seeded } = await supabase
          .from('trips').insert(SEED_TRIPS.map(t => ({ ...t, user_id: uid }))).select()
        return seeded || []
      }
      return data || []
    },
    staleTime: 30_000,
  })
}

export function useDeleteTrip(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => supabase.from('trips').delete().eq('id', id).eq('user_id', uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all(uid) }),
  })
}

export function useUpdateTripStatus(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => supabase.from('trips').update({ status }).eq('id', id).eq('user_id', uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all(uid) }),
  })
}

export function useSaveTrip(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trip, payload }) => trip
      ? supabase.from('trips').update(payload).eq('id', trip.id).eq('user_id', uid)
      : supabase.from('trips').insert({ ...payload, user_id: uid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all(uid) }),
  })
}
