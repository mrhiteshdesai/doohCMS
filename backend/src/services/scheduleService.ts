import { Prisma } from '@prisma/client';
import prisma from '../prisma';

// use shared prisma client

export const createSchedule = async (tenantId: string, data: any) => {
  const {
    name,
    description,
    playlistId,
    screenId,
    groupId,
    startDate,
    endDate,
    startTime,
    endTime,
    recurrence,
    daysOfWeek,
    timezone
  } = data;

  if (!playlistId) throw new Error('playlistId is required');
  if (!screenId && !groupId) throw new Error('Either screenId or groupId is required');
  if (screenId && groupId) throw new Error('Provide only one of screenId or groupId');
  if (!startDate) throw new Error('startDate is required');
  if (!startTime) throw new Error('startTime is required');

  const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, tenantId } });
  if (!playlist) throw new Error('Playlist not found');

  if (screenId) {
    const screen = await prisma.screen.findFirst({ where: { id: screenId, tenantId } });
    if (!screen) throw new Error('Screen not found');
  }
  if (groupId) {
    const group = await prisma.screenGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new Error('Group not found');
  }

  const created = await prisma.schedule.create({
    data: {
      name,
      // description: description ?? undefined,
      tenantId,
      playlistId,
      screenId,
      groupId,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      startTime,
      endTime,
      recurrence: (recurrence as any) || 'NONE',
      daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : undefined,
      timezone,
    },
    include: {
      playlist: true,
      screen: true,
      group: true,
    }
  });
  return {
    ...created,
    daysOfWeek: created.daysOfWeek ? JSON.parse(created.daysOfWeek as any) : undefined,
  };
};

export const getSchedules = async (
  tenantId: string,
  params: { search?: string; targetType?: 'SCREEN' | 'GROUP'; recurrence?: any } = {}
) => {
  const where: any = { tenantId };
  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { description: { contains: params.search } },
    ];
  }
  if (params.targetType === 'SCREEN') {
    where.screenId = { not: null };
  } else if (params.targetType === 'GROUP') {
    where.groupId = { not: null };
  }
  if (params.recurrence) {
    where.recurrence = params.recurrence;
  }

  const rows = await prisma.schedule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      playlist: true,
      screen: true,
      group: true,
    }
  });
  return rows.map((s: any) => ({
    ...s,
    daysOfWeek: s.daysOfWeek ? JSON.parse(s.daysOfWeek as any) : undefined,
  }));
};

export const deleteSchedule = async (id: string, tenantId: string) => {
  const sched = await prisma.schedule.findUnique({ where: { id } });
  if (!sched || sched.tenantId !== tenantId) {
    throw new Error('Schedule not found or unauthorized');
  }
  return prisma.schedule.delete({ where: { id } });
};

export const updateSchedule = async (id: string, tenantId: string, data: any) => {
  const sched = await prisma.schedule.findUnique({ where: { id } });
  if (!sched || sched.tenantId !== tenantId) {
    throw new Error('Schedule not found or unauthorized');
  }

  const payload: any = {};
  [
    'name', 'description', 'playlistId', 'screenId', 'groupId',
    'startDate', 'endDate', 'startTime', 'endTime', 'recurrence', 'daysOfWeek', 'timezone'
  ].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });

  if (payload.startDate) payload.startDate = new Date(payload.startDate);
  if (payload.endDate) payload.endDate = new Date(payload.endDate);
  if (payload.daysOfWeek) payload.daysOfWeek = JSON.stringify(payload.daysOfWeek);

  const updated = await prisma.schedule.update({
    where: { id },
    data: payload,
    include: {
      playlist: true,
      screen: true,
      group: true,
    }
  });
  return {
    ...updated,
    daysOfWeek: updated.daysOfWeek ? JSON.parse(updated.daysOfWeek as any) : undefined,
  };
};
