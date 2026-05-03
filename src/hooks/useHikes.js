import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const hikeKeys = {
  all: (uid) => ['hikes', uid],
}

const SEED_HIKES = [
  { mountain: 'Semeru',       elevation: 3676, city: 'Lumajang',    start_date: '2023-10-12', end_date: '2023-10-15', status: 'summit', notes: null },
  { mountain: 'Arjuno',       elevation: 3339, city: 'Pasuruan',    start_date: '2023-06-03', end_date: '2023-06-05', status: 'summit', notes: 'Traverse sekaligus Welirang' },
  { mountain: 'Welirang',     elevation: 3156, city: 'Pasuruan',    start_date: '2023-06-03', end_date: '2023-06-05', status: 'summit', notes: 'Satu trip traverse bersama Arjuno' },
  { mountain: 'Lawu',         elevation: 3265, city: 'Karanganyar', start_date: '2023-01-14', end_date: '2023-01-15', status: 'summit', notes: null },
  { mountain: 'Bromo',        elevation: 2329, city: 'Probolinggo', start_date: '2024-12-14', end_date: '2024-12-15', status: 'kawah',  notes: null },
  { mountain: 'Penanggungan', elevation: 1653, city: 'Mojokerto',   start_date: '2022-04-17', end_date: '2022-04-17', status: 'summit', notes: null },
]

export function useHikes(uid) {
  return useQuery({
    queryKey: hikeKeys.all(uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hikes').select('*').eq('user_id', uid).order('start_date', { ascending: false })
      if (error) throw error
      if (!data.length) {
        const { data: seeded } = await supabase
          .from('hikes').insert(SEED_HIKES.map(h => ({ ...h, user_id: uid }))).select()
        return seeded || []
      }
      return data || []
    },
    staleTime: 30_000,
  })
}

export function useDeleteHike(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => supabase.from('hikes').delete().eq('id', id).eq('user_id', uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: hikeKeys.all(uid) }),
  })
}

export function useSaveHike(uid) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hike, payload }) => hike
      ? supabase.from('hikes').update(payload).eq('id', hike.id).eq('user_id', uid)
      : supabase.from('hikes').insert({ ...payload, user_id: uid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hikeKeys.all(uid) }),
  })
}
