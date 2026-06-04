import {
    AmbientLight,
    BoxGeometry,
    BufferGeometry,
    Color,
    DirectionalLight,
    DoubleSide,
    Float32BufferAttribute,
    Fog,
    GridHelper,
    Group,
    HemisphereLight,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    Scene,
    SRGBColorSpace,
    Texture,
    TextureLoader,
    Vector2,
    Vector3,
    WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { OpenCoreLayoutModel, SceneEntity, ViewerMode } from '../../types'

// No Preact imports — this module is lazy-imported by OpenCoreViewer.tsx.

export interface SceneCallbacks {
    onSelect: (boxKey: string | null) => void
    onHover: (boxKey: string | null) => void
}

export interface SceneController {
    mount(container: HTMLElement, model: OpenCoreLayoutModel, cb: SceneCallbacks): void
    setMode(mode: ViewerMode): void
    setSelected(boxKey: string | null): void
    /** boxKey → assigned filter's box-image URL (or '' for none). Drives the
     *  amber emissive tint AND the front/top box-image decals. */
    setAssigned(assignments: Map<string, string>): void
    resize(): void
    dispose(): void
}

// ─── material helpers ────────────────────────────────────────────────────────

function structureMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
        color: new Color('#3a4150'),
        roughness: 0.95,
        metalness: 0.0,
        opacity: 0.55,
        transparent: true,
        // DoubleSide so the custom triangle-prism / wedge faces render no matter
        // their winding (and so thin slabs are visible edge-on).
        side: DoubleSide,
    })
}

// ─── geometry helpers ────────────────────────────────────────────────────────

function geometryFromPositions(positions: number[]): BufferGeometry {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geo.computeVertexNormals()
    return geo
}

/**
 * Equilateral triangular prism, horizontal (triangle in the XZ plane, thickness
 * along Y). Rust building triangles are equilateral with side 3, and — crucially
 * — their transform pivot is at the MIDPOINT of one edge (the socket/mating
 * edge), not the centroid. Verified against the real export: a triangle's pivot
 * sits exactly 1.5 m from the centre of the square it mates with, with that
 * square at world angle yaw + 90°. So we build:
 *   - base (mating) edge along local X, centred on the origin (the pivot),
 *   - its outward normal along local +Z (→ world yaw+90° after the Ry(-yaw)
 *     conversion, matching the data),
 *   - the apex on the -Z side.
 */
function makeTrianglePrism(side: number, thickness: number): BufferGeometry {
    const h = (side * Math.sqrt(3)) / 2
    const t = thickness / 2
    const halfS = side / 2
    // Base corners B/C on local X at the pivot; apex A on -Z.
    const at = [0, t, -h]
    const bt = [halfS, t, 0]
    const ct = [-halfS, t, 0]
    const ab = [0, -t, -h]
    const bb = [halfS, -t, 0]
    const cb = [-halfS, -t, 0]
    const positions: number[] = [
        // top cap
        ...at,
        ...bt,
        ...ct,
        // bottom cap
        ...ab,
        ...cb,
        ...bb,
        // side AB
        ...at,
        ...bt,
        ...bb,
        ...at,
        ...bb,
        ...ab,
        // base edge BC
        ...bt,
        ...ct,
        ...cb,
        ...bt,
        ...cb,
        ...bb,
        // side CA
        ...ct,
        ...at,
        ...ab,
        ...ct,
        ...ab,
        ...cb,
    ]
    return geometryFromPositions(positions)
}

/**
 * Right-triangle wedge (ramp): triangle in the XY plane rising along +X,
 * extruded along Z by `width`. Vertically centred so the 'bottom' anchor sits
 * the base at the entity position.
 */
