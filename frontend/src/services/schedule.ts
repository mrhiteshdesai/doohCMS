import api from './api';

export type Recurrence = 'NONE' | 'ONE_TIME' | 'DAILY' | 'WEEKDAY' | 'WEEKEND' | 'SPECIFIC_DAYS';

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  playlistId: string;
  screenId?: string;
  groupId?: string;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime?: string;
  recurrence: Recurrence;
  daysOfWeek?: number[];
  timezone?: string;
  playlist?: any;
  screen?: any;
  group?: any;
  createdAt: string;
}

export const getSchedules = async (params?: { search?: string; targetType?: 'SCREEN' | 'GROUP'; recurrence?: Recurrence }) => {
  const res = await api.get<Schedule[]>('/schedules', { params });
  return res.data;
};

export const createSchedule = async (data: Partial<Schedule>) => {
  const res = await api.post<Schedule>('/schedules', data);
  return res.data;
};

export const updateSchedule = async (id: string, data: Partial<Schedule>) => {
  const res = await api.put<Schedule>(`/schedules/${id}`, data);
  return res.data;
};

export const deleteSchedule = async (id: string) => {
  const res = await api.delete(`/schedules/${id}`);
  return res.data;
};
