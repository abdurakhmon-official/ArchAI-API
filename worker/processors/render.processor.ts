import { readFileSync } from 'node:fs';
import type { Job } from 'bullmq';
import { EXPORT_KIND } from '../../generated/prisma';
import { buildHouse, pickStairs } from '@/geometry/layout';
import { buildMesh } from '@/geometry/mesh';
import type { HouseMesh, Rect, TreeNode } from '@/geometry/types';
import prisma from '@/modules/db';
import {
  floorSpecFor,
  paletteFrom,
  type Palette,
  type StyleAppearance,
} from '@/shared/palette';
import { buildKey, putObject } from '@/modules/storage';
import type { RenderJob } from '@/modules/queue';
import { toRule } from '@/utils/room-rule';
import { toConfig } from '@/utils/style-config';
import { withPage } from '@/worker/lib/browser';

const RETENTION_DAYS = 30;
const VIEWPORT = { width: 1600, height: 1000 };
const RENDER_TIMEOUT_MS = 45_000;

const CAMERAS = {
  exterior: { inside: false, azimuth: Math.PI / 4, elevation: 0.55, distanceFactor: 1.5, fov: 42 },
  cutaway: { inside: false, azimuth: Math.PI / 4, elevation: 0.55, distanceFactor: 1.5, fov: 42 },
  interior: { inside: true, azimuth: Math.PI / 4, elevation: 0, distanceFactor: 0.22, fov: 62 },
} as const;

type CameraSpec = (typeof CAMERAS)[keyof typeof CAMERAS];

export async function processRender(job: Job<RenderJob>): Promise<{ key: string; cached: boolean }> {
  const { projectId, geometryHash, view } = job.data;
  const hash = `${geometryHash}:${view}`;

  const existing = await prisma.projectExport.findUnique({
    where: {
      project_id_kind_geometry_hash_watermark: {
        project_id: projectId,
        kind: EXPORT_KIND.RENDER,
        geometry_hash: hash,
        watermark: false,
      },
    },
  });

  if (existing && (!existing.expires_at || existing.expires_at > new Date())) {
    return { key: existing.storage_key, cached: true };
  }

  await job.updateProgress(15);

  const { mesh, palette, rooms, appearance } = await buildMeshFor(projectId, view);
  await job.updateProgress(40);

  const png = await renderMesh(mesh, palette, rooms, appearance, view);
  await job.updateProgress(85);

  const key = buildKey('render', `${view}.png`, geometryHash);
  await putObject(key, png, 'image/png');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

  await prisma.projectExport.upsert({
    where: {
      project_id_kind_geometry_hash_watermark: {
        project_id: projectId,
        kind: EXPORT_KIND.RENDER,
        geometry_hash: hash,
        watermark: false,
      },
    },
    update: { storage_key: key, size_bytes: png.byteLength, expires_at: expiresAt },
    create: {
      project_id: projectId,
      kind: EXPORT_KIND.RENDER,
      storage_key: key,
      geometry_hash: hash,
      watermark: false,
      size_bytes: png.byteLength,
      expires_at: expiresAt,
    },
  });

  await job.updateProgress(100);
  return { key, cached: false };
}

async function buildMeshFor(
  projectId: string,
  view: RenderJob['view'],
): Promise<{
  mesh: HouseMesh;
  palette: Palette;
  rooms: Record<string, string>;
  appearance: StyleAppearance | null;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { style: { include: { roof_style: true } } },
  });

  if (!project || project.deleted_at) throw new Error(`project not found: ${projectId}`);

  const roomTypes = await prisma.roomType.findMany();
  const rules = Object.fromEntries(roomTypes.map((row) => [row.code, toRule(row)]));

  const geometry = project.geometry as unknown as {
    bounds: Rect;
    floors: Array<{ level: number; tree: TreeNode }>;
    extras?: Array<{ kind: string; count?: number }>;
  };

  const style = project.style ? toConfig(project.style) : null;
  const trees = [...geometry.floors]
    .sort((first, second) => first.level - second.level)
    .map((floor) => floor.tree);

  const stairs = trees.length > 1 ? pickStairs(trees[0], geometry.bounds) : undefined;

  const { house } = buildHouse(
    {
      bounds: geometry.bounds,
      floors: trees.map((tree, index) => ({ level: index + 1, tree, stairs })),
      roof: style?.roof,
      extras: geometry.extras as never,
    },
    { rules, layout: style?.layout },
  );

  const appearance = appearanceOf(project.style);
  const palette = paletteFrom(appearance);

  const rooms = Object.fromEntries(
    house.floors.flatMap((level) => level.rooms.map((room) => [room.id, room.roomType])),
  );

  return {
    mesh: buildMesh(house, { includeRoof: view === 'exterior' }),
    palette,
    rooms,
    appearance,
  };
}

function appearanceOf(style: StyleRow | null): StyleAppearance | null {
  if (!style) return null;

  const roof = (style.roof ?? {}) as { color?: string };

  return {
    facade: (style.facade ?? {}) as StyleAppearance['facade'],
    interior: (style.interior ?? {}) as StyleAppearance['interior'],
    window: (style.window ?? {}) as StyleAppearance['window'],
    roofColor: style.roof_style?.color ?? roof.color ?? null,
  };
}

