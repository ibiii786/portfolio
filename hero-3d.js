// ==========================================================================
// Hero 3D — "Observation Apparatus"
// Layered translucent shells around a distorted glowing core,
// drifting particle field, subtle parallax on pointer move.
// ==========================================================================

(function () {
  const canvasWrap = document.getElementById('hero-canvas');
  if (!canvasWrap || typeof THREE === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let scene, camera, renderer, clock, sceneGroup;
  let core, shells = [], particles;
  let pointerX = 0, pointerY = 0;
  let targetRotX = 0, targetRotY = 0;

  const ACCENT = new THREE.Color(0x5EEAD4);
  const ACCENT_DIM = new THREE.Color(0x2D5A54);
  const BONE = new THREE.Color(0xE8E6DF);

  init();

  function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      42,
      canvasWrap.clientWidth / canvasWrap.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 9);

    sceneGroup = new THREE.Group();
    sceneGroup.position.set(2.6, -0.3, 0);
    sceneGroup.scale.setScalar(0.72);
    scene.add(sceneGroup);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
    canvasWrap.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    buildCore();
    buildShells();
    buildParticles();
    addLights();

    window.addEventListener('resize', onResize);

    if (!prefersReducedMotion) {
      window.addEventListener('pointermove', onPointerMove);
      animate();
    } else {
      renderer.render(scene, camera);
    }
  }

  // -- Core: distorted icosahedron with custom vertex displacement shader --
  function buildCore() {
    const geometry = new THREE.IcosahedronGeometry(1.6, 24);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: ACCENT },
        uColorB: { value: ACCENT_DIM },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying float vNoise;

        // Simplex-ish noise (Ashima-derived, simplified)
        vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
        vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
        vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          vNormal = normalize(normalMatrix * normal);
          float n = snoise(position * 0.9 + uTime * 0.12);
          vNoise = n;
          vec3 displaced = position + normal * n * 0.18;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec3 vNormal;
        varying float vNoise;

        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.2);
          vec3 color = mix(uColorB, uColorA, fresnel + vNoise * 0.3);
          float alpha = 0.18 + fresnel * 0.5;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    core = new THREE.Mesh(geometry, material);
    sceneGroup.add(core);
  }

  // -- Shells: wireframe rings at different scales/rotations --
  function buildShells() {
    const configs = [
      { radius: 2.6, color: ACCENT, opacity: 0.18, segments: 1, rotSpeed: 0.04, axis: new THREE.Vector3(1, 0.4, 0) },
      { radius: 3.3, color: BONE, opacity: 0.07, segments: 0, rotSpeed: -0.025, axis: new THREE.Vector3(0.2, 1, 0.3) },
      { radius: 4.0, color: ACCENT, opacity: 0.06, segments: 2, rotSpeed: 0.018, axis: new THREE.Vector3(0.6, -0.3, 1) },
    ];

    configs.forEach((cfg) => {
      const geo = new THREE.IcosahedronGeometry(cfg.radius, cfg.segments);
      const wireGeo = new THREE.WireframeGeometry(geo);
      const mat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
      });
      const shell = new THREE.LineSegments(wireGeo, mat);
      shell.userData.rotSpeed = cfg.rotSpeed;
      shell.userData.axis = cfg.axis.normalize();
      sceneGroup.add(shell);
      shells.push(shell);
    });
  }

  // -- Particles: drifting sediment field --
  function buildParticles() {
    const count = 600;
    const positions = new Float32Array(count * 3);
    const radius = 6;

    for (let i = 0; i < count; i++) {
      const r = radius * (0.4 + Math.random() * 0.6);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x8A94A6,
      size: 0.018,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });

    particles = new THREE.Points(geometry, material);
    sceneGroup.add(particles);
  }

  function addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
  }

  function onPointerMove(e) {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    targetRotY = pointerX * 0.3;
    targetRotX = pointerY * 0.2;
  }

  function onResize() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    core.material.uniforms.uTime.value = t;
    core.rotation.y += 0.0018;
    core.rotation.x += 0.0008;

    shells.forEach((shell) => {
      shell.rotateOnAxis(shell.userData.axis, shell.userData.rotSpeed * 0.01);
    });

    particles.rotation.y += 0.0006;

    // Smooth camera parallax
    sceneGroup.rotation.y += (targetRotY - sceneGroup.rotation.y) * 0.04;
    sceneGroup.rotation.x += (targetRotX - sceneGroup.rotation.x) * 0.04;

    renderer.render(scene, camera);
  }
})();
