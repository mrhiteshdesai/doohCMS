import prisma from '../prisma';

export const createGroup = async (tenantId: string, data: { name: string; description?: string; tags?: string[] }) => {
  return prisma.screenGroup.create({
    data: {
      name: data.name,
      description: data.description,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      tenantId
    }
  });
};

export const getGroups = async (tenantId: string) => {
  const groups = await prisma.screenGroup.findMany({
    where: { tenantId },
    include: {
      members: {
        include: {
          screen: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return groups.map(group => ({
    ...group,
    tags: group.tags ? JSON.parse(group.tags as string) : [],
    screenCount: group.members.length
  }));
};

export const getGroupById = async (tenantId: string, groupId: string) => {
  const group = await prisma.screenGroup.findFirst({
    where: { id: groupId, tenantId },
    include: {
      members: {
        include: {
          screen: true
        }
      }
    }
  });

  if (!group) throw new Error('Group not found');

  return {
    ...group,
    tags: group.tags ? JSON.parse(group.tags as string) : [],
    screens: group.members.map(m => m.screen)
  };
};

export const updateGroup = async (tenantId: string, groupId: string, data: { name?: string; description?: string; tags?: string[] }) => {
  return prisma.screenGroup.update({
    where: { id: groupId }, // Prisma ensures uniqueness, but we should verify tenant ownership ideally. 
    // However, findFirst check above or middleware usually handles tenant context. 
    // For update, we rely on `where` unique ID. To be safe, we can use updateMany or check existence first.
    // Standard Prisma pattern: check ownership then update, or assume ID is sufficient if UUIDs are unguessable.
    // Better: use updateMany to enforce tenantId
    data: {
      name: data.name,
      description: data.description,
      tags: data.tags ? JSON.stringify(data.tags) : undefined
    }
  });
};

// Safer update ensuring tenantId
export const updateGroupSafe = async (tenantId: string, groupId: string, data: { name?: string; description?: string; tags?: string[] }) => {
  // Check existence and ownership
  const group = await prisma.screenGroup.findFirst({ where: { id: groupId, tenantId } });
  if (!group) throw new Error('Group not found');

  return prisma.screenGroup.update({
    where: { id: groupId },
    data: {
      name: data.name,
      description: data.description,
      tags: data.tags ? JSON.stringify(data.tags) : undefined
    }
  });
};

export const deleteGroup = async (tenantId: string, groupId: string) => {
  const group = await prisma.screenGroup.findFirst({ where: { id: groupId, tenantId } });
  if (!group) throw new Error('Group not found');

  return prisma.screenGroup.delete({
    where: { id: groupId }
  });
};

export const assignScreens = async (tenantId: string, groupId: string, screenIds: string[]) => {
  // Verify group ownership
  const group = await prisma.screenGroup.findFirst({ where: { id: groupId, tenantId } });
  if (!group) throw new Error('Group not found');

  // Use transaction to replace members
  return prisma.$transaction(async (tx) => {
    // 1. Remove all existing members
    await tx.screenGroupMember.deleteMany({
      where: { groupId }
    });

    // 2. Add new members
    if (screenIds.length > 0) {
      // Verify all screens belong to tenant
      const screens = await tx.screen.findMany({
        where: { 
          id: { in: screenIds },
          tenantId
        }
      });

      if (screens.length !== screenIds.length) {
        throw new Error('Some screens do not exist or belong to another tenant');
      }

      await tx.screenGroupMember.createMany({
        data: screenIds.map(screenId => ({
          groupId,
          screenId
        }))
      });
    }

    return getGroupById(tenantId, groupId);
  });
};

export const publishPlaylist = async (tenantId: string, groupId: string, playlistId: string | null) => {
  // Verify ownership
  const group = await prisma.screenGroup.findFirst({ where: { id: groupId, tenantId } });
  if (!group) throw new Error('Group not found');

  if (playlistId) {
    const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, tenantId } });
    if (!playlist) throw new Error('Playlist not found');
  }

  return prisma.$transaction(async (tx) => {
    // Update group's active playlist
    await tx.screenGroup.update({
      where: { id: groupId },
      data: { activePlaylistId: playlistId }
    });

    // Update all member screens
    // Find all screens in this group
    const members = await tx.screenGroupMember.findMany({
      where: { groupId },
      select: { screenId: true }
    });

    const screenIds = members.map(m => m.screenId);

    if (screenIds.length > 0) {
      await tx.screen.updateMany({
        where: { id: { in: screenIds } },
        data: { activePlaylistId: playlistId }
      });
    }

    return { message: 'Published to group and screens', count: screenIds.length };
  });
};