function makeWedge(run: number, rise: number, width: number): BufferGeometry {
    const rx = run / 2
    const ry = rise / 2
    const w = width / 2
    // Front (z = -w): a0 low-back, a1 low-front, a2 high apex
    const a0 = [-rx, -ry, -w]
    const a1 = [rx, -ry, -w]
    const a2 = [rx, ry, -w]
    // Back (z = +w)
    const b0 = [-rx, -ry, w]
    const b1 = [rx, -ry, w]
    const b2 = [rx, ry, w]
    const positions: number[] = [
        // front + back caps
        ...a0,
        ...a1,
        ...a2,
        ...b0,
        ...b2,
        ...b1,
        // bottom quad
        ...a0,
        ...a1,
        ...b1,
        ...a0,
        ...b1,
        ...b0,
        // vertical (high) quad
        ...a1,
        ...a2,
        ...b2,
        ...a1,
        ...b2,
        ...b1,
        // ramp surface (hypotenuse)
        ...a0,
        ...a2,
        ...b2,
        ...a0,
        ...b2,
        ...b0,
    ]
    return geometryFromPositions(positions)
}

const WALL_KINDS = new Set(['wall', 'wall-half', 'wall-window', 'wall-frame'])

function shelfMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
        color: new Color('#4a4150'),
        opacity: 0.5,
        transparent: true,
        roughness: 0.9,
        metalness: 0.0,
    })
}

function boxBaseMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
        color: new Color('#8a6d3b'),
        roughness: 0.7,
        metalness: 0.0,
        emissive: new Color('#f59e0b'),
        emissiveIntensity: 0,
    })
}

// ─── factory ────────────────────────────────────────────────────────────────

