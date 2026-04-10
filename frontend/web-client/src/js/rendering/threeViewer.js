import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

export const threeViewer = (() => {
  let renderer, scene, camera, controls;
  let composer, renderPass, bloomPass, mriPass, fxaaPass, outputPass;

  let currentModel = null;
  let debugCube = null;

  // ✅ NUEVO: info del modelo actual (para label/scale)
  let currentModelInfo = null; // { url, label, scale }

  // Playlist admite strings o items {url,label,scale}
  const playlist = [];
  let playlistIndex = 0;

  // para zoom UI estable
  let baseDistance = null;

  // ✅ Animación (FBX/GLTF si el asset trae clips)
  let mixer = null;
  const clock = new THREE.Clock();

  // ===== MRI shader (limpio) =====
  const MRIShader = {
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0.0 },

      contrast: { value: 1.18 },
      brightness: { value: 0.01 },
      gamma: { value: 1.02 },

      tint: { value: new THREE.Vector3(0.78, 0.95, 1.08) },
      tintStrength: { value: 0.45 },

      vignette: { value: 0.55 },
      vignetteSoft: { value: 0.6 },

      grain: { value: 0.01 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float time;


      uniform float contrast;
      uniform float brightness;
      uniform float gamma;


      uniform vec3 tint;
      uniform float tintStrength;


      uniform float vignette;
      uniform float vignetteSoft;


      uniform float grain;


      varying vec2 vUv;


      float hash(vec2 p){
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }


      void main(){
        vec4 col = texture2D(tDiffuse, vUv);


        float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 g = vec3(luma);


        g = (g - 0.5) * contrast + 0.5;
        g += brightness;
        g = pow(max(g, 0.0), vec3(1.0 / max(gamma, 0.001)));


        vec3 tinted = mix(g, g * tint, clamp(tintStrength, 0.0, 1.0));


        vec2 p = vUv - 0.5;
        float d = length(p);
        float vig = smoothstep(vignetteSoft, 0.85, d);
        tinted *= (1.0 - vig * vignette);


        float n = hash(vUv * (800.0 + 100.0 * sin(time * 0.25))) - 0.5;
        tinted += n * grain;


        tinted = clamp(tinted, 0.0, 1.0);
        gl_FragColor = vec4(tinted, col.a);
      }
    `,
  };

  function resizeToDisplaySize() {
    if (!renderer || !camera || !composer) return;

    const c = renderer.domElement;
    const width = c.clientWidth;
    const height = c.clientHeight;
    if (!width || !height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const needResize =
      renderer.getPixelRatio() !== dpr ||
      c.width !== Math.floor(width * dpr) ||
      c.height !== Math.floor(height * dpr);

    if (!needResize) return;

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    bloomPass?.setSize?.(width, height);

    if (fxaaPass?.material?.uniforms?.resolution) {
      fxaaPass.material.uniforms.resolution.value.set(
        1 / (width * dpr),
        1 / (height * dpr),
      );
    }
  }

  function init({ canvas, container }) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05080a);

    const w =
      canvas.clientWidth || canvas.width || container.clientWidth || 800;
    const h =
      canvas.clientHeight || canvas.height || container.clientHeight || 600;

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    camera.position.set(0, 0.8, 2.5);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 3, 4);
    scene.add(dir);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = false;

    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.screenSpacePanning = true;

    controls.minDistance = 0.4;
    controls.maxDistance = 20;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.update();

    composer = new EffectComposer(renderer);

    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.1, 0.5, 0.85);
    composer.addPass(bloomPass);

    mriPass = new ShaderPass(MRIShader);
    composer.addPass(mriPass);

    fxaaPass = new ShaderPass(FXAAShader);
    composer.addPass(fxaaPass);

    outputPass = new OutputPass();
    composer.addPass(outputPass);

    resizeToDisplaySize();
    animate();
  }

  function animate() {
    if (!renderer || !scene || !camera || !composer) return;
    requestAnimationFrame(animate);

    resizeToDisplaySize();
    if (mriPass) mriPass.uniforms.time.value += 0.01;

    // ✅ Actualiza animación si existe
    if (mixer) {
      const dt = clock.getDelta();
      mixer.update(dt);
    } else {
      clock.getDelta();
    }

    controls?.update();
    composer.render();
  }

  function resize(w, h) {
    if (!renderer || !camera || !composer) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);

    renderer.setSize(w, h, false);
    composer.setSize(w, h);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    bloomPass?.setSize?.(w, h);

    if (fxaaPass?.material?.uniforms?.resolution) {
      fxaaPass.material.uniforms.resolution.value.set(
        1 / (w * dpr),
        1 / (h * dpr),
      );
    }
  }

  function addDebugCube() {
    if (!scene || debugCube) return;

    mixer = null;

    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xbfd7ff,
      roughness: 0.55,
      metalness: 0.0,
    });
    debugCube = new THREE.Mesh(geo, mat);
    debugCube.position.set(0, 0.6, 0);
    scene.add(debugCube);

    currentModel = debugCube;
    currentModelInfo = { url: "debug", label: "Debug Cube", scale: 1 };

    camera.position.set(0, 1.2, 2.5);
    controls.target.set(0, 0.6, 0);
    controls.update();

    baseDistance = camera.position.distanceTo(controls.target);
  }

  function cleanupPrevious() {
    if (debugCube) {
      scene.remove(debugCube);
      debugCube.geometry.dispose();
      debugCube.material.dispose();
      debugCube = null;
    }

    if (currentModel) {
      scene.remove(currentModel);
      disposeObject(currentModel);
      currentModel = null;
    }

    mixer = null;
    currentModelInfo = null;
  }

  function getExt(url) {
    const clean = String(url).split("?")[0].split("#")[0];
    const parts = clean.split(".");
    return (parts.length > 1 ? parts.pop() : "").toLowerCase();
  }

  // Para intentar mtl (mismo nombre) y fallback sin mtl
  function getSiblingUrl(url, newExt) {
    const clean = String(url).split("?")[0].split("#")[0];
    return clean.replace(/\.[^/.]+$/, `.${newExt}`);
  }

  // ✅ ARREGLO 1: normaliza item o url
  function normalizeItem(itemOrUrl) {
    if (!itemOrUrl) return null;
    if (typeof itemOrUrl === "string") {
      return { url: itemOrUrl, label: itemOrUrl, scale: null };
    }
    return {
      url: itemOrUrl.url,
      label: itemOrUrl.label ?? itemOrUrl.url,
      scale: itemOrUrl.scale ?? null,
    };
  }

  // Material clínico por defecto (si no hay MTL o si quieres forzarlo)
  function applyClinicalMaterial(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        // si el OBJ viene sin normales, esto ayuda
        if (child.geometry && child.geometry.isBufferGeometry) {
          const n = child.geometry.attributes?.normal;
          if (!n) child.geometry.computeVertexNormals();
        }
        child.material = new THREE.MeshStandardMaterial({
          color: 0xcfd8dc,
          roughness: 0.6,
          metalness: 0.0,
        });
      }
    });
  }

  // ✅ ARREGLO 1: loadModel acepta string o {url,label,scale}
  function loadModel(itemOrUrl) {
    if (!scene) throw new Error("threeViewer.init() antes de loadModel()");

    const item = normalizeItem(itemOrUrl);
    const url = item?.url;
    if (!url) return Promise.reject(new Error("loadModel: url inválida"));

    const ext = getExt(url);

    // ---------- GLTF / GLB ----------
    if (ext === "glb" || ext === "gltf") {
      const loader = new GLTFLoader();

      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            // tu comportamiento original: eliminar animaciones (lo mantenemos)
            if (gltf.animations && gltf.animations.length) {
              gltf.animations.length = 0;
            }

            cleanupPrevious();

            currentModel = gltf.scene;
            currentModelInfo = item;

            if (item.scale != null) currentModel.scale.setScalar(item.scale);

            scene.add(currentModel);

            frameObject(currentModel);
            resolve(gltf);
          },
          undefined,
          (err) => reject(err),
        );
      });
    }

    // ---------- FBX ----------
    if (ext === "fbx") {
      const loader = new FBXLoader();

      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (obj) => {
            cleanupPrevious();

            currentModel = obj;
            currentModelInfo = item;

            if (item.scale != null) currentModel.scale.setScalar(item.scale);

            scene.add(currentModel);

            // Animación FBX si existe
            if (obj.animations && obj.animations.length) {
              mixer = new THREE.AnimationMixer(obj);
              const action = mixer.clipAction(obj.animations[0]);
              action.play();
            }

            frameObject(currentModel);
            resolve(obj);
          },
          undefined,
          (err) => reject(err),
        );
      });
    }

    if (ext === "obj") {
      const objLoader = new OBJLoader();

      return new Promise((resolve, reject) => {
        objLoader.load(
          url,
          (obj) => {
            cleanupPrevious();

            currentModel = obj;
            currentModelInfo = item;

            if (item.scale != null) currentModel.scale.setScalar(item.scale);

            scene.add(currentModel);

            // ✅ siempre material clínico (sin MTL)
            applyClinicalMaterial(currentModel);

            mixer = null;
            frameObject(currentModel);
            resolve(obj);
          },
          undefined,
          reject,
        );
      });
    }

    return Promise.reject(new Error(`Formato no soportado: .${ext}`));
  }

  function frameObject(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    obj.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
    cameraZ *= 1.4;

    camera.position.set(0, size.y * 0.2, cameraZ);
    controls.target.set(0, 0, 0);
    controls.update();

    baseDistance = camera.position.distanceTo(controls.target);
  }

  // mover (scaleDelta solo si algún día lo usas)
  function applyPinchToModel({
    dragDx = 0,
    dragDy = 0,
    scaleDelta = 0,
    mirrorX = false,
  }) {
    if (!currentModel || !camera) return;

    const dx = mirrorX ? -dragDx : dragDx;
    const dy = dragDy;

    const MOVE = 0.002;

    const right = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();

    if (dx || dy) {
      currentModel.position.addScaledVector(right, dx * MOVE);
      currentModel.position.addScaledVector(up, -dy * MOVE);
    }

    if (scaleDelta) {
      const s = 1 + scaleDelta;
      const next = currentModel.scale.clone().multiplyScalar(s);

      const minS = 0.05;
      const maxS = 50.0;
      next.x = Math.min(maxS, Math.max(minS, next.x));
      next.y = Math.min(maxS, Math.max(minS, next.y));
      next.z = Math.min(maxS, Math.max(minS, next.z));
      currentModel.scale.copy(next);
    }

    controls?.update();
  }

  // ✅ ROTACIÓN 1:1 siguiendo mano
  function applyRotateToModel({ dragDx = 0, dragDy = 0, mirrorX = false }) {
    if (!currentModel || !camera) return;

    const dx = mirrorX ? -dragDx : dragDx;
    const dy = dragDy;

    const ROT = 0.0015;

    const right = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();

    const yaw = dx * ROT;
    const pitch = dy * ROT;

    const qYaw = new THREE.Quaternion().setFromAxisAngle(up, yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(right, pitch);

    currentModel.quaternion.premultiply(qYaw);
    currentModel.quaternion.premultiply(qPitch);

    controls?.update();
  }

  function setZoom(z) {
    if (!camera || !controls) return;
    if (!baseDistance)
      baseDistance = camera.position.distanceTo(controls.target);

    const desired = baseDistance / Math.max(0.001, z);
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(
      controls.target.clone().add(dir.multiplyScalar(desired)),
    );
    controls.update();
  }

  function setPlaylist(items = []) {
    playlist.length = 0;
    playlist.push(...items);
    playlistIndex = 0;
  }

  function prev() {
    if (!playlist.length) return;
    playlistIndex = (playlistIndex - 1 + playlist.length) % playlist.length;
    loadModel(playlist[playlistIndex]).catch((e) => {
      console.error("Error cambiando a modelo anterior:", e);
    });
  }

  function next() {
    if (!playlist.length) return;
    playlistIndex = (playlistIndex + 1) % playlist.length;
    loadModel(playlist[playlistIndex]).catch((e) => {
      console.error("Error cambiando a modelo siguiente:", e);
    });
  }

  function dispose() {
    controls?.dispose();

    if (currentModel) {
      scene.remove(currentModel);
      disposeObject(currentModel);
      currentModel = null;
    }

    if (debugCube) {
      scene.remove(debugCube);
      debugCube.geometry.dispose();
      debugCube.material.dispose();
      debugCube = null;
    }

    mixer = null;

    composer?.dispose?.();
    renderer?.dispose();

    renderer = null;
    scene = null;
    camera = null;
    controls = null;

    composer = null;
    renderPass = null;
    bloomPass = null;
    mriPass = null;
    fxaaPass = null;
    outputPass = null;

    baseDistance = null;
    currentModelInfo = null;
  }

  // ✅ dispose completo: geometría + material + texturas + renderLists
  function disposeObject(obj) {
    obj.traverse((child) => {
      if (!child.isMesh) return;

      child.geometry?.dispose?.();

      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      mats.forEach((m) => {
        if (!m) return;

        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture && typeof v.dispose === "function") v.dispose();
        }
        m.dispose?.();
      });
    });

    // limpia cachés internas si cambias modelos a menudo
    renderer?.renderLists?.dispose?.();
  }

  return {
    init,
    resize,
    addDebugCube,
    loadModel,
    loadOBJ: (url) => loadModel(url), // opcional
    setZoom,
    setPlaylist,
    prev,
    next,
    applyPinchToModel,
    applyRotateToModel,
    dispose,
    getCamera: () => camera,
    getCurrentModel: () => currentModel,
    getCurrentModelInfo: () => currentModelInfo,
  };
})();
