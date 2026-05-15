import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import jwt from "jsonwebtoken";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, setObjectAclPolicy } from "../lib/objectAcl";
import { requireAccessToken } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned PUT URL for direct file upload. Requires authentication.
 * ACL is NOT set here — the object doesn't exist yet. Callers must call
 * POST /storage/objects/set-acl after uploading to make the object accessible.
 */
router.post(
  "/storage/uploads/request-url",
  requireAccessToken,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * POST /storage/objects/set-acl
 *
 * Set ACL policy metadata on an uploaded object. Must be called after uploading
 * to make an object accessible via GET /storage/objects/*.
 * Requires authentication — the caller becomes the ACL owner.
 */
router.post(
  "/storage/objects/set-acl",
  requireAccessToken,
  async (req: Request, res: Response) => {
    const { objectPath, visibility } = req.body as {
      objectPath?: string;
      visibility?: string;
    };

    if (!objectPath || !["public", "private"].includes(visibility ?? "")) {
      res.status(400).json({ error: "objectPath and visibility (public|private) are required" });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await setObjectAclPolicy(objectFile, {
        owner: String(req.user!.userId),
        visibility: visibility as "public" | "private",
      });
      res.json({ ok: true, objectPath, visibility });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error setting ACL policy");
      res.status(500).json({ error: "Failed to set ACL policy" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS. No authentication needed.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 *
 * Auth is OPTIONAL:
 * - Objects with ACL visibility:"public" are served without authentication,
 *   allowing React Native <Image> to render portfolio/cover images directly.
 * - Objects with ACL visibility:"private" require a valid bearer token and
 *   ownership match.
 * - Objects with no ACL policy are DENIED (secure default).
 */
router.get(
  "/storage/objects/*path",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

      // Extract userId from bearer token if present (not required for public objects)
      let userId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7);
          const secret = process.env.SESSION_SECRET ?? "secret";
          const decoded = jwt.verify(token, secret) as { userId?: string | number };
          userId = decoded.userId !== undefined ? String(decoded.userId) : undefined;
        } catch {
          // Invalid token — treat as unauthenticated; ACL check will handle access
        }
      }

      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        res.status(403).json({ error: "Forbidden", message: "Access denied" });
        return;
      }

      const response = await objectStorageService.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
