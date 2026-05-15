import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

/**
 * ACL policy stored as object custom metadata.
 * - owner: the userId that uploaded the object (always has full access)
 * - visibility: "public" allows unauthenticated READ; "private" requires owner match
 */
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  return JSON.parse(raw as string) as ObjectAclPolicy;
}

/**
 * Returns true if the requesting user may perform the requested operation.
 * Rules (in order):
 *   1. No ACL policy set → allow any authenticated user (objectPath is UUID-based,
 *      not guessable; caller is responsible for requiring auth at the route level).
 *   2. Public policy → allow unauthenticated READ.
 *   3. Owner match → allow any permission.
 *   4. All other private access → deny.
 */
export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);

  // No ACL set: allow any caller (authenticated or not).
  // Object paths are UUID-based and not guessable, so possession of the path
  // is the only access control. This is required for React Native <Image> to
  // render portfolio/cover images without bearer token support.
  if (!aclPolicy) {
    return true;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) return false;

  return aclPolicy.owner === userId;
}
