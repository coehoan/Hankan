export type FridgeSummary = { id: string; name: string; role: 'owner' | 'member' };
export type FridgeDirectory = {
  fridges: FridgeSummary[];
  selectedId: string;
  timeZone: string;
  accountName: string;
};
