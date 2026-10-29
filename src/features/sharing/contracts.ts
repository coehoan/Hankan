export type InviteState = 'valid' | 'expired' | 'revoked' | 'used' | 'already_member';
export type InviteInfo = {
  fridgeId: string;
  fridgeName: string;
  role: 'member';
  state: InviteState;
};
export type CreatedInvite = { inviteId: string; token: string; expiresAt: string };
export type InviteSummary = {
  id: string;
  expiresAt: string;
  state: 'valid' | 'expired' | 'revoked' | 'used';
};
export type FridgeMember = { userId: string; displayName: string; role: 'owner' | 'member' };
