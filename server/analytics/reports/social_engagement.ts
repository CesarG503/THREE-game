import { analyticsPrisma } from "../../db/analyticsPrisma.js";

export interface SocialEngagementReport {
  friendRequests: {
    sent: number;
    accepted: number;
    acceptanceRate: number;
  };
  gameInvites: {
    sent: number;
    accepted: number;
    conversionRate: number;
  };
  activeUsersCount: number;
}

/**
 * Calculates social engagement metrics including friend request acceptance rates,
 * game invite CTR, and unique active social users over a date range.
 */
export async function getSocialEngagement(options: { startDate?: Date; endDate?: Date } = {}): Promise<SocialEngagementReport> {
  const { startDate, endDate } = options;

  const params: any[] = [];
  let paramIndex = 1;
  let dateFilters = "";

  if (startDate) {
    dateFilters += ` AND timestamp >= $${paramIndex++}`;
    params.push(startDate);
  }
  if (endDate) {
    dateFilters += ` AND timestamp <= $${paramIndex++}`;
    params.push(endDate);
  }

  // 1. Friend Requests sent & accepted
  const requestsSql = `
    SELECT 
      COUNT(CASE WHEN "eventType" = 'FriendRequestSent' THEN 1 END)::integer as sent,
      COUNT(CASE WHEN "eventType" = 'FriendRequestAccepted' THEN 1 END)::integer as accepted
    FROM analytics."RawEvent"
    WHERE "eventType" IN ('FriendRequestSent', 'FriendRequestAccepted')
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
  `;
  const [requestsRow] = await analyticsPrisma.$queryRawUnsafe<{ sent: number; accepted: number }[]>(requestsSql, ...params);
  const reqSent = requestsRow?.sent ?? 0;
  const reqAccepted = requestsRow?.accepted ?? 0;
  const acceptanceRate = reqSent > 0 ? Math.round((reqAccepted / reqSent) * 10000) / 100 : 0;

  // 2. Game Invites sent & accepted
  const invitesSql = `
    SELECT 
      COUNT(CASE WHEN "eventType" = 'GameInviteSent' THEN 1 END)::integer as sent,
      COUNT(CASE WHEN "eventType" = 'GameInviteAccepted' THEN 1 END)::integer as accepted
    FROM analytics."RawEvent"
    WHERE "eventType" IN ('GameInviteSent', 'GameInviteAccepted')
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
  `;
  const [invitesRow] = await analyticsPrisma.$queryRawUnsafe<{ sent: number; accepted: number }[]>(invitesSql, ...params);
  const invSent = invitesRow?.sent ?? 0;
  const invAccepted = invitesRow?.accepted ?? 0;
  const conversionRate = invSent > 0 ? Math.round((invAccepted / invSent) * 10000) / 100 : 0;

  // 3. Unique active social users
  const activeUsersSql = `
    SELECT 
      COUNT(DISTINCT "userId")::integer as count
    FROM analytics."RawEvent"
    WHERE "eventType" IN ('FriendRequestSent', 'FriendRequestAccepted', 'GameInviteSent', 'GameInviteAccepted')
      AND "userId" IS NOT NULL
      AND NOT (payload->'metadata'->>'isSuspicious')::boolean IS TRUE
      ${dateFilters}
  `;
  const [activeUsersRow] = await analyticsPrisma.$queryRawUnsafe<{ count: number }[]>(activeUsersSql, ...params);
  const activeUsersCount = activeUsersRow?.count ?? 0;

  return {
    friendRequests: {
      sent: reqSent,
      accepted: reqAccepted,
      acceptanceRate
    },
    gameInvites: {
      sent: invSent,
      accepted: invAccepted,
      conversionRate
    },
    activeUsersCount
  };
}