interface StyleRow {
  roof: unknown;
  facade: unknown;
  window: unknown;
  interior: unknown;
  roof_style?: { color: string | null } | null;
}

async function renderMesh(
  mesh: HouseMesh,
  palette: Palette,
  rooms: Record<string, string>,
  appearance: StyleAppearance | null,
  view: RenderJob['view'],
): Promise<Buffer> {

  const threeSource = readFileSync(require.resolve('three'), 'utf8');

  return withPage(async (page) => {
    await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
    await page.setContent(PAGE_HTML, { waitUntil: 'load' });

    await page.addScriptTag({
      content: `(function(){const module={exports:{}};const exports=module.exports;
${threeSource}
window.THREE=module.exports;})();`,
      id: 'three',
    });

    const floorSpecs = Object.fromEntries(
      Object.entries(rooms).map(([roomId, roomType]) => [
        roomId,
        floorSpecFor(appearance, roomType, palette),
      ]),
    );

    const ok = await page.evaluate(
      async (payload: {
        mesh: HouseMesh;
        camera: CameraSpec;
        palette: Palette;
        floorSpecs: Record<string, unknown>;
      }) =>
        (globalThis as unknown as { renderHouse: (p: unknown) => Promise<boolean> }).renderHouse(
          payload,
        ),
      { mesh, camera: CAMERAS[view], palette, floorSpecs },
    );

    if (!ok) throw new Error('WebGL sahnasi qurilmadi');

    const canvas = await page.waitForSelector('canvas', { timeout: RENDER_TIMEOUT_MS });
    if (!canvas) throw new Error('canvas not found');

    return Buffer.from(await canvas.screenshot({ type: 'png', omitBackground: false }));
  });
}

const PAGE_HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin:0; padding:0; background:#EFEFF3; overflow:hidden; }
  canvas { display:block; }
</style>
</head>
<body>
<script>
window.renderHouse = async ({ mesh, camera: cameraSpec, palette, floorSpecs }) => {
  try {
    const THREE = window.THREE;
    if (!THREE) throw new Error('three.js yuklanmadi');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xEFEFF3);

    const group = new THREE.Group();

    for (const part of mesh.parts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(part.positions), 3),
      );
      geometry.setIndex(part.indices);
      geometry.computeVertexNormals();

      // Pol xonaga qarab, qolgani materialga qarab.
      const spec =
        (part.material === 'floor' ? floorSpecs[part.roomId] : null) ??
        palette[part.material] ??
        { color: '#cccccc', roughness: 0.9 };

      const material = new THREE.MeshStandardMaterial({
        ...spec,
        transparent: spec.opacity !== undefined,
        side: THREE.DoubleSide,
      });

      group.add(new THREE.Mesh(geometry, material));
    }

    // Uyni koordinata boshiga markazlashtiramiz — kamera hisobini soddalashtiradi.
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    group.position.sub(center);
    scene.add(group);

    const radius = Math.max(size.x, size.z) * (cameraSpec.inside ? 1 : cameraSpec.distanceFactor);
    const camera = new THREE.PerspectiveCamera(
      cameraSpec.fov,
      innerWidth / innerHeight,
      0.1,
      radius * 12,
    );

    if (cameraSpec.inside) {
      /*
        Ichkarida. Guruh markazlashtirilgani uchun pol -size.y / 2 da
        turadi; ko'z shundan 1.6 m yuqorida. Aynan markazda turilsa
        kamera ko'pincha ichki devor ichida qolib qora rasm berardi —
        shuning uchun chetga suriladi.
      */
      const eye = size.y * -0.5 + 1.6;
      camera.position.set(size.x * cameraSpec.distanceFactor, eye, size.z * cameraSpec.distanceFactor);
      camera.lookAt(0, eye, 0);
    } else {
      camera.position.set(
        Math.cos(cameraSpec.azimuth) * radius,
        size.y * 0.5 + radius * cameraSpec.elevation,
        Math.sin(cameraSpec.azimuth) * radius,
      );
      camera.lookAt(0, 0, 0);
    }

    scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x9A9A9A, 1.1));

    const sun = new THREE.DirectionalLight(0xFFF6E8, 2.1);
    sun.position.set(radius, radius * 1.6, radius * 0.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const extent = radius * 1.4;
    Object.assign(sun.shadow.camera, {
      left: -extent, right: extent, top: extent, bottom: -extent,
      near: 0.1, far: radius * 6,
    });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);

    // Soya tushadigan yer tekisligi — usiz uy havoda turgandek ko'rinadi.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 8, radius * 8),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -size.y / 2 - 0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    for (const child of group.children) {
      child.castShadow = true;
      child.receiveShadow = true;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    renderer.render(scene, camera);
    return true;
  } catch (error) {
    console.error('renderHouse:', error);
    return false;
  }
};
</script>
</body></html>`;