export function createSceneController(): SceneController {
    let renderer: WebGLRenderer | null = null
    let scene: Scene | null = null
    let camera: PerspectiveCamera | null = null
    let controls: OrbitControls | null = null
    let container: HTMLElement | null = null
    let rafId: number | null = null
    let callbacks: SceneCallbacks | null = null

    const boxMeshByKey = new Map<string, Mesh>()
    // Per-box decal planes covering the front (+Z) and top (+Y) faces. Hidden
    // until a filter with a box image is assigned; then front = /boxes/<name>.webp
    // and top = /boxes/<name>-top.webp (falling back to the front image).
    const labelByKey = new Map<string, { verticals: Mesh[]; top: Mesh }>()
    const labelLoader = new TextureLoader()
    const labelTextureCache = new Map<string, Texture>()
    let selectedKey: string | null = null
    let hoveredKey: string | null = null
    let assignedKeys = new Set<string>()

    // Real Rust large-wood-box albedo (cropped from large_wood_storage_bc).
    // Loaded once and shared across every box-large material.
    let woodTexture: Texture | null = null

    const raycaster = new Raycaster()
    const pointer = new Vector2()
    let boxesGroup: Group | null = null

    // pointer drag guard
    let pointerDownPos: { x: number; y: number } | null = null
    let rafPending = false

    function getEmissiveIntensity(key: string): number {
        if (key === selectedKey) return 0.9
        if (key === hoveredKey) return 0.5
        if (assignedKeys.has(key)) return 0.25
        return 0
    }

    function applyEmissive(key: string): void {
        const mesh = boxMeshByKey.get(key)
        if (!mesh) return
        ;(mesh.material as MeshStandardMaterial).emissiveIntensity = getEmissiveIntensity(key)
    }

    function getLabelTexture(url: string): Texture {
        const cached = labelTextureCache.get(url)
        if (cached) return cached
        const tex = labelLoader.load(url)
        tex.colorSpace = SRGBColorSpace
        labelTextureCache.set(url, tex)
        return tex
    }

    // "/boxes/neon-drop-box.webp" → "/boxes/neon-drop-box-top.webp"
    function deriveTopUrl(coverUrl: string): string | null {
        return coverUrl.endsWith('.webp') ? `${coverUrl.slice(0, -5)}-top.webp` : null
    }

    // Paint the top decal: prefer <name>-top.webp, fall back to the front image
    // (stretched to fill the top face) when there's no dedicated top texture.
    function applyTopTexture(plane: Mesh, coverUrl: string): void {
        const mat = plane.material as MeshBasicMaterial
        const topUrl = deriveTopUrl(coverUrl)
        if (!topUrl) {
            mat.map = getLabelTexture(coverUrl)
            mat.needsUpdate = true
            return
        }
        const cached = labelTextureCache.get(topUrl)
        if (cached) {
            mat.map = cached
            mat.needsUpdate = true
            return
        }
        labelLoader.load(
            topUrl,
            (tex) => {
                tex.colorSpace = SRGBColorSpace
                labelTextureCache.set(topUrl, tex)
                mat.map = tex
                mat.needsUpdate = true
            },
            undefined,
            () => {
                // No dedicated top image — fall back to the front, fitted to the face.
                mat.map = getLabelTexture(coverUrl)
                mat.needsUpdate = true
            },
        )
    }

    function buildGeometry(entity: SceneEntity): BufferGeometry {
        const { x, y, z } = entity.prefab.size
        const shape = entity.prefab.shape
        if (shape === 'triangle-prism') return makeTrianglePrism(x, y)
        if (shape === 'wedge') return makeWedge(x, y, z)
        // Rust walls are thin along their local X (width runs along Z), so the
        // slab must be built thin-on-X. Combined with the Ry(-yaw) conversion
        // this faces each wall along the foundation edge it sits on.
        if (WALL_KINDS.has(entity.prefab.kind)) {
            return new BoxGeometry(z, y, x)
        }
        return new BoxGeometry(x, y, z)
    }

    function buildMesh(entity: SceneEntity): Mesh {
        const geo = buildGeometry(entity)
        let mat: MeshStandardMaterial

        if (entity.interactive) {
            if (entity.prefab.kind === 'box-large' && woodTexture) {
                // The large wood box gets the real Rust albedo.
                mat = new MeshStandardMaterial({
                    map: woodTexture,
                    roughness: 0.85,
                    metalness: 0.0,
                    emissive: new Color('#f59e0b'),
                    emissiveIntensity: 0,
                })
            } else {
                // Other containers keep the flat wood tint.
                mat = boxBaseMaterial()
            }
        } else if (entity.prefab.kind === 'shelf' || entity.prefab.kind === 'unknown') {
            mat = shelfMaterial()
        } else {
            mat = structureMaterial()
        }

        const mesh = new Mesh(geo, mat)
        mesh.position.set(entity.position.x, entity.position.y, entity.position.z)
        mesh.rotation.set(entity.rotation.x, entity.rotation.y, entity.rotation.z)
        mesh.rotation.order = 'YXZ'

        if (entity.interactive) {
            mesh.name = entity.boxKey
            mesh.userData = {
                boxKey: entity.boxKey,
                index: entity.index,
                prefabName: entity.prefab.prefabName,
                kind: entity.prefab.kind,
                skinId: entity.skinId,
            }
            boxMeshByKey.set(entity.boxKey, mesh)

            // Box-image decals (hidden until a filter is assigned): the cover
            // image goes on all four vertical faces (so it shows from any angle),
            // the -top image on the lid. Unlit MeshBasicMaterial keeps neon bright.
            const { x: w, y: h, z: d } = entity.prefab.size
            const decalMat = () => new MeshBasicMaterial({ transparent: true, depthWrite: false })
            const ep = 0.012

            const makePlane = (
                pw: number,
                ph: number,
                pos: [number, number, number],
                rot: [number, number, number],
            ) => {
                const p = new Mesh(new PlaneGeometry(pw, ph), decalMat())
                p.position.set(...pos)
                p.rotation.set(...rot)
                p.visible = false
                p.raycast = () => {}
                mesh.add(p)
                return p
            }

            const verticals = [
                makePlane(w * 0.98, h * 0.98, [0, 0, d / 2 + ep], [0, 0, 0]), // +Z
                makePlane(w * 0.98, h * 0.98, [0, 0, -d / 2 - ep], [0, Math.PI, 0]), // -Z
                makePlane(d * 0.98, h * 0.98, [w / 2 + ep, 0, 0], [0, Math.PI / 2, 0]), // +X
                makePlane(d * 0.98, h * 0.98, [-w / 2 - ep, 0, 0], [0, -Math.PI / 2, 0]), // -X
            ]
            const top = makePlane(w * 0.98, d * 0.98, [0, h / 2 + ep, 0], [-Math.PI / 2, 0, 0]) // +Y

            labelByKey.set(entity.boxKey, { verticals, top })
        }

        return mesh
    }

    function handlePointerMove(e: PointerEvent): void {
        if (!container || !rafPending) {
            rafPending = true
            requestAnimationFrame(() => {
                rafPending = false
                if (!container || !camera || !scene || !boxesGroup) return
                const rect = container.getBoundingClientRect()
                pointer.set(
                    ((e.clientX - rect.left) / rect.width) * 2 - 1,
                    -((e.clientY - rect.top) / rect.height) * 2 + 1,
                )
                raycaster.setFromCamera(pointer, camera)
                const hits = raycaster.intersectObjects(boxesGroup.children, false)
                const newHover = hits.length > 0 ? (hits[0].object.userData.boxKey as string) : null

                if (newHover !== hoveredKey) {
                    const prev = hoveredKey
                    hoveredKey = newHover
                    if (prev) applyEmissive(prev)
                    if (newHover) applyEmissive(newHover)
                    callbacks?.onHover(newHover)
                }
            })
        }
    }

    function handlePointerDown(e: PointerEvent): void {
        pointerDownPos = { x: e.clientX, y: e.clientY }
    }

    function handleClick(e: MouseEvent): void {
        if (!container || !camera || !boxesGroup) return

        // Drag guard: ignore if pointer moved > 5 px since pointerdown
        if (pointerDownPos) {
            const dx = e.clientX - pointerDownPos.x
            const dy = e.clientY - pointerDownPos.y
            if (Math.sqrt(dx * dx + dy * dy) > 5) return
        }

        const rect = container.getBoundingClientRect()
        pointer.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        )
        raycaster.setFromCamera(pointer, camera)
        const hits = raycaster.intersectObjects(boxesGroup.children, false)
        const key = hits.length > 0 ? (hits[0].object.userData.boxKey as string) : null
        callbacks?.onSelect(key)
    }

    function loop(): void {
        if (!renderer || !scene || !camera || !controls) return
        rafId = requestAnimationFrame(loop)
        controls.update()
        renderer.render(scene, camera)
    }

    return {
        mount(cont: HTMLElement, model: OpenCoreLayoutModel, cb: SceneCallbacks): void {
            container = cont
            callbacks = cb

            renderer = new WebGLRenderer({ antialias: true })
            renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
            renderer.outputColorSpace = SRGBColorSpace
            renderer.setSize(cont.clientWidth, cont.clientHeight)
            cont.appendChild(renderer.domElement)

            scene = new Scene()
            scene.background = new Color('#0a0e14')

            const sceneSize = Math.max(
                model.bounds.size.x,
                model.bounds.size.y,
                model.bounds.size.z,
            )
            scene.fog = new Fog('#0a0e14', sceneSize, sceneSize * 3)

            const gridSize = Math.ceil(sceneSize + 10)
            const grid = new GridHelper(
                gridSize,
                gridSize,
                new Color('#1b2433'),
                new Color('#1b2433'),
            )
            grid.position.y = model.bounds.min.y - 0.01
            scene.add(grid)

            // Lights
            scene.add(new HemisphereLight('#cdd6f4', '#0a0e14', 0.6))
            const dir = new DirectionalLight('#ffffff', 0.9)
            dir.position.set(sceneSize, sceneSize * 2, sceneSize)
            scene.add(dir)
            scene.add(new AmbientLight('#ffffff', 0.25))

            // Camera
            const aspect = cont.clientWidth / cont.clientHeight
            camera = new PerspectiveCamera(55, aspect, 0.1, 2000)
            const distance = Math.max(sceneSize * 1.6, 8)
            const dirVec = new Vector3(1, 0.8, 1).normalize()
            const center = new Vector3(
                model.bounds.center.x,
                model.bounds.center.y,
                model.bounds.center.z,
            )
            camera.position.copy(center).addScaledVector(dirVec, distance)

            // Controls
            controls = new OrbitControls(camera, renderer.domElement)
            controls.target.copy(center)
            controls.enableDamping = true
            controls.dampingFactor = 0.08
            controls.maxPolarAngle = Math.PI * 0.495
            controls.minDistance = distance * 0.1
            controls.maxDistance = distance * 4
            controls.update()

            // Load the large-wood-box albedo before building meshes so box-large
            // materials pick it up. (Three updates the GPU texture once decoded.)
            woodTexture = new TextureLoader().load('/textures/box.wooden.large.webp')
            woodTexture.colorSpace = SRGBColorSpace

            // Meshes
            const structuresGroup = new Group()
            boxesGroup = new Group()
            scene.add(structuresGroup)
            scene.add(boxesGroup)

            for (const entity of model.entities) {
                const mesh = buildMesh(entity)
                if (entity.interactive) {
                    boxesGroup.add(mesh)
                } else {
                    structuresGroup.add(mesh)
                }
            }

            // Events
            cont.addEventListener('pointermove', handlePointerMove)
            cont.addEventListener('pointerdown', handlePointerDown)
            cont.addEventListener('click', handleClick)

            rafId = requestAnimationFrame(loop)
        },

        setMode(_mode: ViewerMode): void {
            // Reserved for future use (e.g. cursor style changes)
        },

        setSelected(key: string | null): void {
            const prev = selectedKey
            selectedKey = key
            if (prev) applyEmissive(prev)
            if (key) applyEmissive(key)
        },

        setAssigned(assignments: Map<string, string>): void {
            const keys = new Set(assignments.keys())
            const allKeys = new Set([
                ...assignedKeys,
                ...keys,
                ...(selectedKey ? [selectedKey] : []),
                ...(hoveredKey ? [hoveredKey] : []),
            ])
            assignedKeys = keys
            for (const k of allKeys) applyEmissive(k)

            // Box-image decals: cover image on all four vertical faces, the
            // -top image (front fallback) on the lid.
            for (const [boxKey, decals] of labelByKey) {
                const url = assignments.get(boxKey)
                if (url) {
                    const tex = getLabelTexture(url)
                    for (const plane of decals.verticals) {
                        const m = plane.material as MeshBasicMaterial
                        m.map = tex
                        m.needsUpdate = true
                        plane.visible = true
                    }
                    applyTopTexture(decals.top, url)
                    decals.top.visible = true
                } else {
                    for (const plane of decals.verticals) plane.visible = false
                    decals.top.visible = false
                }
            }
        },

        resize(): void {
            if (!container || !camera || !renderer) return
            const w = container.clientWidth
            const h = container.clientHeight
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            renderer.setSize(w, h)
        },

        dispose(): void {
            if (rafId !== null) cancelAnimationFrame(rafId)
            rafId = null

            if (container) {
                container.removeEventListener('pointermove', handlePointerMove)
                container.removeEventListener('pointerdown', handlePointerDown)
                container.removeEventListener('click', handleClick)
            }

            if (scene) {
                scene.traverse((obj) => {
                    if (obj instanceof Mesh) {
                        obj.geometry.dispose()
                        const mat = obj.material
                        if (Array.isArray(mat)) {
                            mat.forEach((m) => m.dispose())
                        } else {
                            mat.dispose()
                        }
                    }
                })
            }

            if (woodTexture) {
                woodTexture.dispose()
                woodTexture = null
            }

            for (const tex of labelTextureCache.values()) tex.dispose()
            labelTextureCache.clear()
            labelByKey.clear()

            if (controls) {
                controls.dispose()
                controls = null
            }

            if (renderer) {
                renderer.dispose()
                if (renderer.domElement.parentNode) {
                    renderer.domElement.parentNode.removeChild(renderer.domElement)
                }
                renderer = null
            }

            scene = null
            camera = null
            container = null
            callbacks = null
            boxMeshByKey.clear()
            selectedKey = null
            hoveredKey = null
        },
    }
}
