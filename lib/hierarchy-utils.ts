import User from '@/models/User';
import mongoose from 'mongoose';

/**
 * Returns an array of User IDs that belong to the reporting subtree of a manager.
 * Includes direct and indirect reports.
 * 
 * @param managerId The ID of the manager at the top of the subtree
 * @returns Array of User IDs (as strings)
 */
export async function getHierarchySubtree(managerId: string): Promise<string[]> {
  if (!mongoose.Types.ObjectId.isValid(managerId)) return [];

  const subtreeIds: string[] = [];
  const queue: string[] = [managerId];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    // Find direct reports
    const reports = await User.find({ managerId: currentId }).select('_id').lean();
    const reportIds = reports.map((r: any) => r._id.toString());
    
    subtreeIds.push(...reportIds);
    queue.push(...reportIds);
  }

  return Array.from(new Set(subtreeIds));
}

/**
 * Returns true if the targetUser is within the manager's reporting subtree.
 */
export async function isInReportingSubtree(managerId: string, targetUserId: string): Promise<boolean> {
  const subtree = await getHierarchySubtree(managerId);
  return subtree.includes(targetUserId);
}
